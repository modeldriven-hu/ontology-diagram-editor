import type { BoundsUpdate, CanvasPoint, EdgeRouteUpdate } from '../../../shared/canvas-geometry';
import type { CanvasElementRegistry } from '../components/canvas-element-registry';
import { nodeDataPropertyAttributes, nodeDataPropertyLayout, truncateText } from '../components/node-data-properties';
import { noteHtmlResetStyle, noteHtmlStyleAttributes, sanitizedNoteHtml } from '../components/note-html';
import { edgeDisplayName } from '../components/ontology-diagram-edges';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasElementContentUpdate, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';
import type { X6Edge, X6EdgeView, X6Graph, X6LabelPosition, X6Node } from './x6-browser';

type ElementBorder = NonNullable<NonNullable<DiagramNode['style']>['border']>;
type ElementStyle = NonNullable<DiagramNode['style']>;
type EdgeLineStyle = NonNullable<DiagramEdge['style']>['line_style'];

export class X6DiagramCanvasEngine implements DiagramCanvasEngine {
	private readonly graph: X6Graph;
	private readonly selectionListeners = new Set<CanvasSelectionListener>();
	private readonly doubleClickListeners = new Set<CanvasDoubleClickListener>();
	private readonly boundsChangeListeners = new Set<CanvasBoundsChangeListener>();
	private readonly edgeRouteChangeListeners = new Set<CanvasEdgeRouteChangeListener>();
	private readonly pendingEdgeRouteChanges = new Set<string>();
	private selectedId: string | undefined;
	private suppressBoundsEvents = false;
	private suppressEdgeRouteEvents = false;
	private suppressBlankSelectionClear = false;
	private edgeRoutePublishTimer: number | undefined;
	private labelDragHighlight: { readonly edgeId: string; readonly lineAttrs: unknown } | undefined;
	private currentPayload?: DiagramPayload;

	public constructor(
		container: HTMLElement,
		private readonly elementRegistry: CanvasElementRegistry,
		private theme: WebviewTheme,
	) {
		const x6 = window.X6;
		if (x6 === undefined) {
			throw new Error('X6 browser bundle was not loaded.');
		}

		installX6Styles(theme);
		this.graph = new x6.Graph({
			container,
			width: Math.max(container.clientWidth, 1800),
			height: Math.max(container.clientHeight, 1200),
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
			interacting: {
				nodeMovable: true,
				edgeMovable: false,
				edgeLabelMovable: true,
				arrowheadMovable: false,
				vertexMovable: true,
			},
		});
		this.graph.use(new x6.Transform({
			resizing: {
				enabled: true,
				minWidth: 1,
				minHeight: 1,
				orthogonal: true,
			},
			rotating: false,
		}));
		this.registerGraphEvents();
	}

	public renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void {
		this.theme = theme;
		this.currentPayload = payload;
		installX6Styles(theme);
		this.suppressEdgeRouteEvents = true;
		try {
			this.clearPendingEdgeRouteChanges();
			this.graph.clearCells();
			for (const image of payload.diagram?.images ?? []) {
				this.graph.addNode(x6Image(image, theme));
			}
			for (const node of payload.diagram?.nodes ?? []) {
				this.graph.addNode(x6OntologyNode(node, payload, theme));
			}
			const nodeById = new Map((payload.diagram?.nodes ?? []).map((node) => [node.id, node]));
			for (const edge of payload.diagram?.edges ?? []) {
				this.graph.addEdge(x6Edge(edge, nodeById, theme));
			}
			for (const note of payload.diagram?.notes ?? []) {
				this.graph.addNode(x6Note(note, theme));
			}
			for (const label of payload.diagram?.labels ?? []) {
				this.graph.addNode(x6Label(label, theme));
			}
		} finally {
			this.suppressEdgeRouteEvents = false;
		}
	}

	public selectedElementId(): string | undefined {
		return this.selectedId;
	}

	public selectElement(id: string): void {
		console.log('[ontology-diagram-editor] canvas selectElement requested', { id });
		const cell = this.graph.getCellById(id);
		if (isX6Node(cell) && this.elementRegistry.element(id) !== undefined) {
			console.log('[ontology-diagram-editor] canvas selectElement resolved node', { id });
			createTransformWidget(this.graph, cell);
			this.setSelectedId(id);
		}
		if (isX6Edge(cell) && this.elementRegistry.element(id) !== undefined) {
			console.log('[ontology-diagram-editor] canvas selectElement resolved edge', { id });
			clearTransformWidgets(this.graph);
			cell.setTools(edgeEditTools());
			this.setSelectedId(id);
		}
		if (cell === undefined) {
			console.warn('[ontology-diagram-editor] canvas selectElement missing cell', { id });
		}
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
		if (this.selectedId === id) {
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
		} else if (update.kind === 'labelText' && this.elementRegistry.element(update.id)?.kind === 'label') {
			cell.attr('label/text', update.text);
		} else if (update.kind === 'imageSource' && this.elementRegistry.element(update.id)?.kind === 'image') {
			cell.attr('image/xlink:href', update.source);
		} else if (update.kind === 'nodeImage' && this.elementRegistry.element(update.id)?.kind === 'node') {
			const hasAttributeSection = cell.attr('separator/refY') !== undefined;
			cell.attr('nodeImage/xlink:href', update.image ?? '');
			cell.attr('nodeImage/opacity', update.image === undefined ? 0 : 1);
			if (!hasAttributeSection) {
				cell.attr('label/refY', update.image === undefined ? '50%' : '68%');
			}
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
		if (this.selectedId === id) {
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

		return {
			id: edgeId,
			points,
			label: edgeLabelPoint(cell, view) ?? label,
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
		const currentLabel = edgeLabelPoint(cell, view) ?? resetLabelPoint(points);

		const nextLabel = {
			x: Math.max(0, currentLabel.x + delta.x),
			y: Math.max(0, currentLabel.y + delta.y),
		};
		const existingLabel = cell.getLabels()[0] ?? {};
		cell.setLabelAt(0, {
			...existingLabel,
			position: labelPosition(nextLabel, points[0]),
		});
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
		const existingLabel = cell.getLabels()[0] ?? {};
		cell.setLabelAt(0, {
			...existingLabel,
			position: labelPosition(label, points[0]),
		});
		this.clearLabelDragHighlight(cell.id);
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

			this.setSelectedId(node.id);
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
			clearTransformWidgets(this.graph);
			edge.setTools(edgeEditTools());
			this.setSelectedId(edge.id);
		});
		this.graph.on('edge:label:click', (event) => {
			const edge = eventEdge(event);
			if (edge === undefined) {
				return;
			}

			stopEvent(event.e);
			clearTransformWidgets(this.graph);
			edge.setTools(edgeEditTools());
			this.setSelectedId(edge.id);
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
			this.highlightLabelDragEdge(edge);
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

			this.setSelectedId(undefined);
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

	private setSelectedId(id: string | undefined): void {
		if (this.selectedId === id) {
			console.log('[ontology-diagram-editor] canvas selection unchanged', { id });
			return;
		}

		console.log('[ontology-diagram-editor] canvas selection changed', {
			from: this.selectedId,
			to: id,
			elementType: id === undefined ? undefined : this.elementRegistry.elementType(id),
		});
		this.removeEdgeTools(this.selectedId);
		this.selectedId = id;
		this.publishSelectionChanged();
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

	private publishNodeBounds(node: X6Node, dragKind: BoundsDragKind): void {
		if (this.suppressBoundsEvents) {
			return;
		}

		const update = boundsUpdate(node);
		this.elementRegistry.updateBounds(update);
		if (dragKind === 'resize') {
			this.updateOntologyNodePresentation(node.id);
		}
		if (this.selectedId === node.id) {
			this.publishSelectionChanged();
		}
		for (const listener of this.boundsChangeListeners) {
			listener({
				dragKind,
				bounds: [update],
			});
		}
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

		cell.attr(x6OntologyNodePresentation(element.value, payload, this.theme).attrs);
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
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'image', selector: 'nodeImage' },
			{ tagName: 'text', selector: 'label' },
			...presentation.markup,
		],
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

function x6OntologyNodePresentation(node: DiagramNode, payload: DiagramPayload, theme: WebviewTheme): {
	readonly hasAttributes: boolean;
	readonly markup: readonly Record<string, string>[];
	readonly attrs: Record<string, unknown>;
} {
	const hasImage = node.image !== undefined && node.image.trim() !== '';
	const attributes = nodeDataPropertyAttributes(node, payload);
	const hasAttributes = attributes.length > 0;
	const layout = nodeDataPropertyLayout({
		nodeHeight: node.height,
		fontSize: node.style?.font?.size ?? theme.fontSize,
		attributeCount: attributes.length,
	});
	const displayAttributeTexts = [
		...attributes.slice(0, layout.visibleAttributeCount).map((attribute) => attribute.text),
		...(layout.showOverflowIndicator ? ['...'] : []),
	];
	const attributeLineCount = hasAttributes ? attributes.length + 1 : 0;
	const attributeAttrs = Object.fromEntries([...Array(attributeLineCount).keys()].map((index) => [
		`attribute${index}`,
		{
			text: displayAttributeTexts[index] === undefined ? '' : truncateText({
				text: displayAttributeTexts[index],
				width: node.width - 20,
				fontSize: layout.attributeFontSize,
				fontFamily: node.style?.font?.family ?? theme.fontFamily,
				italic: node.style?.font?.italic,
			}),
			opacity: displayAttributeTexts[index] === undefined ? 0 : 1,
			fill: node.style?.text_color ?? theme.editorForeground,
			fontFamily: node.style?.font?.family ?? theme.fontFamily,
			fontSize: layout.attributeFontSize,
			fontWeight: 400,
			fontStyle: node.style?.font?.italic === true ? 'italic' : 'normal',
			textAnchor: 'start',
			textVerticalAnchor: 'middle',
			refX: 10,
			refY: layout.headerHeight + 12 + (index * layout.attributeLineHeight),
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
				text: nodeDisplayName(node.ontology_ref),
				fill: node.style?.text_color ?? theme.editorForeground,
				fontFamily: node.style?.font?.family ?? theme.fontFamily,
				fontSize: node.style?.font?.size ?? theme.fontSize,
				fontWeight: node.style?.font?.bold === true ? 700 : 400,
				fontStyle: node.style?.font?.italic === true ? 'italic' : 'normal',
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

function x6Edge(edge: DiagramEdge, nodeById: ReadonlyMap<string, DiagramNode>, theme: WebviewTheme): Record<string, unknown> {
	const persistedPoints = edge.points.length >= 2 ? edge.points : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
	const points = orthogonalDisplayPoints(persistedPoints);
	const sourcePoint = points[0];
	const targetPoint = points[points.length - 1];
	const sourceNode = nodeById.get(edge.source);
	const targetNode = nodeById.get(edge.target);
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = lineStyle === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? theme.edgeColor;
	const label = edgeDisplayName(edge.ontology_ref);

	return {
		id: edge.id,
		shape: 'edge',
		source: sourceNode === undefined ? sourcePoint : {
			cell: edge.source,
			anchor: anchorFromPoint(sourcePoint, sourceNode),
		},
		target: targetNode === undefined ? targetPoint : {
			cell: edge.target,
			anchor: anchorFromPoint(targetPoint, targetNode),
		},
		vertices: points.slice(1, -1),
		attrs: {
			line: {
				stroke,
				strokeWidth,
				strokeDasharray: edgeDashArray(lineStyle, strokeWidth),
				targetMarker: edgeTargetMarker(edge, stroke, strokeWidth, theme),
			},
		},
		labels: [{
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

function resetLabelPoint(points: readonly CanvasPoint[]): CanvasPoint {
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
					snapRadius: 20,
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
		snapRadius: 20,
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

function anchorFromPoint(point: CanvasPoint, node: DiagramNode): Record<string, unknown> {
	return {
		name: 'topLeft',
		args: {
			dx: percentage(point.x - node.x, node.width),
			dy: percentage(point.y - node.y, node.height),
			rotate: true,
		},
	};
}

function percentage(value: number, size: number): string {
	if (size === 0) {
		return '0%';
	}

	return `${Math.round((value / size) * 100)}%`;
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

function x6Note(note: DiagramNote, theme: WebviewTheme): Record<string, unknown> {
	const radius = cornerRadius(note.style, theme.noteCornerRadius);

	return {
		id: note.id,
		x: note.x,
		y: note.y,
		width: note.width,
		height: note.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'path', selector: 'foldedCorner' },
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
				fill: note.style?.bg_color ?? theme.noteBackground,
				...borderAttrs(note.style?.border, theme.noteBorder, 1),
				filter: shadowFilter(note.style, theme.elementShadow, theme),
			},
			foldedCorner: {
				d: 'M 0 0 L 14 0 L 14 14 Z',
				refX: '100%',
				refX2: -14,
				refY: 0,
				fill: theme.noteFoldBackground,
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
		},
		zIndex: 40,
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
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				fill: theme.canvasBackground,
				stroke: theme.nodeBorder,
				strokeWidth: 1,
				filter: theme.elementShadow ? `drop-shadow(3px 3px 2px ${theme.shadowColor})` : 'none',
			},
			image: {
				refWidth: '100%',
				refHeight: '100%',
				'xlink:href': image.webview_src,
				preserveAspectRatio: 'xMidYMid meet',
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

function edgeLabelPoint(edge: X6Edge, view: X6EdgeView | undefined): CanvasPoint | undefined {
	if (view === undefined) {
		return undefined;
	}

	const labelPositionValue = edge.getLabels()[0]?.position;
	const labelPosition = normalizeLabelPosition(labelPositionValue);
	if (labelPosition === undefined) {
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

function nodeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}
