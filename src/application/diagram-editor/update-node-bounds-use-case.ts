import { DiagramNode, type OntologyDiagramDocument } from '../../odiagram';
import { minimumNodeHeight, minimumNodeWidth, type NodeBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recalculateConnectedEdgeEndpoints } from './geometry';

export class UpdateNodeBoundsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: readonly NodeBoundsUpdate[],
	): DiagramMutationResult {
		if (updates.length === 0) {
			return {};
		}

		const invalidUpdate = updates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
		if (invalidUpdate !== undefined) {
			return { notification: `Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.` };
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		let changed = false;
		const boundsByNodeId = new Map(diagram.nodes.map((node) => [node.id.value, node.bounds]));
		const nextNodes = diagram.nodes.map((node) => {
			const update = updateById.get(node.id.value);
			if (update === undefined) {
				return node;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(node.bounds, nextBounds)) {
				return node;
			}

			changed = true;
			boundsByNodeId.set(node.id.value, nextBounds);
			return new DiagramNode(
				node.id.value,
				node.ontologyRef.value,
				nextBounds,
				node.style,
				node.image,
				node.extra,
			);
		});
		const nextEdges = diagram.edges.map((edge) => recalculateConnectedEdgeEndpoints(edge, updateById, boundsByNodeId));
		changed = changed || nextEdges.some((edge, index) => edge !== diagram.edges[index]);

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				nodes: nextNodes,
				edges: nextEdges,
			}),
		};
	}
}
