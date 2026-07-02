import { DiagramNode, OntologyDiagramValidationError, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodeImageUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		image: string | undefined,
	): DiagramMutationResult {
		try {
			const nextImage = image?.trim() === '' ? undefined : image;
			let changed = false;
			const nextNodes = diagram.nodes.map((node) => {
				if (node.id.value !== id || node.image === nextImage) {
					return node;
				}

				changed = true;
				return new DiagramNode(
					node.id.value,
					node.ontologyRef.value,
					node.bounds,
					node.style,
					nextImage,
					node.extra,
				);
			});

			if (!changed) {
				return {};
			}

			return {
				diagram: cloneDiagram(diagram, {
					nodes: nextNodes,
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
