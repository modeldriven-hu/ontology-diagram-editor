import { DiagramEdge, type EdgeRouteLayout, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateEdgeRouteLayoutUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		routeLayout: EdgeRouteLayout | undefined,
	): DiagramMutationResult {
		let changed = false;
		const nextEdges = diagram.edges.map((edge) => {
			if (edge.id.value !== id) {
				return edge;
			}
			if (edge.routeLayout === routeLayout) {
				return edge;
			}

			changed = true;
			return new DiagramEdge(
				edge.id.value,
				edge.source.value,
				edge.target.value,
				edge.ontologyRef.value,
				edge.label,
				edge.points,
				edge.style,
				edge.extra,
				routeLayout,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
	}
}
