import type { BoundsUpdate, CanvasPoint, EdgeRouteUpdate } from '../shared/canvas-geometry';
import type { CanvasElementRegistry } from './canvas-element-registry';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasElementContentUpdate, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import type { DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';
import type { X6Graph, X6Node } from './x6-browser';

type ElementBorder = NonNullable<NonNullable<DiagramNode['style']>['border']>;

export class X6DiagramCanvasEngine implements DiagramCanvasEngine {
	private readonly graph: X6Graph;
	private readonly selectionListeners = new Set<CanvasSelectionListener>();
	private readonly doubleClickListeners = new Set<CanvasDoubleClickListener>();
	private readonly boundsChangeListeners = new Set<CanvasBoundsChangeListener>();
	private readonly edgeRouteChangeListeners = new Set<CanvasEdgeRouteChangeListener>();
	private selectedId: string | undefined;
	private suppressBoundsEvents = false;
	private suppressBlankSelectionClear = false;

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
		for (const image of payload.diagram?.images ?? []) {
			this.graph.addNode(x6Image(image, theme));
		}
		for (const node of payload.diagram?.nodes ?? []) {
			this.graph.addNode(x6OntologyNode(node, theme));
		}
		for (const note of payload.diagram?.notes ?? []) {
			this.graph.addNode(x6Note(note, theme));
		}
		for (const label of payload.diagram?.labels ?? []) {
			this.graph.addNode(x6Label(label, theme));
		}
	}

	public selectedElementId(): string | undefined {
		return this.selectedId;
	}

	public selectElement(id: string): void {
		const cell = this.graph.getCellById(id);
		if (isX6Node(cell) && this.elementRegistry.element(id) !== undefined) {
			this.graph.createTransformWidget(cell);
			this.setSelectedId(id);
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
					this.elementRegistry.updateBounds(update);
					cell.position(update.x, update.y);
					cell.resize(update.width, update.height);
				}
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
	}

	public updateElementContent(update: CanvasElementContentUpdate): void {
		const cell = this.graph.getCellById(update.id);
		if (!isX6Node(cell)) {
			return;
		}

		if (update.kind === 'noteText' && this.elementRegistry.element(update.id)?.kind === 'note') {
			cell.attr('label/text', plainText(update.text));
		} else if (update.kind === 'labelText' && this.elementRegistry.element(update.id)?.kind === 'label') {
			cell.attr('label/text', update.text);
		} else if (update.kind === 'imageSource' && this.elementRegistry.element(update.id)?.kind === 'image') {
			cell.attr('image/xlink:href', update.source);
		} else if (update.kind === 'nodeImage' && this.elementRegistry.element(update.id)?.kind === 'node') {
			cell.attr('nodeImage/xlink:href', update.image ?? '');
			cell.attr('nodeImage/opacity', update.image === undefined ? 0 : 1);
			cell.attr('label/refY', update.image === undefined ? '50%' : '68%');
		}
	}

	public edgeRoute(_edgeId: string, _label: CanvasPoint): EdgeRouteUpdate | undefined {
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

			this.setSelectedId(node.id);
		});
		this.graph.on('blank:click', () => {
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
			return;
		}

		this.selectedId = id;
		this.publishSelectionChanged();
	}

	private publishNodeBounds(node: X6Node, dragKind: BoundsDragKind): void {
		if (this.suppressBoundsEvents) {
			return;
		}

		const update = boundsUpdate(node);
		this.elementRegistry.updateBounds(update);
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

function x6OntologyNode(node: DiagramNode, theme: WebviewTheme): Record<string, unknown> {
	const hasImage = node.image !== undefined && node.image.trim() !== '';

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
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: 8,
				ry: 8,
				fill: node.style?.bg_color ?? theme.nodeBackground,
				...borderAttrs(node.style?.border, theme.nodeBorder, 1),
				filter: `drop-shadow(0 2px 3px ${theme.shadowColor})`,
			},
			nodeImage: {
				width: 28,
				height: 28,
				refX: '50%',
				refX2: -14,
				refY: 10,
				'xlink:href': node.image ?? '',
				preserveAspectRatio: 'xMidYMid meet',
				pointerEvents: 'none',
				opacity: hasImage ? 1 : 0,
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
				refY: hasImage ? '68%' : '50%',
			},
		},
	};
}

function x6Note(note: DiagramNote, theme: WebviewTheme): Record<string, unknown> {
	return {
		id: note.id,
		x: note.x,
		y: note.y,
		width: note.width,
		height: note.height,
		markup: [
			{ tagName: 'rect', selector: 'body' },
			{ tagName: 'text', selector: 'label' },
		],
		attrs: {
			body: {
				refWidth: '100%',
				refHeight: '100%',
				rx: 6,
				ry: 6,
				fill: note.style?.bg_color ?? '#fff4b8',
				...borderAttrs(note.style?.border, '#d7b85d', 1),
				filter: `drop-shadow(0 2px 3px ${theme.shadowColor})`,
			},
			label: {
				text: plainText(note.text),
				fill: note.style?.text_color ?? '#3b2f00',
				fontFamily: note.style?.font?.family ?? theme.fontFamily,
				fontSize: note.style?.font?.size ?? theme.fontSize,
				fontWeight: note.style?.font?.bold === true ? 700 : 400,
				fontStyle: note.style?.font?.italic === true ? 'italic' : 'normal',
				textAnchor: 'start',
				textVerticalAnchor: 'top',
				refX: 12,
				refY: 12,
			},
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
				fill: theme.editorBackground,
				stroke: theme.nodeBorder,
				strokeWidth: 1,
				filter: `drop-shadow(0 2px 3px ${theme.shadowColor})`,
			},
			image: {
				refWidth: '100%',
				refHeight: '100%',
				'xlink:href': image.webview_src,
				preserveAspectRatio: 'xMidYMid meet',
			},
		},
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
