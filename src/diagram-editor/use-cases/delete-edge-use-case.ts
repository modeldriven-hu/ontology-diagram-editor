import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteEdgeUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const nextEdges = diagram.edges.filter((edge) => edge.id.value !== id);
		if (nextEdges.length === diagram.edges.length) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				edges: nextEdges,
			}),
		};
	}
}
