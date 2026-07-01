import type { BoundsUpdate, CanvasRoutePoint, EdgeRouteUpdate } from '../shared/canvas-geometry';
import type { CanvasElementRegistry } from './canvas-element-registry';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import type { DiagramNode, DiagramPayload } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';
import type { X6Graph, X6Node } from './x6-browser';

export class X6DiagramCanvasEngine implements DiagramCanvasEngine {
	private readonly graph: X6Graph;
	private readonly selectionListeners = new Set<CanvasSelectionListener>();
	private readonly doubleClickListeners = new Set<CanvasDoubleClickListener>();
	private readonly boundsChangeListeners = new Set<CanvasBoundsChangeListener>();
	private readonly edgeRouteChangeListeners = new Set<CanvasEdgeRouteChangeListener>();
	private selectedId: string | undefined;
	private suppressBoundsEvents = false;

	public constructor(
		container: HTMLElement,
		private readonly elementRegistry: CanvasElementRegistry,
		theme: WebviewTheme,
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
				edgeLabelMovable: false,
				arrowheadMovable: false,
				vertexMovable: false,
			},
		});
		this.graph.use(new x6.Selection({
			enabled: true,
			multiple: false,
			rubberband: false,
			movable: false,
			showNodeSelectionBox: true,
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
		this.registerGraphEvents();
	}

	public renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void {
		this.graph.clearCells();
		for (const node of payload.diagram?.nodes ?? []) {
			this.graph.addNode(x6Node(node, theme));
		}
	}

	public selectedElementId(): string | undefined {
		return this.selectedId;
	}

	public selectElement(id: string): void {
		const cell = this.graph.getCellById(id);
		if (cell !== undefined && this.elementRegistry.element(id)?.kind === 'node') {
			this.selectedId = id;
			this.graph.resetSelection(cell);
			this.publishSelectionChanged();
		}
	}

	public zoom(): number {
		return this.graph.zoom();
	}

	public restoreBounds(bounds: readonly BoundsUpdate[]): void {
		this.suppressBoundsEvents = true;
		try {
			for (const update of bounds) {
				const cell = this.graph.getCellById(update.id);
				if (isX6Node(cell)) {
					cell.position(update.x, update.y);
					cell.resize(update.width, update.height);
				}
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
	}

	public edgeRoute(_edgeId: string, _label: CanvasRoutePoint): EdgeRouteUpdate | undefined {
		return undefined;
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
			if (node === undefined) {
				return;
			}

			this.selectedId = node.id;
			this.graph.resetSelection(node);
			this.publishSelectionChanged();
		});
		this.graph.on('blank:click', () => {
			this.selectedId = undefined;
			this.graph.cleanSelection();
			this.publishSelectionChanged();
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
		this.graph.on('node:resized', (event) => {
			const node = eventNode(event);
			if (node === undefined) {
				return;
			}

			this.publishNodeBounds(node, 'resize');
		});
	}

	private publishSelectionChanged(): void {
		for (const listener of this.selectionListeners) {
			listener();
		}
	}

	private publishNodeBounds(node: X6Node, dragKind: BoundsDragKind): void {
		if (this.suppressBoundsEvents) {
			return;
		}

		const update = boundsUpdate(node);
		for (const listener of this.boundsChangeListeners) {
			listener({
				dragKind,
				bounds: [update],
			});
		}
	}
}

function installX6Styles(theme: WebviewTheme): void {
	const styleId = 'ontology-diagram-editor-x6-styles';
	if (document.getElementById(styleId) !== null) {
		return;
	}

	const style = document.createElement('style');
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
		'.x6-node {',
		'  cursor: move;',
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
	].join('\n');
	document.head.appendChild(style);
}

function x6Node(node: DiagramNode, theme: WebviewTheme): Record<string, unknown> {
	const borderType = node.style?.border?.type;
	const borderWeight = node.style?.border?.weight;
	const strokeWidth = borderType === 'none' ? 0 : borderWeight ?? 1;
	const lineStyle = borderType === 'dotted'
		? '1 4'
		: borderType === 'dashed'
			? '3 3'
			: undefined;

	return {
		id: node.id,
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'text', selector: 'label' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: 8,
				ry: 8,
				fill: node.style?.bg_color ?? theme.nodeBackground,
				stroke: strokeWidth === 0 ? 'none' : node.style?.border?.color ?? theme.nodeBorder,
				strokeWidth,
				strokeDasharray: lineStyle,
				filter: `drop-shadow(0 2px 3px ${theme.shadowColor})`,
			},
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
				refY: '50%',
			},
		},
	};
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

function isX6Node(value: unknown): value is X6Node {
	return typeof value === 'object'
		&& value !== null
		&& 'id' in value
		&& 'position' in value
		&& 'size' in value
		&& 'resize' in value;
}

function stopEvent(value: unknown): void {
	if (typeof value === 'object' && value !== null) {
		const event = value as { preventDefault?: () => void; stopPropagation?: () => void };
		event.preventDefault?.();
		event.stopPropagation?.();
	}
}

function nodeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}
