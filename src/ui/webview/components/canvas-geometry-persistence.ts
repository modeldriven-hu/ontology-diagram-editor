import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type EdgeRouteUpdate, type ImageBoundsUpdate, type LabelBoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasDragCompletedEvent } from '../../../shared/canvas-editor-events';
import { UpdateEdgeRouteCommand, UpdateImageBoundsCommand, UpdateLabelBoundsCommand, UpdateNodeBoundsCommand, UpdateNoteBoundsCommand } from '../../../shared/webview-commands';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import type { BoundsDragKind, DiagramCanvasEngine } from '../engine/diagram-canvas-engine';

interface CanvasGeometryPersistenceOptions {
	readonly canvas: DiagramCanvasEngine;
	readonly showStatus: (message: string) => void;
	readonly messageBus: CanvasMessageBus;
	readonly diagramFilePath?: string;
}

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
		this.options.canvas.onElementBoundsChanged((change) => {
			this.persistChangedElementBounds(change.bounds, change.dragKind);
		});
		this.options.canvas.onEdgeRouteChanged((edgeIds) => {
			this.persistChangedEdgeRoutes(edgeIds);
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

	private persistChangedElementBounds(bounds: readonly BoundsUpdate[], dragKind: BoundsDragKind): void {
		if (this.suppressGeometryPersistence) {
			return;
		}

		const nodeUpdates: NodeBoundsUpdate[] = [];
		const noteUpdates: NoteBoundsUpdate[] = [];
		const imageUpdates: ImageBoundsUpdate[] = [];
		const labelUpdates: LabelBoundsUpdate[] = [];
		for (const update of bounds) {
			if (this.persistedNodeBounds.has(update.id)) {
				nodeUpdates.push(update);
				continue;
			}

			if (this.persistedNoteBounds.has(update.id)) {
				noteUpdates.push(update);
				continue;
			}

			if (this.persistedImageBounds.has(update.id)) {
				imageUpdates.push(update);
				continue;
			}

			if (this.persistedLabelBounds.has(update.id)) {
				labelUpdates.push(update);
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

	private persistChangedEdgeRoutes(edgeIds: readonly string[]): void {
		if (this.suppressGeometryPersistence) {
			return;
		}

		const updates: EdgeRouteUpdate[] = [];
		for (const edgeId of edgeIds) {
			const persisted = this.persistedEdgeRoutes.get(edgeId);
			if (persisted === undefined) {
				continue;
			}
			const update = this.options.canvas.edgeRoute(edgeId, persisted.label);
			if (update !== undefined && !edgeRoutesEqual(update, persisted)) {
				updates.push(update);
			}
		}
		for (const update of updates) {
			this.persistedEdgeRoutes.set(update.id, update);
		}
		if (updates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateEdgeRouteCommand(updates));
		}
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
			this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand(nodeUpdates));
		}
		if (noteUpdates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateNoteBoundsCommand(noteUpdates));
		}
		if (imageUpdates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateImageBoundsCommand(imageUpdates));
		}
		if (labelUpdates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateLabelBoundsCommand(labelUpdates));
		}
	}

	private publishDragCompleted(
		elementType: 'node' | 'note' | 'image' | 'label',
		changedBounds: BoundsUpdate,
		dragKind: BoundsDragKind,
	): void {
		this.options.messageBus.publishEvent(new CanvasDragCompletedEvent({
			diagramFilePath: this.options.diagramFilePath,
			elementIdentifier: changedBounds.id,
			elementType,
			dragKind,
			changedBounds,
		}));
	}

	private restorePersistedBounds(updates: readonly BoundsUpdate[], persistedBoundsById: ReadonlyMap<string, BoundsUpdate>): void {
		this.suppressGeometryPersistence = true;
		try {
			this.options.canvas.restoreBounds(updates.flatMap((update) => {
				const persistedBounds = persistedBoundsById.get(update.id);
				return persistedBounds === undefined ? [] : [persistedBounds];
			}));
		} finally {
			this.suppressGeometryPersistence = false;
		}
	}
}

function edgeRoutesEqual(left: EdgeRouteUpdate, right: EdgeRouteUpdate): boolean {
	return left.points.length === right.points.length
		&& left.points.every((point, index) => point.x === right.points[index].x && point.y === right.points[index].y)
		&& left.label.x === right.label.x
		&& left.label.y === right.label.y;
}
