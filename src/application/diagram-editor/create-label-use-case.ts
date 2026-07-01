import { Bounds, DiagramLabel, type OntologyDiagramDocument } from '../../odiagram';
import type { CanvasPoint } from '../../shared/ontology-diagram-events';
import { cloneDiagram } from './diagram-document-copy';
import { defaultLabelHeight, defaultLabelWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export class CreateLabelUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		text: string,
		position: CanvasPoint,
	): DiagramMutationResult {
		if (text.trim().length === 0) {
			return { notification: 'Labels cannot be empty.' };
		}

		const label = new DiagramLabel(
			nextElementId(diagram.labels.map((existing) => existing.id.value), 'label'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultLabelWidth, defaultLabelHeight),
			text,
		);

		return {
			diagram: cloneDiagram(diagram, {
				labels: [...diagram.labels, label],
			}),
		};
	}
}
