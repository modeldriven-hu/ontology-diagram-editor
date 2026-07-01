import type { OntologyDiagramDocument } from '../../odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteImageUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const nextImages = diagram.images.filter((image) => image.id.value !== id);
		if (nextImages.length === diagram.images.length) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				images: nextImages,
			}),
		};
	}
}
