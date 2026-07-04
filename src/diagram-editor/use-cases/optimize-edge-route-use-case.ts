import { DiagramEdge, Point, type Bounds, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { boundaryPoint, closestBoundaryPointPair, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';

export class OptimizeEdgeRouteUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		const boundsByElementId = new Map([
			...diagram.nodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		let changed = false;
		const nextEdges = diagram.edges.map((edge) => {
			if (edge.id.value !== id) {
				return edge;
			}

			const sourceBounds = boundsByElementId.get(edge.source.value);
			const targetBounds = boundsByElementId.get(edge.target.value);
			if (sourceBounds === undefined || targetBounds === undefined) {
				return edge;
			}

			const route = optimizedRoute(edge, sourceBounds, targetBounds);
			if (samePoints(edge.points, route.points) && pointEquals(edge.label, route.label)) {
				return edge;
			}

			changed = true;
			return new DiagramEdge(
				edge.id.value,
				edge.source.value,
				edge.target.value,
				edge.ontologyRef.value,
				route.label,
				route.points,
				edge.style,
				edge.extra,
				edge.routeLayout,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
	}
}

function optimizedRoute(
	edge: DiagramEdge,
	sourceBounds: Bounds,
	targetBounds: Bounds,
): { readonly label: Point; readonly points: readonly Point[] } {
	if (edge.source.value === edge.target.value) {
		const points = selfLoopEdgePoints(sourceBounds);
		return {
			label: selfLoopEdgeLabel(points),
			points,
		};
	}

	const endpoints = isNoteConnection(edge)
		? closestBoundaryPointPair(sourceBounds, targetBounds)
		: centerBoundaryPointPair(sourceBounds, targetBounds);
	const points = edge.routeLayout === undefined || edge.routeLayout === 'orthogonal'
		? orthogonalPoints(endpoints.source, endpoints.target)
		: [endpoints.source, endpoints.target];

	return {
		label: midpoint(endpoints.source, endpoints.target),
		points,
	};
}

function centerBoundaryPointPair(sourceBounds: Bounds, targetBounds: Bounds): {
	readonly source: Point;
	readonly target: Point;
} {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	return {
		source: boundaryPoint(sourceBounds, targetCenter),
		target: boundaryPoint(targetBounds, sourceCenter),
	};
}

function orthogonalPoints(source: Point, target: Point): readonly Point[] {
	if (source.x === target.x || source.y === target.y) {
		return [source, target];
	}

	const middleX = roundCoordinate((source.x + target.x) / 2);
	return [
		source,
		new Point(middleX, source.y),
		new Point(middleX, target.y),
		target,
	];
}

function center(bounds: Bounds): Point {
	return new Point(
		bounds.x + (bounds.width / 2),
		bounds.y + (bounds.height / 2),
	);
}

function midpoint(source: Point, target: Point): Point {
	return new Point(
		roundCoordinate((source.x + target.x) / 2),
		roundCoordinate((source.y + target.y) / 2),
	);
}

function pointEquals(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointEquals(point, right[index]));
}

function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.extra.ontology_item_type === 'noteConnection'
		|| edge.source.value.startsWith('note_')
		|| edge.target.value.startsWith('note_');
}
