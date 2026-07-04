import { DiagramEdge, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { EdgeRouteUpdate } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nearestBoundaryPoint, roundCoordinate } from './geometry';

export class UpdateEdgeRouteUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: readonly EdgeRouteUpdate[],
	): DiagramMutationResult {
		if (updates.length === 0) {
			return {};
		}

		const invalidUpdate = updates.find((update) => update.points.length < 2);
		if (invalidUpdate !== undefined) {
			return { notification: 'Edges must have at least a source and target point.' };
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		const boundsByElementId = new Map([
			...diagram.nodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		let changed = false;
		const nextEdges = diagram.edges.map((edge) => {
			const update = updateById.get(edge.id.value);
			if (update === undefined) {
				return edge;
			}

			const sourceBounds = boundsByElementId.get(edge.source.value);
			const targetBounds = boundsByElementId.get(edge.target.value);
			if (sourceBounds === undefined || targetBounds === undefined) {
				return edge;
			}

			const nextPoints = update.points.map((point) => new Point(
				roundCoordinate(point.x),
				roundCoordinate(point.y),
			));
			nextPoints[0] = nearestBoundaryPoint(sourceBounds, nextPoints[0]);
			nextPoints[nextPoints.length - 1] = nearestBoundaryPoint(targetBounds, nextPoints[nextPoints.length - 1]);
			const nextLabel = new Point(roundCoordinate(update.label.x), roundCoordinate(update.label.y));
			if (samePoints(edge.points, nextPoints) && pointEquals(edge.label, nextLabel)) {
				return edge;
			}

			changed = true;
			return new DiagramEdge(
				edge.id.value,
				edge.source.value,
				edge.target.value,
				edge.ontologyRef.value,
				nextLabel,
				nextPoints,
				edge.style,
				edge.extra,
				edge.routeLayout,
			);
		});

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				edges: nextEdges,
			}),
		};
	}
}

function pointEquals(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointEquals(point, right[index]));
}
