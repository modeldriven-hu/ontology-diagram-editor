import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type EdgeRouteUpdate, type ImageBoundsUpdate, type LabelBoundsUpdate, type MetadataBoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasDragCompletedEvent } from '../../../shared/canvas-editor-events';
import { UpdateEdgeRouteCommand, UpdateElementBoundsCommand, UpdateImageBoundsCommand, UpdateLabelBoundsCommand, UpdateMetadataBoundsCommand, UpdateNodeBoundsCommand, UpdateNoteBoundsCommand } from '../../../shared/webview-commands';
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
	private readonly persistedMetadataBounds = new Map<string, MetadataBoundsUpdate>();
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

	public trackMetadataBounds(update: MetadataBoundsUpdate): void { this.persistedMetadataBounds.set(update.id, update); }
	public hasMetadata(id: string): boolean { return this.persistedMetadataBounds.has(id); }

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

	public applyElementBounds(bounds: readonly BoundsUpdate[], dragKind: BoundsDragKind): void {
		if (bounds.length === 0) {
			return;
		}

		this.suppressGeometryPersistence = true;
		try {
			this.options.canvas.restoreBounds(bounds);
		} finally {
			this.suppressGeometryPersistence = false;
		}
		this.persistChangedElementBounds(bounds, dragKind);
	}

	private persistChangedElementBounds(bounds: readonly BoundsUpdate[], dragKind: BoundsDragKind): void {
		if (this.suppressGeometryPersistence) {
			return;
		}

		const nodeUpdates: NodeBoundsUpdate[] = [];
		const noteUpdates: NoteBoundsUpdate[] = [];
		const imageUpdates: ImageBoundsUpdate[] = [];
		const labelUpdates: LabelBoundsUpdate[] = [];
		const metadataUpdates: MetadataBoundsUpdate[] = [];
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
				continue;
			}
			if (this.persistedMetadataBounds.has(update.id)) {
				metadataUpdates.push(update);
			}
		}

		const normalizedNodeUpdates = clampBoundsUpdates(nodeUpdates, minimumNodeWidth, minimumNodeHeight);
		const normalizedNoteUpdates = clampBoundsUpdates(noteUpdates, minimumNoteWidth, minimumNoteHeight);
		const normalizedImageUpdates = clampBoundsUpdates(imageUpdates, minimumImageWidth, minimumImageHeight);
		const normalizedLabelUpdates = clampBoundsUpdates(labelUpdates, minimumLabelWidth, minimumLabelHeight);
		const normalizedMetadataUpdates = clampBoundsUpdates(metadataUpdates, minimumMetadataWidth, minimumMetadataHeight);
		const normalizedUpdates = [
			...normalizedNodeUpdates,
			...normalizedNoteUpdates,
			...normalizedImageUpdates,
			...normalizedLabelUpdates,
			...normalizedMetadataUpdates,
		];
		if (normalizedUpdates.some((update) => !boundsUpdateEqual(update.normalized, update.original))) {
			this.restoreNormalizedBounds(normalizedUpdates.map((update) => update.normalized));
		}

		this.persistUpdates(
			normalizedNodeUpdates.map((update) => update.normalized),
			normalizedNoteUpdates.map((update) => update.normalized),
			normalizedImageUpdates.map((update) => update.normalized),
			normalizedLabelUpdates.map((update) => update.normalized),
			normalizedMetadataUpdates.map((update) => update.normalized),
			dragKind,
		);
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
		metadataUpdates: readonly MetadataBoundsUpdate[],
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
		for (const update of metadataUpdates) {
			this.persistedMetadataBounds.set(update.id, update);
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
		for (const update of metadataUpdates) {
			this.publishDragCompleted('metadata', update, dragKind);
		}
		if (dragKind === 'move' && nodeUpdates.length + noteUpdates.length + imageUpdates.length + labelUpdates.length + metadataUpdates.length > 1) {
			this.options.messageBus.publishCommand(new UpdateElementBoundsCommand({
				nodeUpdates,
				noteUpdates,
				imageUpdates,
				labelUpdates,
				metadataUpdates,
			}));
			return;
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
		if (metadataUpdates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateMetadataBoundsCommand(metadataUpdates));
		}
	}

	private publishDragCompleted(
		elementType: 'node' | 'note' | 'image' | 'label' | 'metadata',
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

	private restoreNormalizedBounds(updates: readonly BoundsUpdate[]): void {
		this.suppressGeometryPersistence = true;
		try {
			this.options.canvas.restoreBounds(updates);
		} finally {
			this.suppressGeometryPersistence = false;
		}
	}
}

interface NormalizedBoundsUpdate<T extends BoundsUpdate> {
	readonly original: T;
	readonly normalized: T;
}

function clampBoundsUpdates<T extends BoundsUpdate>(
	updates: readonly T[],
	minimumWidth: number,
	minimumHeight: number,
): readonly NormalizedBoundsUpdate<T>[] {
	return updates.map((update) => ({
		original: update,
		normalized: {
			...update,
			x: Math.max(0, update.x),
			y: Math.max(0, update.y),
			width: Math.max(minimumWidth, update.width),
			height: Math.max(minimumHeight, update.height),
		},
	}));
}

function boundsUpdateEqual(left: BoundsUpdate, right: BoundsUpdate): boolean {
	return left.id === right.id
		&& left.x === right.x
		&& left.y === right.y
		&& left.width === right.width
		&& left.height === right.height;
}

function edgeRoutesEqual(left: EdgeRouteUpdate, right: EdgeRouteUpdate): boolean {
	return left.points.length === right.points.length
		&& left.points.every((point, index) => point.x === right.points[index].x && point.y === right.points[index].y)
		&& left.label.x === right.label.x
		&& left.label.y === right.label.y
		&& optionalCanvasPointsEqual(left.sourceCardinalityLabel, right.sourceCardinalityLabel)
		&& optionalCanvasPointsEqual(left.targetCardinalityLabel, right.targetCardinalityLabel);
}

function optionalCanvasPointsEqual(left: { readonly x: number; readonly y: number } | undefined, right: { readonly x: number; readonly y: number } | undefined): boolean {
	return left === undefined || right === undefined
		? left === right
		: left.x === right.x && left.y === right.y;
}
