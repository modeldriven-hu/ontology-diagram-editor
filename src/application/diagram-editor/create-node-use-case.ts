import { Bounds, DiagramNode, type JsonObject, type OntologyDiagramDocument } from '../../odiagram';
import type { CanvasPoint, ModelTreeItemDropPayload } from '../../shared/ontology-diagram-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNodeHeight, defaultNodeWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export class CreateNodeUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		payload: ModelTreeItemDropPayload,
		position: CanvasPoint,
	): DiagramMutationResult {
		if (!isNodeCapableOntologyItem(payload.ontologyItemType)) {
			return { notification: 'Only classes, individuals, and datatypes can create nodes for now.' };
		}

		const existingNode = diagram.nodes.find((node) => node.ontologyRef.value === payload.ontologyItemReference);
		if (existingNode !== undefined) {
			return { notification: `"${payload.displayLabel}" already has a node in this diagram.` };
		}

		const node = new DiagramNode(
			nextElementId(diagram.nodes.map((existing) => existing.id.value), 'node'),
			payload.ontologyItemReference,
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultNodeWidth, defaultNodeHeight),
			undefined,
			undefined,
			nodeExtraFields(payload),
		);

		return {
			diagram: cloneDiagram(diagram, {
				nodes: [...diagram.nodes, node],
			}),
		};
	}
}

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}

function nodeExtraFields(payload: ModelTreeItemDropPayload): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}
