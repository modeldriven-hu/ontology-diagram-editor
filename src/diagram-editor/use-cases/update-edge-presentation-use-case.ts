import { DiagramEdge, OntologyDiagramValidationError, type ContainmentDirection, type DiagramNode, type EdgeRenderAs, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { NodeBoundsUpdate } from '../../shared/canvas-geometry';
import { layoutContainmentNodes } from './containment-layout';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recalculateConnectedEdgeEndpoints } from './geometry';

export class UpdateEdgePresentationUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		renderAs: EdgeRenderAs | undefined,
		containmentDirection: ContainmentDirection | undefined,
	): DiagramMutationResult {
		const selectedEdge = diagram.edges.find((edge) => edge.id.value === id);
		if (selectedEdge === undefined) {
			return { notification: `Edge "${id}" was not found.` };
		}

		const nextDirection = renderAs === 'containment' ? containmentDirection : undefined;
		if (renderAs === 'containment' && nextDirection === undefined) {
			return { notification: 'Choose which endpoint contains the other node.' };
		}
		if (selectedEdge.renderAs === renderAs && selectedEdge.containmentDirection === nextDirection) {
			return {};
		}

		const updatedEdges = diagram.edges.map((edge) => edge.id.value === id
			? copyEdge(edge, renderAs, nextDirection)
			: edge);
		let updatedDiagram: OntologyDiagramDocument;
		try {
			updatedDiagram = cloneDiagram(diagram, { edges: updatedEdges });
		} catch (error) {
			if (error instanceof OntologyDiagramValidationError) {
				return { notification: error.issues[0] ?? error.message };
			}
			throw error;
		}

		if (renderAs !== 'containment') {
			return {
				diagram: cloneDiagram(updatedDiagram, {
					edges: updatedEdges.map((edge) => edge.id.value === id
						? recalculateEdgeAfterRestoringConnection(edge, diagram)
						: edge),
				}),
			};
		}

		const nextNodes = layoutContainmentNodes(updatedDiagram);
		const updates = nodeBoundsUpdates(diagram.nodes, nextNodes);
		const updateById = new Map(updates.map((update) => [update.id, update]));
		const boundsByElementId = new Map([
			...nextNodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const nextEdges = updatedEdges.map((edge) => edge.renderAs === 'containment'
			? edge
			: recalculateConnectedEdgeEndpoints(edge, updateById, boundsByElementId));

		return {
			diagram: cloneDiagram(updatedDiagram, {
				nodes: nextNodes,
				edges: nextEdges,
			}),
		};
	}
}

function copyEdge(
	edge: DiagramEdge,
	renderAs: EdgeRenderAs | undefined,
	containmentDirection: ContainmentDirection | undefined,
): DiagramEdge {
	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		edge.label,
		edge.points,
		edge.style,
		edge.extra,
		edge.routeLayout,
		renderAs,
		containmentDirection,
	);
}

function recalculateEdgeAfterRestoringConnection(edge: DiagramEdge, diagram: OntologyDiagramDocument): DiagramEdge {
	const source = diagram.nodes.find((node) => node.id.value === edge.source.value);
	const target = diagram.nodes.find((node) => node.id.value === edge.target.value);
	if (source === undefined || target === undefined) {
		return edge;
	}

	const updates = new Map<string, NodeBoundsUpdate>([
		[source.id.value, {
			id: source.id.value,
			x: source.bounds.x,
			y: source.bounds.y,
			width: source.bounds.width,
			height: source.bounds.height,
		}],
		[target.id.value, {
			id: target.id.value,
			x: target.bounds.x,
			y: target.bounds.y,
			width: target.bounds.width,
			height: target.bounds.height,
		}],
	]);
	const bounds = new Map([
		[source.id.value, source.bounds],
		[target.id.value, target.bounds],
	]);
	return recalculateConnectedEdgeEndpoints(edge, updates, bounds);
}

function nodeBoundsUpdates(
	originalNodes: readonly DiagramNode[],
	nextNodes: readonly DiagramNode[],
): readonly NodeBoundsUpdate[] {
	const originalById = new Map(originalNodes.map((node) => [node.id.value, node.bounds]));
	return nextNodes.flatMap((node) => {
		const original = originalById.get(node.id.value);
		return original !== undefined
			&& original.x === node.bounds.x
			&& original.y === node.bounds.y
			&& original.width === node.bounds.width
			&& original.height === node.bounds.height
			? []
			: [{
				id: node.id.value,
				x: node.bounds.x,
				y: node.bounds.y,
				width: node.bounds.width,
				height: node.bounds.height,
			}];
	});
}
