import { Bounds, DiagramNote, type OntologyDiagramDocument } from '../../odiagram';
import type { CanvasPoint } from '../../shared/ontology-diagram-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNoteHeight, defaultNoteWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export class CreateNoteUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		text: string,
		position: CanvasPoint,
	): DiagramMutationResult {
		if (text.trim().length === 0) {
			return { notification: 'Notes cannot be empty.' };
		}

		const note = new DiagramNote(
			nextElementId(diagram.notes.map((existing) => existing.id.value), 'note'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultNoteWidth, defaultNoteHeight),
			text,
		);

		return {
			diagram: cloneDiagram(diagram, {
				notes: [...diagram.notes, note],
			}),
		};
	}
}
