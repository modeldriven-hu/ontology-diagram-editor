import { DiagramNode, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodeDataPropertiesVisibilityUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		showDataProperties: boolean,
	): DiagramMutationResult {
		let changed = false;
		const nextNodes = diagram.nodes.map((node) => {
			if (node.id.value !== id || (node.showDataProperties === true) === showDataProperties) {
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
				showDataProperties ? true : undefined,
				node.showType,
				node.showPropertyValues,
				node.propertyValueTextOverflow,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
	}
}
