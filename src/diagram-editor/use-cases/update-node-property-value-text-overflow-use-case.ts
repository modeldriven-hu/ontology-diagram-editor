import { DiagramNode, type OntologyDiagramDocument, type PropertyValueTextOverflow } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodePropertyValueTextOverflowUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		textOverflow: PropertyValueTextOverflow,
	): DiagramMutationResult {
		const nextTextOverflow = textOverflow === 'wrap' ? 'wrap' : undefined;
		let changed = false;
		const nextNodes = diagram.nodes.map((node) => {
			if (node.id.value !== id || node.propertyValueTextOverflow === nextTextOverflow) {
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
				node.showPropertyValues,
				nextTextOverflow,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
	}
}
