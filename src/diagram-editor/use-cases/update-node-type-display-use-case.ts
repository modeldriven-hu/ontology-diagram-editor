import { DiagramNode, type IndividualTypeDisplay, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateNodeTypeDisplayUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		typeDisplay: IndividualTypeDisplay,
	): DiagramMutationResult {
		return this.executeMany(diagram, [id], typeDisplay);
	}

	public executeMany(
		diagram: OntologyDiagramDocument,
		ids: readonly string[],
		typeDisplay: IndividualTypeDisplay,
	): DiagramMutationResult {
		const nextTypeDisplay = typeDisplay === 'stereotype' ? 'stereotype' : undefined;
		const selectedIds = new Set(ids);
		let changed = false;
		const nextNodes = diagram.nodes.map((node) => {
			if (!selectedIds.has(node.id.value) || node.typeDisplay === nextTypeDisplay) {
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
				node.labelTextOverflow,
				nextTypeDisplay,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
	}
}
