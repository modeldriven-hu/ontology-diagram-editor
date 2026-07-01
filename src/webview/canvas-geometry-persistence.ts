import { Graph, InternalEvent, Rectangle, type Cell, type EventObject } from '@maxgraph/core';

import { minimumImageHeight, minimumImageWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type ImageBoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../shared/canvas-geometry';
import type { WebviewMessage } from '../shared/ontology-diagram-events';

interface CanvasGeometryPersistenceOptions {
	readonly graph: Graph;
	readonly postMessage: (message: WebviewMessage) => void;
	readonly showStatus: (message: string) => void;
}

export class CanvasGeometryPersistence {
	private readonly persistedNodeBounds = new Map<string, NodeBoundsUpdate>();
	private readonly persistedNoteBounds = new Map<string, NoteBoundsUpdate>();
	private readonly persistedImageBounds = new Map<string, ImageBoundsUpdate>();
	private readonly persistedNoteText = new Map<string, string>();
	private suppressGeometryPersistence = false;

	public constructor(private readonly options: CanvasGeometryPersistenceOptions) {}

	public register(): void {
		this.options.graph.addListener(InternalEvent.CELLS_MOVED, (_sender: unknown, event: EventObject) => {
			this.persistChangedElementBounds(event.getProperty('cells'));
		});
		this.options.graph.addListener(InternalEvent.CELLS_RESIZED, (_sender: unknown, event: EventObject) => {
			this.persistChangedElementBounds(event.getProperty('cells'));
		});
	}

	public trackNodeBounds(update: NodeBoundsUpdate): void {
		this.persistedNodeBounds.set(update.id, update);
	}

	public trackNote(update: NoteBoundsUpdate, text: string): void {
		this.persistedNoteBounds.set(update.id, update);
		this.persistedNoteText.set(update.id, text);
	}

	public trackImageBounds(update: ImageBoundsUpdate): void {
		this.persistedImageBounds.set(update.id, update);
	}

	public hasNote(id: string): boolean {
		return this.persistedNoteBounds.has(id);
	}

	public getNoteText(id: string): string | undefined {
		return this.persistedNoteText.get(id);
	}

	public setNoteText(id: string, text: string): void {
		this.persistedNoteText.set(id, text);
	}

	private persistChangedElementBounds(cells: unknown): void {
		if (this.suppressGeometryPersistence || !Array.isArray(cells)) {
			return;
		}

		const nodeUpdates: NodeBoundsUpdate[] = [];
		const noteUpdates: NoteBoundsUpdate[] = [];
		const imageUpdates: ImageBoundsUpdate[] = [];
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

		this.persistUpdates(nodeUpdates, noteUpdates, imageUpdates);
	}

	private persistUpdates(
		nodeUpdates: readonly NodeBoundsUpdate[],
		noteUpdates: readonly NoteBoundsUpdate[],
		imageUpdates: readonly ImageBoundsUpdate[],
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
