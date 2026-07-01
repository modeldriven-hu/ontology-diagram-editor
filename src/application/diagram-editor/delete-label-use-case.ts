import type { OntologyDiagramDocument } from '../../odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteLabelUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const nextLabels = diagram.labels.filter((label) => label.id.value !== id);
		if (nextLabels.length === diagram.labels.length) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				labels: nextLabels,
			}),
		};
	}
}
