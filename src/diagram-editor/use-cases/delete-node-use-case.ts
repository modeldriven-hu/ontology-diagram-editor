import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteNodeUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const nextNodes = diagram.nodes.filter((node) => node.id.value !== id);
		if (nextNodes.length === diagram.nodes.length) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				nodes: nextNodes,
				edges: diagram.edges.filter((edge) => edge.source.value !== id && edge.target.value !== id),
			}),
		};
	}
}
