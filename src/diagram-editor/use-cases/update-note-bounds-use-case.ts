import { DiagramNote, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumNoteHeight, minimumNoteWidth, type NoteBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNoteBoundsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: readonly NoteBoundsUpdate[],
	): DiagramMutationResult {
		if (updates.length === 0) {
			return {};
		}

		const invalidUpdate = updates.find((update) => update.width < minimumNoteWidth || update.height < minimumNoteHeight);
		if (invalidUpdate !== undefined) {
			return { notification: `Notes must be at least ${minimumNoteWidth} x ${minimumNoteHeight}.` };
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		let changed = false;
		const nextNotes = diagram.notes.map((note) => {
			const update = updateById.get(note.id.value);
			if (update === undefined) {
				return note;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(note.bounds, nextBounds)) {
				return note;
			}

			changed = true;
			return new DiagramNote(
				note.id.value,
				nextBounds,
				note.text,
				note.style,
				note.extra,
			);
		});

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				notes: nextNotes,
			}),
		};
	}
}
