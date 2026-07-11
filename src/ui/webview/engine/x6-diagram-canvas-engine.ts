import type { BoundsUpdate, CanvasPoint, EdgeRouteUpdate } from '../../../shared/canvas-geometry';
import type { CanvasElementRegistry, CanvasPropertyElement } from '../components/canvas-element-registry';
import { nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeDataPropertyLayout, nodeTitleText, truncateText, visibleNodeAttributeTextLines } from '../components/node-data-properties';
import { noteHtmlResetStyle, noteHtmlStyleAttributes, sanitizedNoteHtml } from '../components/note-html';
import { noteFoldBackground } from '../components/note-colors';
import { edgeDisplayName } from '../components/ontology-diagram-edges';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasElementContentUpdate, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramMetadataElement, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';
import type { X6Cell, X6Edge, X6EdgeView, X6Graph, X6LabelPosition, X6Node, X6SelectionPlugin } from './x6-browser';

type ElementBorder = NonNullable<NonNullable<DiagramNode['style']>['border']>;
type ElementStyle = NonNullable<DiagramNode['style']>;
type EdgeLineStyle = NonNullable<DiagramEdge['style']>['line_style'];
type ConnectableElement = Pick<DiagramNode | DiagramNote | DiagramImage, 'id' | 'x' | 'y' | 'width' | 'height'>;
type EdgeRouteSnapshot = {
	readonly id: string;
	readonly sourceId: string;
	readonly targetId: string;
	readonly sourceElement: ConnectableElement;
	readonly targetElement: ConnectableElement;
	readonly points: readonly CanvasPoint[];
	readonly label: CanvasPoint;
};

export class X6DiagramCanvasEngine implements DiagramCanvasEngine {
	private readonly graph: X6Graph;
	private readonly selectionListeners = new Set<CanvasSelectionListener>();
	private readonly doubleClickListeners = new Set<CanvasDoubleClickListener>();
	private readonly boundsChangeListeners = new Set<CanvasBoundsChangeListener>();
	private readonly edgeRouteChangeListeners = new Set<CanvasEdgeRouteChangeListener>();
	private readonly pendingEdgeRouteChanges = new Set<string>();
	private readonly edgeLabelPoints = new Map<string, CanvasPoint>();
	private readonly programmaticLabelChanges = new Set<string>();
	private readonly selectedEdgeLineAttrs = new Map<string, unknown>();
	private selectedIds: string[] = [];
	private suppressBoundsEvents = false;
	private suppressSelectionEvents = false;
	private suppressEdgeRouteEvents = false;
	private suppressBlankSelectionClear = false;
	private edgeRoutePublishTimer: number | undefined;
	private labelDragHighlight: { readonly edgeId: string; readonly lineAttrs: unknown } | undefined;
	private currentPayload?: DiagramPayload;
	private selectionBeforePointerDown: readonly string[] = [];

	public constructor(
		private readonly container: HTMLElement,
		private readonly elementRegistry: CanvasElementRegistry,
		private theme: WebviewTheme,
	) {
		const x6 = window.X6;
		if (x6 === undefined) {
			throw new Error('X6 browser bundle was not loaded.');
		}

		installX6Styles(theme);
		this.graph = new x6.Graph({
			container: this.container,
			width: Math.max(this.container.clientWidth, 1800),
			height: Math.max(this.container.clientHeight, 1200),
			autoResize: false,
			panning: false,
			connecting: {
				allowBlank: false,
				allowLoop: false,
				allowNode: false,
				allowEdge: false,
				allowPort: false,
				allowMulti: false,
				highlight: false,
			},
			interacting: (cellView: unknown) => ({
				nodeMovable: !this.isMultiSelectedNodeView(cellView),
				edgeMovable: false,
				edgeLabelMovable: true,
				arrowheadMovable: false,
				vertexMovable: true,
			}),
		});
		this.graph.use(new x6.Selection({
			rubberband: true,
			rubberNode: true,
			rubberEdge: true,
			eventTypes: ['leftMouseDown'],
			modifiers: null,
			strict: true,
			multiple: true,
			multipleSelectionModifiers: ['ctrl', 'meta', 'shift'],
			movable: false,
			showNodeSelectionBox: true,
			showEdgeSelectionBox: true,
			pointerEvents: 'none',
			content: false,
			filter: (cell: unknown) => (isX6Node(cell) || isX6Edge(cell)) && this.elementRegistry.element(cell.id) !== undefined,
		}));
		this.graph.use(new x6.Transform({
			resizing: {
				enabled: true,
				minWidth: 1,
				minHeight: 1,
				orthogonal: true,
			},
			rotating: false,
		}));
		this.container.addEventListener('pointerdown', () => {
			this.selectionBeforePointerDown = [...this.selectedIds];
		}, { capture: true });
		this.registerGraphEvents();
	}

	public renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void {
		this.theme = theme;
		this.currentPayload = payload;
		const selectedIds = this.selectedIds;
		installX6Styles(theme);
		this.suppressEdgeRouteEvents = true;
		this.suppressSelectionEvents = true;
		try {
			this.clearPendingEdgeRouteChanges();
			this.edgeLabelPoints.clear();
			this.programmaticLabelChanges.clear();
			this.selectedEdgeLineAttrs.clear();
			this.graph.clearCells();
			for (const image of payload.diagram?.images ?? []) {
				this.graph.addNode(x6Image(image, theme));
			}
			for (const node of payload.diagram?.nodes ?? []) {
				this.graph.addNode(x6OntologyNode(node, payload, theme));
			}
			for (const note of payload.diagram?.notes ?? []) {
				this.graph.addNode(x6Note(note, theme));
			}
			for (const element of payload.diagram?.metadata_elements ?? []) {
				this.graph.addNode(x6MetadataElement(element, payload, theme));
			}
			const connectableElementById = new Map<string, ConnectableElement>([
				...(payload.diagram?.nodes ?? []).map((node) => [node.id, node] as const),
				...(payload.diagram?.notes ?? []).map((note) => [note.id, note] as const),
				...(payload.diagram?.images ?? []).map((image) => [image.id, image] as const),
			]);
			for (const edge of payload.diagram?.edges ?? []) {
				this.edgeLabelPoints.set(edge.id, edge.label);
				this.graph.addEdge(x6Edge(edge, connectableElementById, theme));
			}
			for (const label of payload.diagram?.labels ?? []) {
				this.graph.addNode(x6Label(label, theme));
			}
		} finally {
			this.suppressEdgeRouteEvents = false;
			this.suppressSelectionEvents = false;
		}
		this.setSelectedIds(selectedIds.filter((id) => this.graph.getCellById(id) !== undefined), {
			publish: false,
			syncGraphSelection: true,
		});
	}

	public selectedElementId(): string | undefined {
		return this.selectedIds.length === 1 ? this.selectedIds[0] : undefined;
	}

	public selectedElementIds(): readonly string[] {
		return [...this.selectedIds];
	}

	public selectElement(id: string): void {
		console.log('[ontology-diagram-editor] canvas selectElement requested', { id });
		const cell = this.graph.getCellById(id);
		if (isX6Node(cell) && this.elementRegistry.element(id) !== undefined) {
			console.log('[ontology-diagram-editor] canvas selectElement resolved node', { id });
			this.setSelectedIds([id], { syncGraphSelection: true });
		}
		if (isX6Edge(cell) && this.elementRegistry.element(id) !== undefined) {
			console.log('[ontology-diagram-editor] canvas selectElement resolved edge', { id });
			this.setSelectedIds([id], { syncGraphSelection: true });
		}
		if (cell === undefined) {
			console.warn('[ontology-diagram-editor] canvas selectElement missing cell', { id });
		}
	}

	public selectElements(ids: readonly string[]): void {
		console.log('[ontology-diagram-editor] canvas selectElements requested', { ids });
		this.setSelectedIds(ids, { syncGraphSelection: true });
	}

	public zoom(): number {
		return this.graph.zoom();
	}

	public setZoom(zoom: number): void {
		this.graph.translate(0, 0);
		this.graph.zoom(zoom, {
			absolute: true,
			center: { x: 0, y: 0 },
			minScale: 0.2,
			maxScale: 4,
		});
	}

	public resize(width: number, height: number): void {
		this.graph.resize(width, height);
	}

	public restoreBounds(bounds: readonly BoundsUpdate[]): void {
		this.suppressBoundsEvents = true;
		try {
			for (const update of bounds) {
				const cell = this.graph.getCellById(update.id);
				if (isX6Node(cell)) {
					this.elementRegistry.updateBounds(update);
					cell.position(update.x, update.y);
					cell.resize(update.width, update.height);
					this.updateOntologyNodePresentation(update.id);
				}
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
	}

	public resizeElement(id: string, width: number, height: number): boolean {
		const cell = this.graph.getCellById(id);
		if (!isX6Node(cell) || this.elementRegistry.element(id) === undefined) {
			return false;
		}

		const position = cell.position();
		const size = cell.size();
		const update = {
			id,
			x: Math.max(0, Math.round(position.x)),
			y: Math.max(0, Math.round(position.y)),
			width: Math.round(width),
			height: Math.round(height),
		};
		if (update.width === Math.round(size.width) && update.height === Math.round(size.height)) {
			return false;
		}

		this.elementRegistry.updateBounds(update);
		cell.resize(update.width, update.height);
		this.updateOntologyNodePresentation(id);
		if (this.selectedIds.includes(id)) {
			this.publishSelectionChanged();
		}
		for (const listener of this.boundsChangeListeners) {
			listener({
				dragKind: 'resize',
				bounds: [update],
			});
		}

		return true;
	}

	public updateElementContent(update: CanvasElementContentUpdate): void {
		const cell = this.graph.getCellById(update.id);
		if (!isX6Node(cell)) {
			return;
		}

		if (update.kind === 'noteText' && this.elementRegistry.element(update.id)?.kind === 'note') {
			cell.attr('noteHtml/html', sanitizedNoteHtml(update.text));
		} else if (update.kind === 'noteExport' && this.elementRegistry.element(update.id)?.kind === 'note') {
			cell.attr(noteExportIndicatorAttrs(update.exported, this.theme));
		} else if (update.kind === 'labelText' && this.elementRegistry.element(update.id)?.kind === 'label') {
			cell.attr('label/text', update.text);
		} else if (update.kind === 'nodeImage' && this.elementRegistry.element(update.id)?.kind === 'node') {
			const hasAttributeSection = cell.attr('separator/refY') !== undefined;
			cell.attr('nodeImage/xlink:href', update.image ?? '');
			cell.attr('nodeImage/opacity', update.image === undefined ? 0 : 1);
			if (!hasAttributeSection) {
				cell.attr('label/refY', update.image === undefined ? '50%' : '68%');
			}
		} else if (update.kind === 'nodePropertyValueTextOverflow' && this.elementRegistry.element(update.id)?.kind === 'node') {
			this.updateOntologyNodePresentation(update.id);
		}
	}

	public nudgeElement(id: string, delta: CanvasPoint): boolean {
		const cell = this.graph.getCellById(id);
		if (!isX6Node(cell) || this.elementRegistry.element(id) === undefined) {
			return false;
		}

		const position = cell.position();
		const size = cell.size();
		const update = {
			id,
			x: Math.max(0, Math.round(position.x + delta.x)),
			y: Math.max(0, Math.round(position.y + delta.y)),
			width: Math.round(size.width),
			height: Math.round(size.height),
		};
		if (update.x === Math.round(position.x) && update.y === Math.round(position.y)) {
			return false;
		}

		this.elementRegistry.updateBounds(update);
		cell.position(update.x, update.y);
		if (this.selectedIds.includes(id)) {
			this.publishSelectionChanged();
		}
		for (const listener of this.boundsChangeListeners) {
			listener({
				dragKind: 'move',
				bounds: [update],
			});
		}

		return true;
	}

	public nudgeSelectedElements(delta: CanvasPoint): boolean {
		const cells = this.selectedNodeCells();
		if (cells.length === 0) {
			return false;
		}

		const adjustedDelta = boundedGroupDelta(cells, delta);
		if (adjustedDelta.x === 0 && adjustedDelta.y === 0) {
			return false;
		}

		this.suppressBoundsEvents = true;
		const edgeRoutes = this.selectedInternalEdgeRoutes();
		const updates: BoundsUpdate[] = [];
		try {
			for (const cell of cells) {
				const position = cell.position();
				const size = cell.size();
				const update = {
					id: cell.id,
					x: Math.max(0, Math.round(position.x + adjustedDelta.x)),
					y: Math.max(0, Math.round(position.y + adjustedDelta.y)),
					width: Math.round(size.width),
					height: Math.round(size.height),
				};
				if (!boundsDifferFromRegistry(update, this.elementRegistry)) {
					continue;
				}

				cell.position(update.x, update.y);
				this.elementRegistry.updateBounds(update);
				updates.push(update);
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
		if (updates.length === 0) {
			return false;
		}

		this.applyTranslatedEdgeRoutes(edgeRoutes, updates);
		this.publishSelectionChanged();
		this.publishElementBounds(updates, 'move');

		return true;
	}

	public edgeRoute(edgeId: string, label: CanvasPoint): EdgeRouteUpdate | undefined {
		const cell = this.graph.getCellById(edgeId);
		if (!isX6Edge(cell)) {
			return undefined;
		}

		const view = edgeView(this.graph, cell);
		const points = normalizedRoutePoints(cell, view);
		if (points.length < 2) {
			return undefined;
		}

		const labelPoint = this.edgeLabelPoints.get(edgeId) ?? edgeLabelPoint(cell, view, points[0]) ?? label;
		this.edgeLabelPoints.set(edgeId, labelPoint);

		return {
			id: edgeId,
			points,
			label: labelPoint,
		};
	}

	public nudgeEdgeLabel(edgeId: string, delta: CanvasPoint): boolean {
		const cell = this.graph.getCellById(edgeId);
		if (!isX6Edge(cell)) {
			return false;
		}

		const view = edgeView(this.graph, cell);
		const points = normalizedRoutePoints(cell, view);
		if (points.length < 2) {
			return false;
		}
		const currentLabel = this.edgeLabelPoints.get(edgeId) ?? edgeLabelPoint(cell, view, points[0]) ?? resetLabelPoint(points);

		const nextLabel = {
			x: Math.max(0, currentLabel.x + delta.x),
			y: Math.max(0, currentLabel.y + delta.y),
		};
		this.setEdgeLabelPosition(cell, nextLabel, points[0]);
		this.clearLabelDragHighlight(cell.id);
		this.markEdgeRouteChanged(cell);
		this.flushEdgeRouteChanges();

		return true;
	}

	public nudgeEdgeRoute(edgeId: string, delta: CanvasPoint): boolean {
		if (delta.x !== 0 || delta.y === 0) {
			return false;
		}

		const cell = this.graph.getCellById(edgeId);
		const edgeElement = this.elementRegistry.element(edgeId);
		if (!isX6Edge(cell) || edgeElement?.kind !== 'edge') {
			return false;
		}

		const sourceElement = connectableElement(this.elementRegistry.element(edgeElement.value.source));
		const targetElement = connectableElement(this.elementRegistry.element(edgeElement.value.target));
		if (sourceElement === undefined || targetElement === undefined) {
			return false;
		}

		const route = this.edgeRoute(edgeId, edgeElement.value.label);
		if (route === undefined || route.points.length < 2) {
			return false;
		}

		const adjustedDelta = boundedEdgeVerticalDelta(route, sourceElement, targetElement, delta.y);
		if (adjustedDelta.y === 0) {
			return false;
		}

		const points = route.points.map((point) => translateCanvasPoint(point, adjustedDelta));
		const options = { ui: true };
		cell.setSource({
			cell: edgeElement.value.source,
			anchor: anchorFromPoint(points[0], sourceElement),
		}, options);
		cell.setTarget({
			cell: edgeElement.value.target,
			anchor: anchorFromPoint(points[points.length - 1], targetElement),
		}, options);
		cell.setVertices(points.slice(1, -1), options);

		this.edgeLabelPoints.set(edgeId, route.label);
		if (cell.getLabels()[0] !== undefined) {
			this.setEdgeLabelPosition(cell, route.label, points[0], options);
		}
		this.clearLabelDragHighlight(cell.id);
		this.markEdgeRouteChanged(cell);
		this.flushEdgeRouteChanges();

		return true;
	}

	public resetEdgeLabel(edgeId: string): void {
		const cell = this.graph.getCellById(edgeId);
		if (!isX6Edge(cell)) {
			return;
		}

		const view = edgeView(this.graph, cell);
		const points = normalizedRoutePoints(cell, view);
		if (points.length < 2) {
			return;
		}

		const label = resetLabelPoint(points);
		this.setEdgeLabelPosition(cell, label, points[0]);
		this.clearLabelDragHighlight(cell.id);
		this.markEdgeRouteChanged(cell);
		this.flushEdgeRouteChanges();
	}

	public onSelectionChanged(listener: CanvasSelectionListener): void {
		this.selectionListeners.add(listener);
	}

	public onElementDoubleClicked(listener: CanvasDoubleClickListener): void {
		this.doubleClickListeners.add(listener);
	}

	public onElementBoundsChanged(listener: CanvasBoundsChangeListener): void {
		this.boundsChangeListeners.add(listener);
	}

	public onEdgeRouteChanged(listener: CanvasEdgeRouteChangeListener): void {
		this.edgeRouteChangeListeners.add(listener);
	}

	private registerGraphEvents(): void {
		this.graph.on('node:click', (event) => {
			const node = eventNode(event);
			console.log('[ontology-diagram-editor] x6 node:click', {
				eventKeys: Object.keys(event),
				nodeId: node?.id,
			});
			if (node === undefined) {
				return;
			}
		});
		this.graph.on('edge:click', (event) => {
			const edge = eventEdge(event);
			console.log('[ontology-diagram-editor] x6 edge:click', {
				eventKeys: Object.keys(event),
				edgeId: edge?.id,
				hasEventEdge: event.edge !== undefined,
				hasEventCell: event.cell !== undefined,
				rawEdgeKeys: objectKeys(event.edge),
				rawCellKeys: objectKeys(event.cell),
			});
			if (edge === undefined) {
				console.warn('[ontology-diagram-editor] x6 edge:click did not resolve an edge cell', event);
				return;
			}

			stopEvent(event.e);
			this.setSelectedIds(clickedElementSelectionIds(this.selectionBeforePointerDown, edge.id, event.e), { syncGraphSelection: true });
		});
		this.graph.on('edge:label:click', (event) => {
			const edge = eventEdge(event);
			if (edge === undefined) {
				return;
			}

			stopEvent(event.e);
			this.setSelectedIds(clickedElementSelectionIds(this.selectionBeforePointerDown, edge.id, event.e), { syncGraphSelection: true });
		});
		this.graph.on('selection:changed', (event) => {
			if (this.suppressSelectionEvents) {
				return;
			}

			this.setSelectedIds(eventSelectedIds(event), { syncGraphSelection: false });
		});
		this.graph.on('edge:change:source', (event) => {
			this.markEdgeRouteChanged(eventEdge(event));
		});
		this.graph.on('edge:change:target', (event) => {
			this.markEdgeRouteChanged(eventEdge(event));
		});
		this.graph.on('edge:change:vertices', (event) => {
			this.markEdgeRouteChanged(eventEdge(event));
		});
		this.graph.on('edge:change:labels', (event) => {
			const edge = eventEdge(event);
			if (edge !== undefined) {
				const isProgrammaticLabelChange = this.programmaticLabelChanges.delete(edge.id);
				if (!isProgrammaticLabelChange) {
					this.edgeLabelPoints.delete(edge.id);
					this.highlightLabelDragEdge(edge);
				}
			}
			this.markEdgeRouteChanged(edge);
		});
		this.graph.on('edge:mouseup', (event) => {
			const edge = eventEdge(event);
			this.markEdgeRouteChanged(edge);
			this.flushEdgeRouteChanges();
			this.clearLabelDragHighlight(edge?.id);
		});
		this.graph.on('blank:click', () => {
			console.log('[ontology-diagram-editor] x6 blank:click');
			if (this.suppressBlankSelectionClear) {
				return;
			}

			this.setSelectedIds([], { syncGraphSelection: true });
		});
		this.graph.on('node:dblclick', (event) => {
			const node = eventNode(event);
			if (node === undefined) {
				return;
			}

			for (const listener of this.doubleClickListeners) {
				if (listener(node.id)) {
					stopEvent(event.e);
					return;
				}
			}
		});
		this.graph.on('node:moved', (event) => {
			const node = eventNode(event);
			if (node === undefined) {
				return;
			}

			if (this.selectedIds.length > 1 && this.selectedIds.includes(node.id)) {
				return;
			}

			this.publishNodeBounds(node, 'move');
		});
		this.graph.on('node:resize', () => {
			this.suppressBlankSelectionClear = true;
		});
		this.graph.on('node:resized', (event) => {
			const node = eventNode(event);
			const clearBlankSelectionSuppression = (): void => {
				this.suppressBlankSelectionClear = false;
			};
			if (node === undefined) {
				window.setTimeout(clearBlankSelectionSuppression, 0);
				return;
			}

			this.publishNodeBounds(node, 'resize');
			window.setTimeout(clearBlankSelectionSuppression, 0);
		});
	}

	private publishSelectionChanged(): void {
		for (const listener of this.selectionListeners) {
			listener();
		}
	}

	private setSelectedIds(
		ids: readonly string[],
		options: { readonly publish?: boolean; readonly syncGraphSelection?: boolean } = {},
	): void {
		const nextIds = uniqueElementIds(ids).filter((id) => this.elementRegistry.element(id) !== undefined);
		if (stringArraysEqual(this.selectedIds, nextIds)) {
			if (options.syncGraphSelection === true) {
				this.syncGraphSelection(nextIds);
			}
			this.updateSelectionPresentation(this.selectedIds, nextIds);
			console.log('[ontology-diagram-editor] canvas selection unchanged', { ids: nextIds });
			return;
		}

		const previousIds = this.selectedIds;
		console.log('[ontology-diagram-editor] canvas selection changed', {
			from: previousIds,
			to: nextIds,
			elementType: nextIds.length === 1 ? this.elementRegistry.elementType(nextIds[0]) : undefined,
		});
		this.selectedIds = nextIds;
		if (options.syncGraphSelection !== false) {
			this.syncGraphSelection(nextIds);
		}
		this.updateSelectionPresentation(previousIds, nextIds);
		if (options.publish !== false) {
			this.publishSelectionChanged();
		}
	}

	private syncGraphSelection(ids: readonly string[]): void {
		this.suppressSelectionEvents = true;
		try {
			const cellIds = ids.filter((id) => this.graph.getCellById(id) !== undefined);
			resetSelection(this.graph, cellIds);
		} finally {
			this.suppressSelectionEvents = false;
		}
	}

	private updateSelectionPresentation(previousIds: readonly string[], nextIds: readonly string[]): void {
		const nextSingleId = nextIds.length === 1 ? nextIds[0] : undefined;
		this.container.classList.toggle('ontology-single-edge-selection', nextIds.length === 1 && isX6Edge(this.graph.getCellById(nextIds[0])));
		for (const id of previousIds) {
			if (id !== nextSingleId) {
				this.removeEdgeTools(id);
			}
			if (!nextIds.includes(id)) {
				this.removeEdgeSelectionPresentation(id);
			}
		}

		clearTransformWidgets(this.graph);
		for (const id of nextIds) {
			this.addEdgeSelectionPresentation(id);
		}
		if (nextIds.length !== 1) {
			return;
		}

		const id = nextIds[0];
		const cell = this.graph.getCellById(id);
		if (isX6Node(cell)) {
			createTransformWidget(this.graph, cell);
		}
		if (isX6Edge(cell)) {
			cell.setTools(edgeEditTools());
		}
	}

	private removeEdgeTools(id: string | undefined): void {
		if (id === undefined) {
			return;
		}

		const cell = this.graph.getCellById(id);
		if (isX6Edge(cell)) {
			cell.removeTools();
		}
	}

	private addEdgeSelectionPresentation(id: string): void {
		const cell = this.graph.getCellById(id);
		if (!isX6Edge(cell) || this.selectedEdgeLineAttrs.has(id)) {
			return;
		}

		this.selectedEdgeLineAttrs.set(id, cloneJsonCompatible(cell.attr('line')));
		cell.attr('line/stroke', this.theme.focusBorder);
		cell.attr('line/strokeWidth', Math.max(numberValue(cell.attr('line/strokeWidth')), this.theme.edgeWeight + 1));
		if (cell.attr('line/targetMarker') !== undefined) {
			cell.attr('line/targetMarker/stroke', this.theme.focusBorder);
		}
	}

	private removeEdgeSelectionPresentation(id: string): void {
		if (!this.selectedEdgeLineAttrs.has(id)) {
			return;
		}

		const lineAttrs = this.selectedEdgeLineAttrs.get(id);
		this.selectedEdgeLineAttrs.delete(id);
		const cell = this.graph.getCellById(id);
		if (isX6Edge(cell)) {
			cell.attr('line', lineAttrs);
		}
	}

	private selectedNodeCells(): readonly X6Node[] {
		return this.selectedIds.flatMap((id) => {
			const cell = this.graph.getCellById(id);
			return isX6Node(cell) && isMovableCanvasElement(this.elementRegistry.element(id)?.kind) ? [cell] : [];
		});
	}

	private isMultiSelectedNodeView(cellView: unknown): boolean {
		const cell = cellViewCell(cellView);
		return this.selectedIds.length > 1 && isX6Node(cell) && this.selectedIds.includes(cell.id);
	}

	private publishNodeBounds(node: X6Node, dragKind: BoundsDragKind): void {
		if (this.suppressBoundsEvents) {
			return;
		}

		const update = boundsUpdate(node);
		this.restoreClampedNodePosition(node, update);
		this.elementRegistry.updateBounds(update);
		if (dragKind === 'resize') {
			this.updateOntologyNodePresentation(node.id);
		}
		if (this.selectedIds.includes(node.id)) {
			this.publishSelectionChanged();
		}
		this.publishElementBounds([update], dragKind);
	}

	private restoreClampedNodePosition(node: X6Node, update: BoundsUpdate): void {
		const position = node.position();
		if (update.x === Math.round(position.x) && update.y === Math.round(position.y)) {
			return;
		}

		this.suppressBoundsEvents = true;
		try {
			node.position(update.x, update.y);
		} finally {
			this.suppressBoundsEvents = false;
		}
	}

	private publishElementBounds(updates: readonly BoundsUpdate[], dragKind: BoundsDragKind): void {
		for (const listener of this.boundsChangeListeners) {
			listener({
				dragKind,
				bounds: updates,
			});
		}
	}

	private selectedInternalEdgeRoutes(): readonly EdgeRouteSnapshot[] {
		const selectedIds = new Set(this.selectedIds);
		return elementRegistryEdges(this.elementRegistry).flatMap((edge) => {
			if (!selectedIds.has(edge.source) || !selectedIds.has(edge.target)) {
				return [];
			}

			const sourceElement = connectableElement(this.elementRegistry.element(edge.source));
			const targetElement = connectableElement(this.elementRegistry.element(edge.target));
			const route = this.edgeRoute(edge.id, edge.label);
			return sourceElement === undefined || targetElement === undefined || route === undefined || route.points.length < 2
				? []
				: [{
					id: edge.id,
					sourceId: edge.source,
					targetId: edge.target,
					sourceElement,
					targetElement,
					points: route.points,
					label: route.label,
				}];
		});
	}

	private applyTranslatedEdgeRoutes(edgeRoutes: readonly EdgeRouteSnapshot[], updates: readonly BoundsUpdate[]): void {
		if (edgeRoutes.length === 0 || updates.length === 0) {
			return;
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		this.suppressEdgeRouteEvents = true;
		try {
			for (const edgeRoute of edgeRoutes) {
				const sourceDelta = movedElementDelta(edgeRoute.sourceElement, updateById.get(edgeRoute.sourceId));
				const targetDelta = movedElementDelta(edgeRoute.targetElement, updateById.get(edgeRoute.targetId));
				if (sourceDelta === undefined || targetDelta === undefined || !canvasPointsEqual(sourceDelta, targetDelta)) {
					continue;
				}

				this.applyTranslatedEdgeRoute(edgeRoute, sourceDelta);
			}
		} finally {
			this.suppressEdgeRouteEvents = false;
		}
	}

	private applyTranslatedEdgeRoute(edgeRoute: EdgeRouteSnapshot, delta: CanvasPoint): void {
		const edge = this.graph.getCellById(edgeRoute.id);
		if (!isX6Edge(edge)) {
			return;
		}

		const points = edgeRoute.points.map((point) => translateCanvasPoint(point, delta));
		const sourceElement = translateConnectableElement(edgeRoute.sourceElement, delta);
		const targetElement = translateConnectableElement(edgeRoute.targetElement, delta);
		const options = { ui: true };
		edge.setSource({
			cell: edgeRoute.sourceId,
			anchor: anchorFromPoint(points[0], sourceElement),
		}, options);
		edge.setTarget({
			cell: edgeRoute.targetId,
			anchor: anchorFromPoint(points[points.length - 1], targetElement),
		}, options);
		edge.setVertices(points.slice(1, -1), options);

		const existingLabel = edge.getLabels()[0];
		const translatedLabel = translateCanvasPoint(edgeRoute.label, delta);
		this.edgeLabelPoints.set(edgeRoute.id, translatedLabel);
		if (existingLabel !== undefined) {
			this.setEdgeLabelPosition(edge, translatedLabel, points[0], options);
		}
	}

	private setEdgeLabelPosition(edge: X6Edge, label: CanvasPoint, sourcePoint: CanvasPoint, options?: Record<string, unknown>): void {
		const existingLabel = edge.getLabels()[0] ?? {};
		const view = edgeView(this.graph, edge);
		this.edgeLabelPoints.set(edge.id, label);
		this.programmaticLabelChanges.add(edge.id);
		edge.setLabelAt(0, {
			...existingLabel,
			position: labelPositionForPoint(label, view, sourcePoint),
		}, options);
		window.setTimeout(() => {
			this.programmaticLabelChanges.delete(edge.id);
		}, 0);
	}

	private markEdgeRouteChanged(edge: X6Edge | undefined): void {
		if (this.suppressEdgeRouteEvents || edge === undefined || this.elementRegistry.element(edge.id)?.kind !== 'edge') {
			return;
		}

		this.pendingEdgeRouteChanges.add(edge.id);
		if (this.edgeRoutePublishTimer !== undefined) {
			window.clearTimeout(this.edgeRoutePublishTimer);
		}
		this.edgeRoutePublishTimer = window.setTimeout(() => {
			this.flushEdgeRouteChanges();
		}, 150);
	}

	private updateOntologyNodePresentation(id: string): void {
		const payload = this.currentPayload;
		const element = this.elementRegistry.element(id);
		const cell = this.graph.getCellById(id);
		if (payload === undefined || element?.kind !== 'node' || !isX6Node(cell)) {
			return;
		}

		const presentation = x6OntologyNodePresentation(element.value, payload, this.theme);
		cell.setMarkup?.(x6OntologyNodeMarkup(presentation.markup));
		cell.attr(presentation.attrs);
	}

	private flushEdgeRouteChanges(): void {
		if (this.edgeRoutePublishTimer !== undefined) {
			window.clearTimeout(this.edgeRoutePublishTimer);
			this.edgeRoutePublishTimer = undefined;
		}
		if (this.pendingEdgeRouteChanges.size === 0) {
			return;
		}

		const edgeIds = [...this.pendingEdgeRouteChanges];
		this.pendingEdgeRouteChanges.clear();
		for (const listener of this.edgeRouteChangeListeners) {
			listener(edgeIds);
		}
	}

	private clearPendingEdgeRouteChanges(): void {
		if (this.edgeRoutePublishTimer !== undefined) {
			window.clearTimeout(this.edgeRoutePublishTimer);
			this.edgeRoutePublishTimer = undefined;
		}
		this.pendingEdgeRouteChanges.clear();
	}

	private highlightLabelDragEdge(edge: X6Edge | undefined): void {
		if (this.suppressEdgeRouteEvents || edge === undefined || this.labelDragHighlight?.edgeId === edge.id) {
			return;
		}

		this.clearLabelDragHighlight();
		this.labelDragHighlight = {
			edgeId: edge.id,
			lineAttrs: cloneJsonCompatible(edge.attr('line')),
		};
		edge.attr('line/stroke', this.theme.focusBorder);
		edge.attr('line/strokeWidth', Math.max(numberValue(edge.attr('line/strokeWidth')), this.theme.edgeWeight + 1));
		edge.attr('line/targetMarker/stroke', this.theme.focusBorder);
	}

	private clearLabelDragHighlight(edgeId?: string): void {
		if (this.labelDragHighlight === undefined || edgeId !== undefined && this.labelDragHighlight.edgeId !== edgeId) {
			return;
		}

		const highlighted = this.labelDragHighlight;
		this.labelDragHighlight = undefined;
		const cell = this.graph.getCellById(highlighted.edgeId);
		if (isX6Edge(cell)) {
			cell.attr('line', highlighted.lineAttrs);
		}
	}
}

function installX6Styles(theme: WebviewTheme): void {
	const styleId = 'ontology-diagram-editor-x6-styles';
	const existingStyle = document.getElementById(styleId);
	const style = existingStyle instanceof HTMLStyleElement ? existingStyle : document.createElement('style');
	style.id = styleId;
	style.textContent = [
		'.x6-graph {',
		'  position: relative;',
		'  overflow: hidden;',
		'  outline: none;',
		'  touch-action: none;',
		'}',
		'.x6-graph-svg,',
		'.x6-graph-svg-stage {',
		'  position: absolute;',
		'  inset: 0;',
		'}',
		'.x6-node { cursor: move; }',
		'.x6-edge { cursor: pointer; }',
		'.x6-edge .connection { stroke-linejoin: round; }',
		'.x6-edge .tools { opacity: 1; }',
		'.ontology-single-edge-selection .x6-widget-selection-box-edge {',
		'  display: none !important;',
		'}',
		'.x6-edge-tool-source-anchor circle,',
		'.x6-edge-tool-target-anchor circle,',
		'.x6-edge-tool-segment rect {',
		`  fill: ${theme.editorForeground};`,
		`  stroke: ${theme.editorBackground};`,
		'  stroke-width: 2;',
		'}',
		'.x6-widget-selection {',
		'  position: absolute;',
		'  top: 0;',
		'  left: 0;',
		'  display: none;',
		'  width: 0;',
		'  height: 0;',
		'  touch-action: none;',
		'}',
		'.x6-widget-selection-selected {',
		'  display: block;',
		'}',
		'.x6-widget-selection-rubberband {',
		'  display: block;',
		`  background-color: ${theme.focusBorder};`,
		`  border: 1px solid ${theme.focusBorder};`,
		'  opacity: 0.25;',
		'}',
		'.x6-widget-selection-box,',
		'.x6-widget-selection-inner {',
		'  box-sizing: content-box !important;',
		'  margin-top: -5px;',
		'  margin-left: -5px;',
		'  padding-right: 8px;',
		'  padding-bottom: 8px;',
		`  border: 2px solid ${theme.focusBorder};`,
		'  box-shadow: none;',
		'}',
		'.x6-widget-transform {',
		'  position: absolute;',
		'  box-sizing: content-box !important;',
		'  margin: -5px 0 0 -5px;',
		'  padding: 4px;',
		`  border: 1px dashed ${theme.focusBorder};`,
		'  border-radius: 4px;',
		'  pointer-events: none;',
		'  user-select: none;',
		'}',
		'.x6-widget-transform > div {',
		'  position: absolute;',
		'  box-sizing: border-box;',
		'  width: 8px;',
		'  height: 8px;',
		`  border: 1px solid ${theme.focusBorder};`,
		`  background: ${theme.editorBackground};`,
		'  border-radius: 50%;',
		'  pointer-events: auto;',
		'}',
		'.x6-widget-transform-resize[data-position="top-left"] { top: -4px; left: -4px; cursor: nwse-resize; }',
		'.x6-widget-transform-resize[data-position="top-right"] { top: -4px; right: -4px; cursor: nesw-resize; }',
		'.x6-widget-transform-resize[data-position="bottom-left"] { bottom: -4px; left: -4px; cursor: nesw-resize; }',
		'.x6-widget-transform-resize[data-position="bottom-right"] { right: -4px; bottom: -4px; cursor: nwse-resize; }',
		'.x6-widget-transform-resize[data-position="top"] { top: -4px; left: 50%; margin-left: -4px; cursor: ns-resize; }',
		'.x6-widget-transform-resize[data-position="bottom"] { bottom: -4px; left: 50%; margin-left: -4px; cursor: ns-resize; }',
		'.x6-widget-transform-resize[data-position="left"] { top: 50%; left: -4px; margin-top: -4px; cursor: ew-resize; }',
		'.x6-widget-transform-resize[data-position="right"] { top: 50%; right: -4px; margin-top: -4px; cursor: ew-resize; }',
		'.x6-widget-transform-rotate,',
		'.x6-widget-transform.no-rotate .x6-widget-transform-rotate {',
		'  display: none;',
		'}',
		'.x6-widget-selection-box,',
		'.x6-widget-selection-inner {',
		`  border-color: ${theme.focusBorder} !important;`,
		'  box-shadow: none !important;',
		'}',
		'.x6-widget-transform {',
		`  border-color: ${theme.focusBorder} !important;`,
		'  border-radius: 4px !important;',
		'}',
		'.x6-widget-transform > div {',
		`  border-color: ${theme.focusBorder} !important;`,
		`  background: ${theme.editorBackground} !important;`,
		'}',
		noteHtmlResetStyle(),
	].join('\n');
	if (existingStyle === null) {
		document.head.appendChild(style);
	}
}

function x6OntologyNode(node: DiagramNode, payload: DiagramPayload, theme: WebviewTheme): Record<string, unknown> {
	const hasImage = node.image !== undefined && node.image.trim() !== '';
	const radius = cornerRadius(node.style, theme.nodeCornerRadius);
	const presentation = x6OntologyNodePresentation(node, payload, theme);
	const imageAttrs = presentation.hasAttributes
		? {
			width: 18,
			height: 18,
			refX: 8,
			refY: 6,
			'xlink:href': node.image ?? '',
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: hasImage ? 1 : 0,
		}
		: {
			width: 28,
			height: 28,
			refX: '50%',
			refX2: -14,
			refY: 10,
			'xlink:href': node.image ?? '',
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: hasImage ? 1 : 0,
		};

	return {
		id: node.id,
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
		markup: x6OntologyNodeMarkup(presentation.markup),
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: radius,
				ry: radius,
				fill: node.style?.bg_color ?? theme.nodeBackground,
				...borderAttrs(node.style?.border, theme.nodeBorder, 1),
				filter: shadowFilter(node.style, theme.elementShadow, theme),
			},
			nodeImage: imageAttrs,
			...presentation.attrs,
		},
		zIndex: 20,
	};
}

function x6MetadataElement(element: DiagramMetadataElement, payload: DiagramPayload, theme: WebviewTheme): Record<string, unknown> {
	const style = element.style;
	const fontSize = style?.font?.size ?? theme.fontSize;
	const fontFamily = style?.font?.family ?? theme.fontFamily;
	const textColor = style?.text_color ?? theme.editorForeground;
	const rowHeight = element.height / 3;
	const keyWidth = Math.min(92, Math.max(68, element.width * 0.34));
	const textAttrs = {
		fill: textColor,
		fontFamily,
		fontSize,
		fontWeight: style?.font?.bold === true ? 700 : 400,
		fontStyle: style?.font?.italic === true ? 'italic' : 'normal',
		textAnchor: 'start',
		textVerticalAnchor: 'middle',
		pointerEvents: 'none',
	};
	const metadata = payload.diagram?.metadata;
	const rows = [
		['Title', metadata?.title ?? ''],
		['Author', (metadata?.authors ?? []).join(', ')],
		['Version', metadata?.diagram_version ?? ''],
	] as const;
	const markup: Record<string, string>[] = [{ tagName: 'rect', selector: 'body' }, { tagName: 'path', selector: 'grid' }];
	for (let index = 0; index < rows.length; index += 1) {
		markup.push({ tagName: 'text', selector: `key${index}` }, { tagName: 'text', selector: `value${index}` });
	}
	return {
		id: element.id,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		markup,
		attrs: {
			body: {
				refWidth: '100%', refHeight: '100%', rx: cornerRadius(style, theme.nodeCornerRadius), ry: cornerRadius(style, theme.nodeCornerRadius),
				fill: style?.bg_color ?? theme.nodeBackground,
				...borderAttrs(style?.border, theme.nodeBorder, 1),
				filter: shadowFilter(style, theme.elementShadow, theme),
			},
			grid: {
				d: `M ${keyWidth} 0 V ${element.height} M 0 ${rowHeight} H ${element.width} M 0 ${rowHeight * 2} H ${element.width}`,
				...borderAttrs(style?.border, theme.nodeBorder, 1),
				fill: 'none',
				pointerEvents: 'none',
			},
			...Object.fromEntries(rows.flatMap((row, index) => [
				[`key${index}`, { ...textAttrs, text: row[0], refX: 9, refY: rowHeight * (index + 0.5), fontWeight: 600 }],
				[`value${index}`, { ...textAttrs, text: row[1], refX: keyWidth + 9, refY: rowHeight * (index + 0.5) }],
			])),
		},
		zIndex: 20,
	};
}

function x6OntologyNodePresentation(node: DiagramNode, payload: DiagramPayload, theme: WebviewTheme): {
	readonly hasAttributes: boolean;
	readonly markup: readonly Record<string, string>[];
	readonly attrs: Record<string, unknown>;
} {
	const hasImage = node.image !== undefined && node.image.trim() !== '';
	const attributes = nodeCompartmentAttributes(node, payload);
	const hasAttributes = attributes.length > 0;
	const fontFamily = node.style?.font?.family ?? theme.nodeFontFamily;
	const fontSize = node.style?.font?.size ?? theme.nodeFontSize;
	const fontBold = node.style?.font?.bold ?? theme.nodeFontBold;
	const fontItalic = node.style?.font?.italic ?? theme.nodeFontItalic;
	const layout = nodeDataPropertyLayout({
		nodeHeight: node.height,
		fontSize,
		attributeCount: 0,
	});
	const allAttributeTexts = nodeAttributeTextLines({
		attributes,
		width: node.width - 20,
		fontSize: layout.attributeFontSize,
		fontFamily,
		italic: fontItalic,
		textOverflow: nodeAttributeTextOverflow(node),
	});
	const attributeLayout = nodeDataPropertyLayout({
		nodeHeight: node.height,
		fontSize,
		attributeCount: allAttributeTexts.length,
	});
	const displayAttributeTexts = visibleNodeAttributeTextLines(allAttributeTexts, attributeLayout.maximumAttributeLines);
	const titleWidth = Math.max(0, node.width - (hasImage && hasAttributes ? 56 : 20));
	const title = truncateText({
		text: nodeTitleText(node, payload),
		width: titleWidth,
		fontSize,
		fontFamily,
		bold: fontBold,
		italic: fontItalic,
	});
	const attributeLineCount = hasAttributes ? displayAttributeTexts.length : 0;
	const attributeAttrs = Object.fromEntries([...Array(attributeLineCount).keys()].map((index) => [
		`attribute${index}`,
		{
			text: displayAttributeTexts[index] ?? '',
			opacity: displayAttributeTexts[index] === undefined ? 0 : 1,
			fill: node.style?.text_color ?? theme.editorForeground,
			fontFamily,
			fontSize: attributeLayout.attributeFontSize,
			fontWeight: 400,
			fontStyle: fontItalic === true ? 'italic' : 'normal',
			textAnchor: 'start',
			textVerticalAnchor: 'middle',
			refX: 10,
			refY: attributeLayout.headerHeight + 12 + (index * attributeLayout.attributeLineHeight),
		},
	]));

	return {
		hasAttributes,
		markup: [
			...(hasAttributes ? [{ tagName: 'rect', selector: 'separator' }] : []),
			...[...Array(attributeLineCount).keys()].map((index) => ({ tagName: 'text', selector: `attribute${index}` })),
		],
		attrs: {
			label: {
				text: title,
				fill: node.style?.text_color ?? theme.editorForeground,
				fontFamily,
				fontSize,
				fontWeight: fontBold === true ? 700 : 400,
				fontStyle: fontItalic === true ? 'italic' : 'normal',
				textAnchor: 'middle',
				textVerticalAnchor: 'middle',
				refX: '50%',
				refY: hasAttributes ? layout.headerHeight / 2 : hasImage ? '68%' : '50%',
			},
			...(hasAttributes ? {
				separator: {
					refWidth: '100%',
					height: 1,
					refY: layout.headerHeight,
					fill: node.style?.border?.color ?? theme.nodeBorder,
					pointerEvents: 'none',
				},
			} : {}),
			...attributeAttrs,
		},
	};
}

function x6OntologyNodeMarkup(presentationMarkup: readonly Record<string, string>[]): readonly Record<string, string>[] {
	return [
		{ tagName: 'rect', selector: 'body' },
		{ tagName: 'image', selector: 'nodeImage' },
		{ tagName: 'text', selector: 'label' },
		...presentationMarkup,
	];
}

function x6Edge(edge: DiagramEdge, elementById: ReadonlyMap<string, ConnectableElement>, theme: WebviewTheme): Record<string, unknown> {
	const persistedPoints = edge.points.length >= 2 ? edge.points : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
	const points = displayPoints(edge, persistedPoints);
	const sourcePoint = points[0];
	const targetPoint = points[points.length - 1];
	const sourceElement = elementById.get(edge.source);
	const targetElement = elementById.get(edge.target);
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = lineStyle === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? theme.edgeColor;
	const label = isNoteConnection(edge) ? '' : edgeDisplayName(edge.ontology_ref);

	return {
		id: edge.id,
		shape: 'edge',
		source: sourceElement === undefined ? sourcePoint : {
			cell: edge.source,
			anchor: anchorFromPoint(sourcePoint, sourceElement),
		},
		target: targetElement === undefined ? targetPoint : {
			cell: edge.target,
			anchor: anchorFromPoint(targetPoint, targetElement),
		},
		vertices: points.slice(1, -1),
		router: edgeRouter(edge.route_layout),
		attrs: {
			line: {
				stroke,
				strokeWidth,
				strokeDasharray: edgeDashArray(lineStyle, strokeWidth),
				targetMarker: edgeTargetMarker(edge, stroke, strokeWidth, theme),
			},
			wrap: {
				stroke: 'transparent',
				strokeWidth: Math.max(14, strokeWidth + 10),
				cursor: 'pointer',
			},
		},
		labels: label.length === 0 ? [] : [{
			position: labelPosition(edge.label, sourcePoint),
			attrs: {
				rect: {
					fill: theme.canvasBackground,
					stroke: 'none',
					fillOpacity: 0.85,
					rx: 3,
					ry: 3,
				},
				text: {
					text: label,
					fill: edge.style?.text_color ?? theme.edgeTextColor,
					fontFamily: edge.style?.font?.family ?? theme.fontFamily,
					fontSize: edge.style?.font?.size ?? Math.max(10, theme.fontSize - 1),
					fontWeight: edge.style?.font?.bold === true ? 700 : 400,
					fontStyle: edge.style?.font?.italic === true ? 'italic' : 'normal',
				},
			},
		}],
		zIndex: 30,
	};
}

function labelPosition(label: CanvasPoint, sourcePoint: CanvasPoint): X6LabelPosition {
	return {
		distance: 0,
		offset: {
			x: label.x - sourcePoint.x,
			y: label.y - sourcePoint.y,
		},
		options: {
			absoluteDistance: true,
			absoluteOffset: true,
		},
	};
}

function labelPositionForPoint(label: CanvasPoint, view: X6EdgeView | undefined, sourcePoint: CanvasPoint): X6LabelPosition {
	return view?.getLabelPosition(label.x, label.y, {
		absoluteDistance: true,
		absoluteOffset: true,
	}) ?? labelPosition(label, sourcePoint);
}

function resetLabelPoint(points: readonly CanvasPoint[]): CanvasPoint {
	if (points.length > 2) {
		const lastSegment = lastNonZeroSegment(points);
		if (lastSegment !== undefined) {
			return offsetLabelPoint(segmentMiddlePoint(lastSegment.start, lastSegment.end), lastSegment.start, lastSegment.end);
		}
	}

	return routeMiddleLabelPoint(points);
}

function routeMiddleLabelPoint(points: readonly CanvasPoint[]): CanvasPoint {
	const totalLength = routeLength(points);
	if (totalLength === 0) {
		return points[0];
	}

	const targetLength = totalLength / 2;
	let traversedLength = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = distance(start, end);
		if (segmentLength === 0) {
			continue;
		}
		if (traversedLength + segmentLength >= targetLength) {
			const ratio = (targetLength - traversedLength) / segmentLength;
			return offsetLabelPoint({
				x: start.x + (end.x - start.x) * ratio,
				y: start.y + (end.y - start.y) * ratio,
			}, start, end);
		}
		traversedLength += segmentLength;
	}

	return offsetLabelPoint(points[points.length - 1], points[points.length - 2], points[points.length - 1]);
}

function lastNonZeroSegment(points: readonly CanvasPoint[]): { readonly start: CanvasPoint; readonly end: CanvasPoint } | undefined {
	for (let index = points.length - 1; index > 0; index -= 1) {
		const start = points[index - 1];
		const end = points[index];
		if (distance(start, end) > 0) {
			return { start, end };
		}
	}

	return undefined;
}

function segmentMiddlePoint(start: CanvasPoint, end: CanvasPoint): CanvasPoint {
	return {
		x: start.x + (end.x - start.x) / 2,
		y: start.y + (end.y - start.y) / 2,
	};
}

function routeLength(points: readonly CanvasPoint[]): number {
	return points.reduce((length, point, index) => {
		const previous = points[index - 1];
		return previous === undefined ? length : length + distance(previous, point);
	}, 0);
}

function distance(start: CanvasPoint, end: CanvasPoint): number {
	return Math.hypot(end.x - start.x, end.y - start.y);
}

function offsetLabelPoint(point: CanvasPoint, segmentStart: CanvasPoint, segmentEnd: CanvasPoint): CanvasPoint {
	const offset = 16;
	const dx = segmentEnd.x - segmentStart.x;
	const dy = segmentEnd.y - segmentStart.y;
	return canvasPoint(Math.abs(dx) >= Math.abs(dy)
		? { x: point.x, y: point.y - offset }
		: { x: point.x + offset, y: point.y });
}

function edgeEditTools(): Record<string, unknown> {
	return {
		items: [
			{
				name: 'segments',
				args: {
					snapRadius: 0,
					attrs: {
						fill: '#444',
						stroke: '#fff',
						'stroke-width': 2,
					},
				},
			},
			{
				name: 'source-anchor',
				args: anchorToolArgs(),
			},
			{
				name: 'target-anchor',
				args: anchorToolArgs(),
			},
		],
	};
}

function anchorToolArgs(): Record<string, unknown> {
	return {
		restrictArea: true,
		snapRadius: 0,
		areaPadding: 6,
		defaultAnchorAttrs: {
			fill: '#444',
			stroke: '#fff',
			'stroke-width': 2,
			r: 6,
		},
		customAnchorAttrs: {
			fill: '#444',
			stroke: '#fff',
			'stroke-width': 2,
			r: 6,
		},
	};
}

function anchorFromPoint(point: CanvasPoint, element: ConnectableElement): Record<string, unknown> {
	return {
		name: 'topLeft',
		args: {
			dx: percentage(point.x - element.x, element.width),
			dy: percentage(point.y - element.y, element.height),
			rotate: true,
		},
	};
}

function percentage(value: number, size: number): string {
	if (size === 0) {
		return '0%';
	}

	return `${roundPercentage((value / size) * 100)}%`;
}

function roundPercentage(value: number): number {
	return Math.round(value * 1000) / 1000;
}

function orthogonalDisplayPoints(points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	if (points.length < 2) {
		return points;
	}

	const result: CanvasPoint[] = [points[0]];
	for (let index = 1; index < points.length; index += 1) {
		const previous = result[result.length - 1];
		const next = points[index];
		if (previous.x !== next.x && previous.y !== next.y) {
			result.push({ x: next.x, y: previous.y });
		}
		result.push(next);
	}

	return withoutRedundantPoints(result);
}

function displayPoints(edge: DiagramEdge, points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	if (edge.route_layout === 'direct') {
		return withoutRedundantPoints([points[0], points[points.length - 1]]);
	}
	if (edge.route_layout === undefined || edge.route_layout === 'orthogonal') {
		return orthogonalDisplayPoints(points);
	}

	return withoutRedundantPoints(points);
}

function edgeRouter(routeLayout: DiagramEdge['route_layout']): string | Record<string, unknown> | undefined {
	switch (routeLayout) {
		case 'orthogonal':
			return undefined;
		case 'one_side':
			return { name: 'oneSide' };
		case 'manhattan':
			return { name: 'manhattan' };
		case 'metro':
			return { name: 'metro' };
		case 'entity_relation':
			return { name: 'er' };
		case 'direct':
		case undefined:
			return undefined;
	}
}

function edgeDashArray(lineStyle: EdgeLineStyle | undefined, strokeWidth: number): string | undefined {
	return lineStyle === 'dotted'
		? `${strokeWidth} ${strokeWidth * 3}`
		: lineStyle === 'dashed'
			? `${strokeWidth * 4} ${strokeWidth * 3}`
			: undefined;
}

function edgeTargetMarker(
	edge: DiagramEdge,
	stroke: string,
	strokeWidth: number,
	theme: WebviewTheme,
): Record<string, unknown> | undefined {
	if (stroke === 'none') {
		return undefined;
	}

	if (isNoteConnection(edge)) {
		return undefined;
	}

	if (edge.ontology_item_type === 'subclassRelationship') {
		return {
			tagName: 'path',
			d: 'M 12 -6 0 0 12 6 Z',
			fill: theme.canvasBackground,
			stroke,
			strokeWidth,
		};
	}

	return {
		tagName: 'path',
		d: 'M 10 -5 0 0 10 5',
		fill: 'none',
		stroke,
		strokeWidth,
	};
}

function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.ontology_item_type === 'noteConnection';
}

function x6Note(note: DiagramNote, theme: WebviewTheme): Record<string, unknown> {
	const radius = cornerRadius(note.style, theme.noteCornerRadius);
	const noteBackground = note.style?.bg_color ?? theme.noteBackground;

	return {
		id: note.id,
		x: note.x,
		y: note.y,
		width: note.width,
		height: note.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'path', selector: 'foldedCorner' },
			{ tagName: 'rect', selector: 'exportIndicatorBackground' },
			{ tagName: 'text', selector: 'exportIndicatorLabel' },
			{
				tagName: 'foreignObject',
				selector: 'noteContent',
				children: [
					{
						tagName: 'div',
						ns: 'http://www.w3.org/1999/xhtml',
						selector: 'noteHtml',
						attrs: {
							xmlns: 'http://www.w3.org/1999/xhtml',
							class: 'note-html',
						},
					},
				],
			},
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: radius,
				ry: radius,
				fill: noteBackground,
				...borderAttrs(note.style?.border, theme.noteBorder, 1),
				filter: shadowFilter(note.style, theme.elementShadow, theme),
			},
			foldedCorner: {
				d: 'M 0 0 L 14 0 L 14 14 Z',
				refX: '100%',
				refX2: -14,
				refY: 0,
				fill: noteFoldBackground(noteBackground, theme),
				stroke: note.style?.border?.color ?? theme.noteBorder,
				strokeWidth: note.style?.border?.type === 'none' ? 0 : note.style?.border?.weight ?? 1,
				pointerEvents: 'none',
			},
			noteContent: {
				refX: 12,
				refY: 12,
				refWidth: '100%',
				refWidth2: -24,
				refHeight: '100%',
				refHeight2: -24,
				pointerEvents: 'none',
			},
			noteHtml: {
				html: sanitizedNoteHtml(note.text),
				style: noteHtmlStyleAttributes({
					color: note.style?.text_color ?? theme.noteForeground,
					fontFamily: note.style?.font?.family ?? theme.fontFamily,
					fontSize: note.style?.font?.size ?? theme.fontSize,
					bold: note.style?.font?.bold,
					italic: note.style?.font?.italic,
				}),
			},
			...noteExportIndicatorAttrs(note.export !== false, theme),
		},
		zIndex: 40,
	};
}

function noteExportIndicatorAttrs(exported: boolean, theme: WebviewTheme): Record<string, unknown> {
	const opacity = exported ? 0 : 0.82;

	return {
		exportIndicatorBackground: {
			width: 58,
			height: 16,
			refX: '100%',
			refX2: -66,
			refY: '100%',
			refY2: -22,
			rx: 3,
			ry: 3,
			fill: theme.editorBackground,
			fillOpacity: 0.74,
			stroke: theme.noteBorder,
			strokeOpacity: 0.5,
			strokeWidth: 1,
			opacity,
			pointerEvents: 'none',
		},
		exportIndicatorLabel: {
			text: 'No export',
			refX: '100%',
			refX2: -37,
			refY: '100%',
			refY2: -10,
			textAnchor: 'middle',
			textVerticalAnchor: 'middle',
			fontSize: 9,
			fontWeight: 600,
			fill: theme.noteForeground,
			fillOpacity: 0.8,
			opacity,
			pointerEvents: 'none',
		},
	};
}

function x6Label(label: DiagramLabel, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: label.id,
		x: label.x,
		y: label.y,
		width: label.width,
		height: label.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'text', selector: 'label' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: 'transparent',
				stroke: 'none',
				strokeWidth: 0,
			},
			label: {
				text: label.text,
				fill: label.style?.text_color ?? theme.editorForeground,
				fontFamily: label.style?.font?.family ?? theme.fontFamily,
				fontSize: label.style?.font?.size ?? theme.fontSize,
				fontWeight: label.style?.font?.bold === true ? 700 : 400,
				fontStyle: label.style?.font?.italic === true ? 'italic' : 'normal',
				textAnchor: 'middle',
				textVerticalAnchor: 'middle',
				refX: '50%',
				refY: '50%',
			},
		},
		zIndex: 50,
	};
}

function x6Image(image: DiagramImage, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: image.id,
		x: image.x,
		y: image.y,
		width: image.width,
		height: image.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'image', selector: 'image' },
			{ tagName: 'rect', selector: 'border' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: theme.canvasBackground,
				stroke: 'none',
				strokeWidth: 0,
				filter: shadowFilter(image.style, false, theme),
			},
			image: {
				refWidth: '100%',
				refHeight: '100%',
				'xlink:href': image.source,
				preserveAspectRatio: 'xMidYMid meet',
			},
			border: {
				refWidth: '100%',
				refHeight: '100%',
				fill: 'transparent',
				...borderAttrs(image.style?.border, theme.nodeBorder, 0),
			},
		},
		zIndex: 10,
	};
}

function borderAttrs(
	border: ElementBorder | undefined,
	defaultColor: string,
	defaultWeight: number,
): Record<string, unknown> {
	const borderType = border?.type;
	const borderWeight = border?.weight;
	const strokeWidth = borderType === 'none' ? 0 : borderWeight ?? defaultWeight;
	const strokeDasharray = borderType === 'dotted'
		? '1 4'
		: borderType === 'dashed'
			? '3 3'
			: undefined;

	return {
		stroke: strokeWidth === 0 ? 'none' : border?.color ?? defaultColor,
		strokeWidth,
		strokeDasharray,
	};
}

function cornerRadius(style: ElementStyle | undefined, fallback: number): number {
	return style?.corner_radius ?? fallback;
}

function shadowFilter(style: ElementStyle | undefined, fallback: boolean, theme: WebviewTheme): string {
	return (style?.shadow ?? fallback)
		? `drop-shadow(3px 3px 2px ${theme.shadowColor})`
		: 'none';
}

function normalizedRoutePoints(edge: X6Edge, view: X6EdgeView | undefined): readonly CanvasPoint[] {
	if (view !== undefined) {
		return withoutRedundantPoints([
			canvasPoint(view.getTerminalConnectionPoint('source')),
			...(view.routePoints ?? []).map(canvasPoint),
			canvasPoint(view.getTerminalConnectionPoint('target')),
		]);
	}

	return withoutRedundantPoints([
		canvasPoint(edge.getSourcePoint()),
		...edge.getVertices().flatMap((point) => isPointLike(point) ? [canvasPoint(point)] : []),
		canvasPoint(edge.getTargetPoint()),
	]);
}

function edgeLabelPoint(edge: X6Edge, view: X6EdgeView | undefined, sourcePoint: CanvasPoint): CanvasPoint | undefined {
	const labelPositionValue = edge.getLabels()[0]?.position;
	const labelPosition = normalizeLabelPosition(labelPositionValue);
	if (labelPosition === undefined) {
		return undefined;
	}

	const absoluteOffsetPoint = absoluteOffsetLabelPoint(labelPosition, sourcePoint);
	if (absoluteOffsetPoint !== undefined) {
		return absoluteOffsetPoint;
	}

	if (view === undefined) {
		return undefined;
	}

	const matrix = view.getLabelTransformationMatrix(labelPosition);
	return canvasPoint({
		x: matrix.e,
		y: matrix.f,
	});
}

function normalizeLabelPosition(position: X6LabelPosition | undefined): X6LabelPosition | undefined {
	return position === undefined ? undefined : position;
}

function absoluteOffsetLabelPoint(position: X6LabelPosition, sourcePoint: CanvasPoint): CanvasPoint | undefined {
	if (typeof position === 'number') {
		return undefined;
	}

	const offset = position.offset;
	if (position.distance !== 0 || typeof offset !== 'object' || offset === null || position.options?.absoluteDistance !== true || position.options.absoluteOffset !== true) {
		return undefined;
	}

	return canvasPoint({
		x: sourcePoint.x + (offset.x ?? 0),
		y: sourcePoint.y + (offset.y ?? 0),
	});
}

function canvasPoint(point: { readonly x: number; readonly y: number }): CanvasPoint {
	return {
		x: Math.max(0, Math.round(point.x)),
		y: Math.max(0, Math.round(point.y)),
	};
}

function isPointLike(value: unknown): value is { readonly x: number; readonly y: number } {
	return typeof value === 'object'
		&& value !== null
		&& 'x' in value
		&& 'y' in value
		&& typeof value.x === 'number'
		&& typeof value.y === 'number';
}

function withoutRedundantPoints(points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	const unique = points.filter((point, index) => {
		const previous = points[index - 1];
		return previous === undefined || previous.x !== point.x || previous.y !== point.y;
	});
	if (unique.length < 3) {
		return unique;
	}

	return unique.filter((point, index) => {
		const previous = unique[index - 1];
		const next = unique[index + 1];
		return previous === undefined
			|| next === undefined
			|| !(previous.x === point.x && point.x === next.x)
				&& !(previous.y === point.y && point.y === next.y);
	});
}

function boundsUpdate(node: X6Node): BoundsUpdate {
	const position = node.position();
	const size = node.size();

	return {
		id: node.id,
		x: Math.max(0, Math.round(position.x)),
		y: Math.max(0, Math.round(position.y)),
		width: Math.round(size.width),
		height: Math.round(size.height),
	};
}

function elementRegistryEdges(registry: CanvasElementRegistry): readonly DiagramEdge[] {
	return registry.renderedElementIdentifiers().flatMap((id) => {
		const element = registry.element(id);
		return element?.kind === 'edge' ? [element.value] : [];
	});
}

function connectableElement(element: CanvasPropertyElement | undefined): ConnectableElement | undefined {
	return element?.kind === 'node' || element?.kind === 'note' || element?.kind === 'image'
		? element.value
		: undefined;
}

function movedElementDelta(element: ConnectableElement, update: BoundsUpdate | undefined): CanvasPoint | undefined {
	if (update === undefined || update.width !== element.width || update.height !== element.height) {
		return undefined;
	}

	return {
		x: update.x - element.x,
		y: update.y - element.y,
	};
}

function translateConnectableElement(element: ConnectableElement, delta: CanvasPoint): ConnectableElement {
	return {
		...element,
		x: element.x + delta.x,
		y: element.y + delta.y,
	};
}

function translateCanvasPoint(point: CanvasPoint, delta: CanvasPoint): CanvasPoint {
	return {
		x: point.x + delta.x,
		y: point.y + delta.y,
	};
}

function boundedEdgeVerticalDelta(
	route: EdgeRouteUpdate,
	sourceElement: ConnectableElement,
	targetElement: ConnectableElement,
	deltaY: number,
): CanvasPoint {
	const firstPoint = route.points[0];
	const lastPoint = route.points[route.points.length - 1];
	const minimumDeltaY = Math.max(
		...route.points.map((point) => -point.y),
		sourceElement.y - firstPoint.y,
		targetElement.y - lastPoint.y,
	);
	const maximumDeltaY = Math.min(
		sourceElement.y + sourceElement.height - firstPoint.y,
		targetElement.y + targetElement.height - lastPoint.y,
	);

	return {
		x: 0,
		y: Math.round(Math.min(Math.max(deltaY, minimumDeltaY), maximumDeltaY)),
	};
}

function canvasPointsEqual(left: CanvasPoint, right: CanvasPoint): boolean {
	return left.x === right.x && left.y === right.y;
}

function eventNode(event: Record<string, unknown>): X6Node | undefined {
	return isX6Node(event.node) ? event.node : undefined;
}

function eventEdge(event: Record<string, unknown>): X6Edge | undefined {
	if (isX6Edge(event.edge)) {
		return event.edge;
	}

	return isX6Edge(event.cell) ? event.cell : undefined;
}

function isX6Node(value: unknown): value is X6Node {
	return typeof value === 'object'
		&& value !== null
		&& 'id' in value
		&& 'position' in value
		&& 'size' in value
		&& 'resize' in value;
}

function isX6Edge(value: unknown): value is X6Edge {
	return typeof value === 'object'
		&& value !== null
		&& 'id' in value
		&& 'attr' in value
		&& 'getSourcePoint' in value
		&& 'getTargetPoint' in value
		&& 'getPolyline' in value;
}

function objectKeys(value: unknown): readonly string[] {
	return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

function cloneJsonCompatible(value: unknown): unknown {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function edgeView(graph: X6Graph, edge: X6Edge): X6EdgeView | undefined {
	const view = graph.findViewByCell?.(edge);
	return isX6EdgeView(view) ? view : undefined;
}

function isX6EdgeView(value: unknown): value is X6EdgeView {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { getTerminalConnectionPoint?: unknown }).getTerminalConnectionPoint === 'function';
}

function createTransformWidget(graph: X6Graph, node: X6Node): void {
	if (typeof graph.createTransformWidget === 'function') {
		graph.createTransformWidget(node);
		return;
	}

	const transform = graph.getPlugin?.('transform');
	if (isTransformPlugin(transform)) {
		transform.createWidget(node);
		return;
	}

	console.warn('[ontology-diagram-editor] x6 transform create API unavailable', { nodeId: node.id });
}

function clearTransformWidgets(graph: X6Graph): void {
	if (typeof graph.clearTransformWidgets === 'function') {
		graph.clearTransformWidgets();
		return;
	}

	const transform = graph.getPlugin?.('transform');
	if (isTransformPlugin(transform)) {
		transform.clearWidgets();
		return;
	}

	console.warn('[ontology-diagram-editor] x6 transform clear API unavailable');
}

function isTransformPlugin(value: unknown): value is { clearWidgets: () => void; createWidget: (node: X6Node) => void } {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { clearWidgets?: unknown }).clearWidgets === 'function'
		&& typeof (value as { createWidget?: unknown }).createWidget === 'function';
}

function eventSelectedIds(event: Record<string, unknown>): readonly string[] {
	const selected = event.selected;
	if (!Array.isArray(selected)) {
		return [];
	}

	return selected.flatMap((cell) => isX6Node(cell) || isX6Edge(cell) ? [cell.id] : []);
}

function clickedElementSelectionIds(currentIds: readonly string[], id: string, event: unknown): readonly string[] {
	if (!isAdditiveSelectionEvent(event)) {
		return [id];
	}

	return currentIds.includes(id)
		? currentIds.filter((currentId) => currentId !== id)
		: [...currentIds, id];
}

function isAdditiveSelectionEvent(event: unknown): boolean {
	if (event instanceof MouseEvent) {
		return event.ctrlKey || event.metaKey || event.shiftKey;
	}
	if (typeof event !== 'object' || event === null) {
		return false;
	}

	const keyboardState = event as { readonly ctrlKey?: unknown; readonly metaKey?: unknown; readonly shiftKey?: unknown };
	return keyboardState.ctrlKey === true || keyboardState.metaKey === true || keyboardState.shiftKey === true;
}

function resetSelection(graph: X6Graph, ids: readonly string[]): void {
	if (ids.length === 0) {
		if (typeof graph.cleanSelection === 'function') {
			graph.cleanSelection({ batch: true });
			return;
		}

		const selection = graph.getPlugin?.('selection');
		if (isSelectionPlugin(selection)) {
			selection.clean({ batch: true });
			return;
		}
	}

	if (typeof graph.resetSelection === 'function') {
		graph.resetSelection([...ids], { batch: true });
		return;
	}

	const selection = graph.getPlugin?.('selection');
	if (isSelectionPlugin(selection)) {
		selection.reset([...ids], { batch: true });
		return;
	}

	console.warn('[ontology-diagram-editor] x6 selection reset API unavailable');
}

function isSelectionPlugin(value: unknown): value is X6SelectionPlugin {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { reset?: unknown }).reset === 'function'
		&& typeof (value as { clean?: unknown }).clean === 'function';
}

function cellViewCell(value: unknown): unknown {
	return typeof value === 'object' && value !== null && 'cell' in value
		? (value as { readonly cell?: unknown }).cell
		: undefined;
}

function uniqueElementIds(ids: readonly string[]): readonly string[] {
	return [...new Set(ids)];
}

function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isMovableCanvasElement(kind: string | undefined): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image' || kind === 'label';
}

function boundedGroupDelta(cells: readonly X6Node[], delta: CanvasPoint): CanvasPoint {
	if (cells.length === 0) {
		return { x: 0, y: 0 };
	}

	const minX = Math.min(...cells.map((cell) => cell.position().x));
	const minY = Math.min(...cells.map((cell) => cell.position().y));

	return {
		x: delta.x < 0 ? Math.max(delta.x, -minX) : delta.x,
		y: delta.y < 0 ? Math.max(delta.y, -minY) : delta.y,
	};
}

function boundsDifferFromRegistry(update: BoundsUpdate, registry: CanvasElementRegistry): boolean {
	const element = registry.element(update.id);
	if (element === undefined || element.kind === 'edge') {
		return false;
	}

	return update.x !== element.value.x
		|| update.y !== element.value.y
		|| update.width !== element.value.width
		|| update.height !== element.value.height;
}

function stopEvent(value: unknown): void {
	if (typeof value === 'object' && value !== null) {
		const event = value as { preventDefault?: () => void; stopPropagation?: () => void };
		event.preventDefault?.();
		event.stopPropagation?.();
	}
}

function plainText(value: string): string {
	const document = new DOMParser().parseFromString(value, 'text/html');
	return document.body.textContent ?? value;
}
