import { DiagramNode, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodePropertyValuesVisibilityUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		showPropertyValues: boolean,
	): DiagramMutationResult {
		let changed = false;
		const nextNodes = diagram.nodes.map((node) => {
			if (node.id.value !== id || node.showPropertyValues === showPropertyValues) {
				return node;
			}

			changed = true;
			return new DiagramNode(
				node.id.value,
				node.ontologyRef.value,
				node.bounds,
				node.style,
				node.image,
				node.extra,
				node.showDataProperties,
				node.showType,
				showPropertyValues,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
	}
}
