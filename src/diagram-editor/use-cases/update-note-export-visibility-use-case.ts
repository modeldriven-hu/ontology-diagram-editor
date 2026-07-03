import { DiagramNote, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNoteExportVisibilityUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		exported: boolean,
	): DiagramMutationResult {
		let changed = false;
		const nextNotes = diagram.notes.map((note) => {
			if (note.id.value !== id || (note.exported !== false) === exported) {
				return note;
			}

			changed = true;
			return new DiagramNote(
				note.id.value,
				note.bounds,
				note.text,
				note.style,
				note.extra,
				exported ? undefined : false,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { notes: nextNotes }) } : {};
	}
}
