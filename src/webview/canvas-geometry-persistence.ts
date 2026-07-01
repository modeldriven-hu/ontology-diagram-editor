import { Graph, InternalEvent, Rectangle, type Cell, type EventObject } from '@maxgraph/core';

import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type EdgeRouteUpdate, type ImageBoundsUpdate, type LabelBoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../shared/canvas-geometry';
import type { WebviewMessage } from '../shared/ontology-diagram-events';
import type { CanvasEventPublisher } from './canvas-event-bus';

interface CanvasGeometryPersistenceOptions {
	readonly graph: Graph;
	readonly postMessage: (message: WebviewMessage) => void;
	readonly showStatus: (message: string) => void;
	readonly events: CanvasEventPublisher;
	readonly diagramFilePath?: string;
}

type BoundsDragKind = 'move' | 'resize';

export class CanvasGeometryPersistence {
	private readonly persistedNodeBounds = new Map<string, NodeBoundsUpdate>();
	private readonly persistedNoteBounds = new Map<string, NoteBoundsUpdate>();
	private readonly persistedImageBounds = new Map<string, ImageBoundsUpdate>();
	private readonly persistedLabelBounds = new Map<string, LabelBoundsUpdate>();
	private readonly persistedEdgeRoutes = new Map<string, EdgeRouteUpdate>();
	private readonly persistedNoteText = new Map<string, string>();
	private readonly persistedLabelText = new Map<string, string>();
	private suppressGeometryPersistence = false;

	public constructor(private readonly options: CanvasGeometryPersistenceOptions) {}

	public register(): void {
		this.options.graph.addListener(InternalEvent.CELLS_MOVED, (_sender: unknown, event: EventObject) => {
			this.persistChangedElementBounds(event.getProperty('cells'), 'move');
		});
		this.options.graph.addListener(InternalEvent.CELLS_RESIZED, (_sender: unknown, event: EventObject) => {
			this.persistChangedElementBounds(event.getProperty('cells'), 'resize');
		});
		this.options.graph.getDataModel().addListener(InternalEvent.CHANGE, (_sender: unknown, event: EventObject) => {
			this.persistChangedEdgeRoutes(event.getProperty('edit'));
		});
	}

	public trackNodeBounds(update: NodeBoundsUpdate): void {
		this.persistedNodeBounds.set(update.id, update);
	}

	public trackEdgeRoute(update: EdgeRouteUpdate): void {
		this.persistedEdgeRoutes.set(update.id, update);
	}

	public trackNote(update: NoteBoundsUpdate, text: string): void {
		this.persistedNoteBounds.set(update.id, update);
		this.persistedNoteText.set(update.id, text);
	}

	public trackImageBounds(update: ImageBoundsUpdate): void {
		this.persistedImageBounds.set(update.id, update);
	}

	public trackLabel(update: LabelBoundsUpdate, text: string): void {
		this.persistedLabelBounds.set(update.id, update);
		this.persistedLabelText.set(update.id, text);
	}

	public hasImage(id: string): boolean {
		return this.persistedImageBounds.has(id);
	}

	public hasLabel(id: string): boolean {
		return this.persistedLabelBounds.has(id);
	}

	public hasNote(id: string): boolean {
		return this.persistedNoteBounds.has(id);
	}

	public hasEdge(id: string): boolean {
		return this.persistedEdgeRoutes.has(id);
	}

	public getNoteText(id: string): string | undefined {
		return this.persistedNoteText.get(id);
	}

	public setNoteText(id: string, text: string): void {
		this.persistedNoteText.set(id, text);
	}

	public getLabelText(id: string): string | undefined {
		return this.persistedLabelText.get(id);
	}

	public setLabelText(id: string, text: string): void {
		this.persistedLabelText.set(id, text);
	}

	private persistChangedElementBounds(cells: unknown, dragKind: BoundsDragKind): void {
		if (this.suppressGeometryPersistence || !Array.isArray(cells)) {
			return;
		}

		const nodeUpdates: NodeBoundsUpdate[] = [];
		const noteUpdates: NoteBoundsUpdate[] = [];
		const imageUpdates: ImageBoundsUpdate[] = [];
		const labelUpdates: LabelBoundsUpdate[] = [];
		for (const cell of cells) {
			const nodeUpdate = this.boundsUpdate(cell, this.persistedNodeBounds);
			if (nodeUpdate !== undefined) {
				nodeUpdates.push(nodeUpdate);
				continue;
			}

			const noteUpdate = this.boundsUpdate(cell, this.persistedNoteBounds);
			if (noteUpdate !== undefined) {
				noteUpdates.push(noteUpdate);
				continue;
			}

			const imageUpdate = this.boundsUpdate(cell, this.persistedImageBounds);
			if (imageUpdate !== undefined) {
				imageUpdates.push(imageUpdate);
				continue;
			}

			const labelUpdate = this.boundsUpdate(cell, this.persistedLabelBounds);
			if (labelUpdate !== undefined) {
				labelUpdates.push(labelUpdate);
			}
		}

		const invalidNodeUpdate = nodeUpdates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
		if (invalidNodeUpdate !== undefined) {
			this.restorePersistedBounds(nodeUpdates, this.persistedNodeBounds);
			this.options.showStatus(`Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.`);
			return;
		}
		const invalidNoteUpdate = noteUpdates.find((update) => update.width < minimumNoteWidth || update.height < minimumNoteHeight);
		if (invalidNoteUpdate !== undefined) {
			this.restorePersistedBounds(noteUpdates, this.persistedNoteBounds);
			this.options.showStatus(`Notes must be at least ${minimumNoteWidth} x ${minimumNoteHeight}.`);
			return;
		}
		const invalidImageUpdate = imageUpdates.find((update) => update.width < minimumImageWidth || update.height < minimumImageHeight);
		if (invalidImageUpdate !== undefined) {
			this.restorePersistedBounds(imageUpdates, this.persistedImageBounds);
			this.options.showStatus(`Images must be at least ${minimumImageWidth} x ${minimumImageHeight}.`);
			return;
		}
		const invalidLabelUpdate = labelUpdates.find((update) => update.width < minimumLabelWidth || update.height < minimumLabelHeight);
		if (invalidLabelUpdate !== undefined) {
			this.restorePersistedBounds(labelUpdates, this.persistedLabelBounds);
			this.options.showStatus(`Labels must be at least ${minimumLabelWidth} x ${minimumLabelHeight}.`);
			return;
		}

		this.persistUpdates(nodeUpdates, noteUpdates, imageUpdates, labelUpdates, dragKind);
	}

	private persistChangedEdgeRoutes(edit: unknown): void {
		if (this.suppressGeometryPersistence || !isUndoableEdit(edit)) {
			return;
		}

		const changedEdgeIds = new Set<string>();
		for (const change of edit.changes) {
			const cell = change.cell;
			if (isGraphCell(cell)) {
				const id = cell.getId();
				if (id !== null && this.persistedEdgeRoutes.has(id)) {
					changedEdgeIds.add(id);
				}
			}
		}
		if (changedEdgeIds.size === 0) {
			return;
		}

		requestAnimationFrame(() => {
			const updates: EdgeRouteUpdate[] = [];
			for (const edgeId of changedEdgeIds) {
				const update = this.edgeRouteUpdate(edgeId);
				const persisted = this.persistedEdgeRoutes.get(edgeId);
				if (update !== undefined && persisted !== undefined && !edgeRoutesEqual(update, persisted)) {
					updates.push(update);
				}
			}
			for (const update of updates) {
				this.persistedEdgeRoutes.set(update.id, update);
			}
			if (updates.length > 0) {
				this.options.postMessage({
					type: 'updateEdgeRoute',
					updates,
				});
			}
		});
	}

	private edgeRouteUpdate(edgeId: string): EdgeRouteUpdate | undefined {
		const cell = this.options.graph.getDataModel().getCell(edgeId);
		if (cell === null) {
			return undefined;
		}

		this.options.graph.getView().validate();
		const state = this.options.graph.getView().getState(cell);
		const persisted = this.persistedEdgeRoutes.get(edgeId);
		if (state === null || persisted === undefined || state.absolutePoints.length < 2) {
			return undefined;
		}

		const points = state.absolutePoints.filter((point) => point !== null);
		if (points.length < 2) {
			return undefined;
		}

		return {
			id: edgeId,
			points: points.map((point) => graphPoint(point.x, point.y, this.options.graph)),
			label: persisted.label,
		};
	}

	private persistUpdates(
		nodeUpdates: readonly NodeBoundsUpdate[],
		noteUpdates: readonly NoteBoundsUpdate[],
		imageUpdates: readonly ImageBoundsUpdate[],
		labelUpdates: readonly LabelBoundsUpdate[],
		dragKind: BoundsDragKind,
	): void {
		for (const update of nodeUpdates) {
			this.persistedNodeBounds.set(update.id, update);
		}
		for (const update of noteUpdates) {
			this.persistedNoteBounds.set(update.id, update);
		}
		for (const update of imageUpdates) {
			this.persistedImageBounds.set(update.id, update);
		}
		for (const update of labelUpdates) {
			this.persistedLabelBounds.set(update.id, update);
		}
		for (const update of nodeUpdates) {
			this.publishDragCompleted('node', update, dragKind);
		}
		for (const update of noteUpdates) {
			this.publishDragCompleted('note', update, dragKind);
		}
		for (const update of imageUpdates) {
			this.publishDragCompleted('image', update, dragKind);
		}
		for (const update of labelUpdates) {
			this.publishDragCompleted('label', update, dragKind);
		}
		if (nodeUpdates.length > 0) {
			this.options.postMessage({
				type: 'updateNodeBounds',
				updates: nodeUpdates,
			});
		}
		if (noteUpdates.length > 0) {
			this.options.postMessage({
				type: 'updateNoteBounds',
				updates: noteUpdates,
			});
		}
		if (imageUpdates.length > 0) {
			this.options.postMessage({
				type: 'updateImageBounds',
				updates: imageUpdates,
			});
		}
		if (labelUpdates.length > 0) {
			this.options.postMessage({
				type: 'updateLabelBounds',
				updates: labelUpdates,
			});
		}
	}

	private publishDragCompleted(
		elementType: 'node' | 'note' | 'image' | 'label',
		changedBounds: BoundsUpdate,
		dragKind: BoundsDragKind,
	): void {
		this.options.events.publish({
			type: 'canvasDragCompleted',
			diagramFilePath: this.options.diagramFilePath,
			elementIdentifier: changedBounds.id,
			elementType,
			dragKind,
			changedBounds,
		});
	}

	private boundsUpdate(cell: unknown, persistedBoundsById: ReadonlyMap<string, BoundsUpdate>): BoundsUpdate | undefined {
		if (!isGraphCell(cell)) {
			return undefined;
		}

		const id = cell.getId();
		const geometry = cell.getGeometry();
		if (id === null || geometry === null || !persistedBoundsById.has(id)) {
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

	private restorePersistedBounds(updates: readonly BoundsUpdate[], persistedBoundsById: ReadonlyMap<string, BoundsUpdate>): void {
		this.suppressGeometryPersistence = true;
		try {
			for (const update of updates) {
				const persistedBounds = persistedBoundsById.get(update.id);
				const cell = this.options.graph.getDataModel().getCell(update.id);
				if (persistedBounds !== undefined && cell !== null) {
					this.options.graph.resizeCell(
						cell,
						new Rectangle(
							persistedBounds.x,
							persistedBounds.y,
							persistedBounds.width,
							persistedBounds.height,
						),
					);
				}
			}
		} finally {
			this.suppressGeometryPersistence = false;
		}
	}
}

export function isGraphCell(value: unknown): value is Cell {
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

function edgeRoutesEqual(left: EdgeRouteUpdate, right: EdgeRouteUpdate): boolean {
	return left.points.length === right.points.length
		&& left.points.every((point, index) => point.x === right.points[index].x && point.y === right.points[index].y)
		&& left.label.x === right.label.x
		&& left.label.y === right.label.y;
}
