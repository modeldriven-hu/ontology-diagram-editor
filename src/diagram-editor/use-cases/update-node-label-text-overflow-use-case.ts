import { DiagramNode, type NodeLabelTextOverflow, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodeLabelTextOverflowUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		textOverflow: NodeLabelTextOverflow,
	): DiagramMutationResult {
		return this.executeMany(diagram, [id], textOverflow);
	}

	public executeMany(
		diagram: OntologyDiagramDocument,
		ids: readonly string[],
		textOverflow: NodeLabelTextOverflow,
	): DiagramMutationResult {
		const nextTextOverflow = textOverflow === 'wrap' ? 'wrap' : undefined;
		const selectedIds = new Set(ids);
		let changed = false;
		const nextNodes = diagram.nodes.map((node) => {
			if (!selectedIds.has(node.id.value) || node.labelTextOverflow === nextTextOverflow) {
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
				node.propertyValueTextOverflow,
				nextTextOverflow,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
	}
}
