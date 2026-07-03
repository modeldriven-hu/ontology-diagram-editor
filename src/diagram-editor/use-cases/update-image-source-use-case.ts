import { DiagramImage, OntologyDiagramValidationError, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateImageSourceUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		source: string,
	): DiagramMutationResult {
		try {
			let changed = false;
			const nextImages = diagram.images.map((image) => {
				if (image.id.value !== id || image.source === source) {
					return image;
				}

				changed = true;
				return new DiagramImage(
					image.id.value,
					image.bounds,
					source,
					image.extra,
				);
			});

			if (!changed) {
				return {};
			}

			return {
				diagram: cloneDiagram(diagram, {
					images: nextImages,
				}),
			};
		} catch (error) {
			if (error instanceof OntologyDiagramValidationError) {
				return { notification: error.message };
			}

			throw error;
		}
	}
}
