import { Graph, HandleConfig, InternalEvent, Point, Rectangle, StyleDefaultsConfig, VertexHandlerConfig, type Cell, type CellState, type EventObject, type SelectionHandler } from '@maxgraph/core';

import type { BoundsUpdate, CanvasRoutePoint, EdgeRouteUpdate } from '../shared/canvas-geometry';
import type { CanvasElementRegistry } from './canvas-element-registry';
import type { BoundsDragKind, CanvasBoundsChangeListener, CanvasDoubleClickListener, CanvasEdgeRouteChangeListener, CanvasElementContentUpdate, CanvasSelectionListener, DiagramCanvasEngine } from './diagram-canvas-engine';
import { insertEdge } from './ontology-diagram-edges';
import { imageVertex } from './ontology-diagram-images';
import { labelVertex } from './ontology-diagram-labels';
import { nodeVertex } from './ontology-diagram-nodes';
import { noteVertex } from './ontology-diagram-notes';
import type { DiagramPayload } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';

export class MaxGraphDiagramCanvasEngine implements DiagramCanvasEngine {
	private readonly graph: Graph;
	private readonly selectionListeners = new Set<CanvasSelectionListener>();
	private readonly doubleClickListeners = new Set<CanvasDoubleClickListener>();
	private readonly boundsChangeListeners = new Set<CanvasBoundsChangeListener>();
	private readonly edgeRouteChangeListeners = new Set<CanvasEdgeRouteChangeListener>();
	private suppressBoundsEvents = false;

	public constructor(
		container: HTMLElement,
		private readonly elementRegistry: CanvasElementRegistry,
		theme: WebviewTheme,
	) {
		this.graph = new Graph(container);
		this.configureGraph(theme);
		this.registerGraphEvents();
	}

	public renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void {
		const nodes = payload.diagram?.nodes ?? [];
		const edges = payload.diagram?.edges ?? [];
		const notes = payload.diagram?.notes ?? [];
		const images = payload.diagram?.images ?? [];
		const labels = payload.diagram?.labels ?? [];

		this.graph.batchUpdate(() => {
			for (const node of nodes) {
				const vertex = nodeVertex(node, theme);
				this.graph.insertVertex(
					this.graph.getDefaultParent(),
					vertex.id,
					vertex.value,
					vertex.position[0],
					vertex.position[1],
					vertex.size[0],
					vertex.size[1],
					vertex.style,
				);
			}
			for (const edge of edges) {
				insertEdge(this.graph, edge, theme);
			}
			for (const note of notes) {
				const vertex = noteVertex(note, theme);
				this.graph.insertVertex(
					this.graph.getDefaultParent(),
					vertex.id,
					vertex.value,
					vertex.position[0],
					vertex.position[1],
					vertex.size[0],
					vertex.size[1],
					vertex.style,
				);
			}
			for (const label of labels) {
				const vertex = labelVertex(label, theme);
				this.graph.insertVertex(
					this.graph.getDefaultParent(),
					vertex.id,
					vertex.value,
					vertex.position[0],
					vertex.position[1],
					vertex.size[0],
					vertex.size[1],
					vertex.style,
				);
			}
			for (const image of images) {
				const vertex = imageVertex(image, theme);
				this.graph.insertVertex(
					this.graph.getDefaultParent(),
					vertex.id,
					vertex.value,
					vertex.position[0],
					vertex.position[1],
					vertex.size[0],
					vertex.size[1],
					vertex.style,
				);
			}
		});
	}

	public selectedElementId(): string | undefined {
		return elementId(this.graph.getSelectionCell());
	}

	public selectElement(id: string): void {
		const selectedCell = this.graph.getDataModel().getCell(id);
		if (selectedCell !== null) {
			this.graph.setSelectionCell(selectedCell);
		}
	}

	public zoom(): number {
		return this.graph.getView().getScale();
	}

	public restoreBounds(bounds: readonly BoundsUpdate[]): void {
		this.suppressBoundsEvents = true;
		try {
			for (const update of bounds) {
				const cell = this.graph.getDataModel().getCell(update.id);
				if (cell !== null) {
					this.graph.resizeCell(
						cell,
						new Rectangle(update.x, update.y, update.width, update.height),
					);
				}
			}
		} finally {
			this.suppressBoundsEvents = false;
		}
	}

	public updateElementContent(_update: CanvasElementContentUpdate): void {
	}

	public edgeRoute(edgeId: string, label: CanvasRoutePoint): EdgeRouteUpdate | undefined {
		const cell = this.graph.getDataModel().getCell(edgeId);
		if (cell === null) {
			return undefined;
		}

		this.graph.getView().validate();
		const state = this.graph.getView().getState(cell);
		if (state === null || state.absolutePoints.length < 2) {
			return undefined;
		}

		const points = state.absolutePoints.filter((point) => point !== null);
		if (points.length < 2) {
			return undefined;
		}

		return {
			id: edgeId,
			points: points.map((point) => graphPoint(point.x, point.y, this.graph)),
			label,
		};
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

	private configureGraph(theme: WebviewTheme): void {
		VertexHandlerConfig.selectionColor = theme.focusBorder;
		VertexHandlerConfig.selectionStrokeWidth = 2;
		VertexHandlerConfig.selectionDashed = false;
		VertexHandlerConfig.cursorMovable = 'move';
		HandleConfig.fillColor = theme.editorBackground;
		HandleConfig.strokeColor = theme.focusBorder;
		HandleConfig.size = 7;
		StyleDefaultsConfig.shadowColor = theme.shadowColor;
		StyleDefaultsConfig.shadowOffsetX = 0;
		StyleDefaultsConfig.shadowOffsetY = 2;
		StyleDefaultsConfig.shadowOpacity = 0.18;

		const selectionHandler = this.graph.getPlugin<SelectionHandler>('SelectionHandler');
		if (selectionHandler !== undefined) {
			selectionHandler.previewColor = theme.focusBorder;
		}

		this.graph.setHtmlLabels(true);
		this.graph.setPanning(true);
		this.graph.setCellsCloneable(false);
		this.graph.setCellsDeletable(false);
		this.graph.setCellsDisconnectable(true);
		this.graph.setCellsEditable(false);
		this.graph.setCellsBendable(false);
		this.graph.setConnectable(false);
		this.graph.setAllowDanglingEdges(false);
		this.graph.setTooltips(true);
		this.graph.setCellsResizable(true);
		this.graph.setCellsMovable(true);
		this.restrictEdgeEndpointEditing();
	}

	private registerGraphEvents(): void {
		this.graph.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
			for (const listener of this.selectionListeners) {
				listener();
			}
		});
		this.graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: unknown, event: EventObject) => {
			const id = elementId(event.getProperty('cell'));
			if (id === undefined) {
				return;
			}

			for (const listener of this.doubleClickListeners) {
				if (listener(id)) {
					event.consume();
					return;
				}
			}
		});
		this.graph.addListener(InternalEvent.CELLS_MOVED, (_sender: unknown, event: EventObject) => {
			this.publishChangedElementBounds(event.getProperty('cells'), 'move');
		});
		this.graph.addListener(InternalEvent.CELLS_RESIZED, (_sender: unknown, event: EventObject) => {
			this.publishChangedElementBounds(event.getProperty('cells'), 'resize');
		});
		this.graph.getDataModel().addListener(InternalEvent.CHANGE, (_sender: unknown, event: EventObject) => {
			this.publishChangedEdgeRoutes(event.getProperty('edit'));
		});
	}

	private publishChangedElementBounds(cells: unknown, dragKind: BoundsDragKind): void {
		if (this.suppressBoundsEvents || !Array.isArray(cells)) {
			return;
		}

		const bounds = cells
			.map((cell) => boundsUpdate(cell))
			.filter((update) => update !== undefined);
		if (bounds.length === 0) {
			return;
		}

		for (const listener of this.boundsChangeListeners) {
			listener({ dragKind, bounds });
		}
	}

	private publishChangedEdgeRoutes(edit: unknown): void {
		if (!isUndoableEdit(edit)) {
			return;
		}

		const edgeIds = new Set<string>();
		for (const change of edit.changes) {
			const id = elementId(change.cell);
			if (id !== undefined && this.elementRegistry.element(id)?.kind === 'edge') {
				edgeIds.add(id);
			}
		}
		if (edgeIds.size === 0) {
			return;
		}

		requestAnimationFrame(() => {
			for (const listener of this.edgeRouteChangeListeners) {
				listener([...edgeIds]);
			}
		});
	}

	private restrictEdgeEndpointEditing(): void {
		const createEdgeHandler = this.graph.createEdgeHandler.bind(this.graph);
		this.graph.createEdgeHandler = (state, edgeStyle) => {
			const handler = createEdgeHandler(state, edgeStyle);
			const id = elementId(state.cell);
			const element = id === undefined ? undefined : this.elementRegistry.element(id);
			if (element?.kind === 'edge') {
				handler.outlineConnect = true;
				handler.snapToTerminals = false;
				const getPreviewTerminalState = handler.getPreviewTerminalState.bind(handler);
				handler.getPreviewTerminalState = (me) => {
					const terminalId = handler.isSource ? element.value.source : handler.isTarget ? element.value.target : undefined;
					if (terminalId === undefined || handler.currentPoint === null) {
						return getPreviewTerminalState(me);
					}

					const terminal = this.graph.getDataModel().getCell(terminalId);
					const terminalState = terminal === null ? null : this.graph.getView().getState(terminal);
					if (terminalState === null) {
						return getPreviewTerminalState(me);
					}

					const anchor = projectedBoundaryPoint(terminalState, handler.currentPoint);
					handler.constraintHandler.setFocus(me, terminalState, handler.isSource);
					handler.constraintHandler.currentFocus = terminalState;
					handler.constraintHandler.currentConstraint = this.graph.getOutlineConstraint(anchor, terminalState, me);
					handler.constraintHandler.currentPoint = anchor;
					handler.error = null;

					return terminalState;
				};
				handler.isCellEnabled = (cell) => {
					const candidateId = elementId(cell);
					if (handler.isSource) {
						return candidateId === element.value.source;
					}
					if (handler.isTarget) {
						return candidateId === element.value.target;
					}

					return true;
				};
				handler.validateConnection = (source, target) => {
					return elementId(source) === element.value.source && elementId(target) === element.value.target ? null : '';
				};
			}

			return handler;
		};
	}
}

function boundsUpdate(cell: unknown): BoundsUpdate | undefined {
	if (!isGraphCell(cell)) {
		return undefined;
	}

	const id = cell.getId();
	const geometry = cell.getGeometry();
	if (id === null || geometry === null) {
		return undefined;
	}

	return {
		id,
		x: Math.max(0, Math.round(geometry.x)),
		y: Math.max(0, Math.round(geometry.y)),
		width: Math.round(geometry.width),
		height: Math.round(geometry.height),
	};
}

function projectedBoundaryPoint(terminalState: CellState, point: Point): Point {
	const centerX = terminalState.x + terminalState.width / 2;
	const centerY = terminalState.y + terminalState.height / 2;
	const deltaX = point.x - centerX;
	const deltaY = point.y - centerY;
	const halfWidth = terminalState.width / 2;
	const halfHeight = terminalState.height / 2;
	if (halfWidth <= 0 || halfHeight <= 0) {
		return new Point(centerX, centerY);
	}
	if (deltaX === 0 && deltaY === 0) {
		return new Point(centerX + halfWidth, centerY);
	}

	const widthScale = deltaX === 0 ? Number.POSITIVE_INFINITY : halfWidth / Math.abs(deltaX);
	const heightScale = deltaY === 0 ? Number.POSITIVE_INFINITY : halfHeight / Math.abs(deltaY);
	const scale = Math.min(widthScale, heightScale);

	return new Point(centerX + deltaX * scale, centerY + deltaY * scale);
}

function elementId(cell: unknown): string | undefined {
	if (!isGraphCell(cell)) {
		return undefined;
	}

	return cell.getId() ?? undefined;
}

function isGraphCell(value: unknown): value is Cell {
	return typeof value === 'object'
		&& value !== null
		&& 'getId' in value
		&& 'getGeometry' in value;
}

function isUndoableEdit(value: unknown): value is { readonly changes: readonly { readonly cell?: unknown }[] } {
	return typeof value === 'object'
		&& value !== null
		&& 'changes' in value
		&& Array.isArray((value as { readonly changes: unknown }).changes);
}

function graphPoint(x: number, y: number, graph: Graph): { readonly x: number; readonly y: number } {
	const view = graph.getView();
	return {
		x: Math.max(0, Math.round(x / view.getScale() - view.getTranslate().x)),
		y: Math.max(0, Math.round(y / view.getScale() - view.getTranslate().y)),
	};
}
