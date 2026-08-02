import { nodeImageInset, nodeImageReservedHeight, type BoundsUpdate, type CanvasPoint, type EdgeRouteUpdate } from '../../../shared/canvas-geometry';
import { containmentHeaderHeight, containmentMovementNodeIds, createDiagramContainmentIndex, type DiagramContainmentIndex } from '../../../shared/diagram-containment';
import type { CanvasElementRegistry, CanvasPropertyElement } from '../components/canvas-element-registry';
import { nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeDataPropertyLayout, nodeTitleDisplayText, visibleNodeAttributeTextLines } from '../components/node-data-properties';
import { nodeOntologyLabel, ontologyBackgroundColor, ontologyColor, ontologyColorMode, ontologyLegendEntries, readableTextColor } from '../components/ontology-legend';
import { noteHtmlResetStyle, noteHtmlStyleAttributes, sanitizedNoteHtml } from '../components/note-html';
import { noteFoldBackground } from '../components/note-colors';
import { edgeDisplayName } from '../components/ontology-diagram-edges';
import { defaultSourceCardinalityLabel, defaultTargetCardinalityLabel, edgeCardinalityLabels } from '../components/edge-cardinality-labels';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasElementContentUpdate, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramLegendElement, DiagramMetadataElement, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { containmentColorAtDepth, type WebviewTheme } from '../webview-theme';
import type { X6Edge, X6EdgeView, X6Graph, X6Node } from './x6-browser';
import { installX6Styles } from './x6-diagram-canvas-styles';
import { noteExportIndicatorAttrs, x6Image, x6Label, x6Note } from './x6-auxiliary-cell-factories';
import { anchorFromPoint, edgeCardinalityLabelsForEdge, edgeEditTools, labelPositionForPoint, resetLabelPoint, x6Edge } from './x6-edge-cell-factory';
import { x6LegendElement, x6MetadataElement, x6OntologyNode, x6OntologyNodeBodyAttrs, x6OntologyNodeImageAttrs, x6OntologyNodeImageViewportAttrs, x6OntologyNodeMarkup, x6OntologyNodePresentation } from './x6-node-cell-factories';
import { cornerRadius } from './x6-element-appearance';
import {
	boundsDifferFromRegistry,
	boundsUpdate,
	boundedEdgeVerticalDelta,
	boundedGroupDelta,
	cellViewCell,
	clearTransformWidgets,
	clickedElementSelectionIds,
	cloneJsonCompatible,
	connectableElement,
	createTransformWidget,
	edgeLabelPoint,
	edgeLabelPointAt,
	edgeView,
	elementRegistryEdges,
	eventEdge,
	eventNode,
	eventSelectedIds,
	isMovableCanvasElement,
	isSelectionPlugin,
	isX6Edge,
	isX6Node,
	movedElementDelta,
	normalizedRoutePoints,
	numberValue,
	objectKeys,
	resetSelection,
	stopEvent,
	stringArraysEqual,
	translateCanvasPoint,
	translateConnectableElement,
	uniqueElementIds,
	canvasPointsEqual,
	withoutRedundantPoints,
} from './x6-diagram-canvas-helpers';

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
	private readonly edgeCardinalityLabelPoints = new Map<string, { readonly source?: CanvasPoint; readonly target?: CanvasPoint }>();
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
	private containmentIndex: DiagramContainmentIndex = createDiagramContainmentIndex([], []);
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
				nodeMovable: isX6Node(cellViewCell(cellView)),
				edgeMovable: false,
				edgeLabelMovable: true,
				arrowheadMovable: false,
				vertexMovable: true,
			}),
		});
		const selection = new x6.Selection({
			rubberband: true,
			rubberNode: true,
			rubberEdge: true,
			eventTypes: ['leftMouseDown'],
			modifiers: null,
			strict: true,
			multiple: true,
			multipleSelectionModifiers: ['ctrl', 'meta', 'shift'],
			movable: true,
			showNodeSelectionBox: true,
			showEdgeSelectionBox: true,
			pointerEvents: 'none',
			content: false,
			filter: (cell: unknown) => (isX6Node(cell) || isX6Edge(cell)) && this.elementRegistry.element(cell.id) !== undefined,
		});
		this.graph.use(selection);
		if (isSelectionPlugin(selection)) {
			selection.on?.('box:mouseup', () => {
				this.persistMultiSelectionMovement();
			});
		}
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
			this.edgeCardinalityLabelPoints.clear();
			this.programmaticLabelChanges.clear();
			this.selectedEdgeLineAttrs.clear();
			this.graph.clearCells();
			const diagramNodes = payload.diagram?.nodes ?? [];
			this.containmentIndex = createDiagramContainmentIndex(diagramNodes.map((node) => node.id), payload.diagram?.edges ?? []);
			for (const image of payload.diagram?.images ?? []) {
				this.graph.addNode(x6Image(image, theme));
			}
			const orderedNodes = diagramNodes
				.map((node, index) => ({ node, index }))
				.sort((left, right) =>
					(this.containmentIndex.depthByNodeId.get(left.node.id) ?? 0)
					- (this.containmentIndex.depthByNodeId.get(right.node.id) ?? 0)
					|| left.index - right.index);
			for (const { node } of orderedNodes) {
				this.graph.addNode(x6OntologyNode(node, payload, theme, {
					parentNodeId: this.containmentIndex.parentByNodeId.get(node.id),
					childNodeIds: this.containmentIndex.childrenByNodeId.get(node.id) ?? [],
					depth: this.containmentIndex.depthByNodeId.get(node.id) ?? 0,
					isContainer: this.containmentIndex.containerNodeIds.has(node.id),
				}));
			}
			for (const note of payload.diagram?.notes ?? []) {
				this.graph.addNode(x6Note(note, theme));
			}
			for (const element of payload.diagram?.metadata_elements ?? []) {
				this.graph.addNode(x6MetadataElement(element, payload, theme));
			}
			for (const element of payload.diagram?.legend_elements ?? []) {this.graph.addNode(x6LegendElement(element, payload, theme));}
			const connectableElementById = new Map<string, ConnectableElement>([
				...(payload.diagram?.nodes ?? []).map((node) => [node.id, node] as const),
				...(payload.diagram?.notes ?? []).map((note) => [note.id, note] as const),
				...(payload.diagram?.images ?? []).map((image) => [image.id, image] as const),
			]);
			for (const edge of payload.diagram?.edges ?? []) {
				if (this.containmentIndex.containmentEdgeIds.has(edge.id)) {
					continue;
				}
				this.edgeLabelPoints.set(edge.id, edge.label);
				this.edgeCardinalityLabelPoints.set(edge.id, {
					source: edge.source_cardinality_label,
					target: edge.target_cardinality_label,
				});
				this.graph.addEdge(x6Edge(edge, connectableElementById, payload, theme));
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
			this.updateOntologyNodePresentation(update.id);
		} else if (update.kind === 'nodeLabelTextOverflow' && this.elementRegistry.element(update.id)?.kind === 'node') {
			this.updateOntologyNodePresentation(update.id);
		} else if (update.kind === 'nodePropertyValueTextOverflow' && this.elementRegistry.element(update.id)?.kind === 'node') {
			this.updateOntologyNodePresentation(update.id);
		} else if (update.kind === 'nodeTypeDisplay' && this.elementRegistry.element(update.id)?.kind === 'node') {
			this.updateOntologyNodePresentation(update.id);
		}
	}

	public refreshNodePresentation(id: string): void {
		this.updateOntologyNodePresentation(id);
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

		const movementCells = this.containmentMovementCells([id]);
		this.suppressBoundsEvents = true;
		try {
			cell.position(update.x, update.y);
		} finally {
			this.suppressBoundsEvents = false;
		}
		const updates = movementCells
			.map(boundsUpdate)
			.filter((candidate) => boundsDifferFromRegistry(candidate, this.elementRegistry));
		for (const candidate of updates) {
			this.elementRegistry.updateBounds(candidate);
		}
		if (updates.some((candidate) => this.selectedIds.includes(candidate.id))) {
			this.publishSelectionChanged();
		}
		this.publishElementBounds(updates, 'move');

		return true;
	}

	public nudgeSelectedElements(delta: CanvasPoint): boolean {
		const selectedCells = this.selectedNodeCells();
		if (selectedCells.length === 0) {
			return false;
		}
		const rootCells = this.topLevelMovementCells(selectedCells);
		const movementCells = this.containmentMovementCells(selectedCells.map((cell) => cell.id));

		const adjustedDelta = boundedGroupDelta(movementCells, delta);
		if (adjustedDelta.x === 0 && adjustedDelta.y === 0) {
			return false;
		}

		this.suppressBoundsEvents = true;
		const edgeRoutes = this.internalEdgeRoutes(movementCells.map((cell) => cell.id));
		try {
			for (const cell of rootCells) {
				const position = cell.position();
				cell.position(
					Math.max(0, Math.round(position.x + adjustedDelta.x)),
					Math.max(0, Math.round(position.y + adjustedDelta.y)),
				);
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
		const updates = movementCells
			.map(boundsUpdate)
			.filter((update) => boundsDifferFromRegistry(update, this.elementRegistry));
		if (updates.length === 0) {
			return false;
		}
		for (const update of updates) {
			this.elementRegistry.updateBounds(update);
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
		const cardinalities = this.edgeCardinalityLabelPointsFor(cell, view, points);

		return {
			id: edgeId,
			points,
			label: labelPoint,
			sourceCardinalityLabel: cardinalities.source,
			targetCardinalityLabel: cardinalities.target,
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
					this.edgeCardinalityLabelPoints.delete(edge.id);
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

			const selectedIds = new Set(this.selectedIds);
			if (selectedIds.size > 1
				&& (selectedIds.has(node.id) || this.hasContainmentAncestor(node.id, selectedIds))) {
				return;
			}

			this.publishContainedNodeMovement(node);
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

	private containmentMovementCells(nodeIds: readonly string[]): readonly X6Node[] {
		return containmentMovementNodeIds(nodeIds, this.containmentIndex.childrenByNodeId).flatMap((id) => {
			const cell = this.graph.getCellById(id);
			return isX6Node(cell) ? [cell] : [];
		});
	}

	private topLevelMovementCells(cells: readonly X6Node[]): readonly X6Node[] {
		const movedIds = new Set(cells.map((cell) => cell.id));
		return cells.filter((cell) => !this.hasContainmentAncestor(cell.id, movedIds));
	}

	private hasContainmentAncestor(nodeId: string, candidateIds: ReadonlySet<string>): boolean {
		let parentId = this.containmentIndex.parentByNodeId.get(nodeId);
		while (parentId !== undefined) {
			if (candidateIds.has(parentId)) {
				return true;
			}
			parentId = this.containmentIndex.parentByNodeId.get(parentId);
		}
		return false;
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

	private publishContainedNodeMovement(node: X6Node): void {
		if (this.suppressBoundsEvents) {
			return;
		}

		const cells = this.containmentMovementCells([node.id]);
		const updates = cells
			.map(boundsUpdate)
			.filter((update) => boundsDifferFromRegistry(update, this.elementRegistry));
		if (updates.length === 0) {
			return;
		}

		for (const update of updates) {
			const cell = this.graph.getCellById(update.id);
			if (isX6Node(cell)) {
				this.restoreClampedNodePosition(cell, update);
			}
			this.elementRegistry.updateBounds(update);
		}
		if (updates.some((update) => this.selectedIds.includes(update.id))) {
			this.publishSelectionChanged();
		}
		this.publishElementBounds(updates, 'move');
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

	private internalEdgeRoutes(nodeIds: readonly string[]): readonly EdgeRouteSnapshot[] {
		const selectedIds = new Set(nodeIds);
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

	private persistMultiSelectionMovement(): void {
		if (this.selectedIds.length < 2) {
			return;
		}

		const updates = this.containmentMovementCells(this.selectedNodeCells().map((cell) => cell.id))
			.map(boundsUpdate)
			.filter((update) => boundsDifferFromRegistry(update, this.elementRegistry));
		if (updates.length > 0) {
			this.suppressBoundsEvents = true;
			try {
				for (const update of updates) {
					const cell = this.graph.getCellById(update.id);
					if (!isX6Node(cell)) {
						continue;
					}

					this.restoreClampedNodePosition(cell, update);
					this.elementRegistry.updateBounds(update);
				}
			} finally {
				this.suppressBoundsEvents = false;
			}
			this.publishSelectionChanged();
			this.publishElementBounds(updates, 'move');
		}

		for (const edge of this.selectedOrConnectedEdgeCells()) {
			this.markEdgeRouteChanged(edge);
		}
		this.flushEdgeRouteChanges();
	}

	private selectedOrConnectedEdgeCells(): readonly X6Edge[] {
		const selectedIds = new Set(this.selectedIds);
		return elementRegistryEdges(this.elementRegistry).flatMap((edge) => {
			if (!selectedIds.has(edge.id) && !selectedIds.has(edge.source) && !selectedIds.has(edge.target)) {
				return [];
			}

			const cell = this.graph.getCellById(edge.id);
			return isX6Edge(cell) ? [cell] : [];
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
		const cardinalities = this.edgeCardinalityLabelPointsFor(edge, edgeView(this.graph, edge), edgeRoute.points);
		if (cardinalities.source !== undefined) {
			this.setEdgeLabelPositionAt(edge, 1, translateCanvasPoint(cardinalities.source, delta), points[0], options);
		}
		if (cardinalities.target !== undefined) {
			const targetIndex = edgeCardinalityLabelsForEdge(edge, this.currentPayload).source === undefined ? 1 : 2;
			this.setEdgeLabelPositionAt(edge, targetIndex, translateCanvasPoint(cardinalities.target, delta), points[0], options);
		}
	}

	private setEdgeLabelPosition(edge: X6Edge, label: CanvasPoint, sourcePoint: CanvasPoint, options?: Record<string, unknown>): void {
		this.edgeLabelPoints.set(edge.id, label);
		this.setEdgeLabelPositionAt(edge, 0, label, sourcePoint, options);
	}

	private setEdgeLabelPositionAt(edge: X6Edge, index: number, label: CanvasPoint, sourcePoint: CanvasPoint, options?: Record<string, unknown>): void {
		const existingLabel = edge.getLabels()[index] ?? {};
		const view = edgeView(this.graph, edge);
		this.programmaticLabelChanges.add(edge.id);
		edge.setLabelAt(index, {
			...existingLabel,
			position: labelPositionForPoint(label, view, sourcePoint),
		}, options);
		window.setTimeout(() => {
			this.programmaticLabelChanges.delete(edge.id);
		}, 0);
	}

	private edgeCardinalityLabelPointsFor(edge: X6Edge, view: X6EdgeView | undefined, points: readonly CanvasPoint[]): { readonly source?: CanvasPoint; readonly target?: CanvasPoint } {
		const labels = edgeCardinalityLabelsForEdge(edge, this.currentPayload);
		const persisted = this.edgeCardinalityLabelPoints.get(edge.id) ?? {};
		const source = labels.source === undefined ? undefined : persisted.source ?? edgeLabelPointAt(edge, 1, view, points[0]) ?? defaultSourceCardinalityLabel(points);
		const targetIndex = labels.source === undefined ? 1 : 2;
		const target = labels.target === undefined ? undefined : persisted.target ?? edgeLabelPointAt(edge, targetIndex, view, points[0]) ?? defaultTargetCardinalityLabel(points);
		const result = { source, target };
		this.edgeCardinalityLabelPoints.set(edge.id, result);
		return result;
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

		const isContainer = this.containmentIndex.containerNodeIds.has(id);
		const containmentDepth = isContainer || this.containmentIndex.parentByNodeId.has(id)
			? this.containmentIndex.depthByNodeId.get(id) ?? 0
			: undefined;
		const presentation = x6OntologyNodePresentation(element.value, payload, this.theme, isContainer, containmentDepth);
		cell.setMarkup?.(x6OntologyNodeMarkup(presentation.markup));
		cell.attr({
			body: x6OntologyNodeBodyAttrs(
				element.value,
				payload,
				this.theme,
				cornerRadius(element.value.style, this.theme.nodeCornerRadius),
				containmentDepth,
			),
			nodeImageViewport: x6OntologyNodeImageViewportAttrs(element.value, isContainer),
			nodeImage: isContainer
				? { opacity: 0, pointerEvents: 'none' }
				: x6OntologyNodeImageAttrs(element.value, presentation.hasAttributes),
			...presentation.attrs,
		});
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
