import { DiagramNote, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNoteTextUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		text: string,
	): DiagramMutationResult {
		if (text.trim().length === 0) {
			return { notification: 'Notes cannot be empty.' };
		}

		let changed = false;
		const nextNotes = diagram.notes.map((note) => {
			if (note.id.value !== id || note.text === text) {
				return note;
			}

			changed = true;
			return new DiagramNote(
				note.id.value,
				note.bounds,
				text,
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
