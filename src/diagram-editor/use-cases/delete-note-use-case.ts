import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteNoteUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const nextNotes = diagram.notes.filter((note) => note.id.value !== id);
		if (nextNotes.length === diagram.notes.length) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				notes: nextNotes,
			}),
		};
	}
}
