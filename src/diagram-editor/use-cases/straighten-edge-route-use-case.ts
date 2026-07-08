import { DiagramEdge, Point, type Bounds, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { roundCoordinate } from './geometry';

export class StraightenEdgeRouteUseCase {
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
			if (edge.id.value !== id || edge.source.value === edge.target.value) {
				return edge;
			}

			const sourceBounds = boundsByElementId.get(edge.source.value);
			const targetBounds = boundsByElementId.get(edge.target.value);
			if (sourceBounds === undefined || targetBounds === undefined) {
				return edge;
			}

			const points = straightenedPoints(edge, sourceBounds, targetBounds);
			const label = midpoint(points[0], points[1]);
			if (samePoints(edge.points, points) && pointEquals(edge.label, label) && edge.routeLayout === 'direct') {
				return edge;
			}

			changed = true;
			return new DiagramEdge(
				edge.id.value,
				edge.source.value,
				edge.target.value,
				edge.ontologyRef.value,
				label,
				points,
				edge.style,
				edge.extra,
				'direct',
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
	}
}

function straightenedPoints(edge: DiagramEdge, sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const sourceRight = sourceBounds.x + sourceBounds.width;
	const sourceBottom = sourceBounds.y + sourceBounds.height;
	const targetRight = targetBounds.x + targetBounds.width;
	const targetBottom = targetBounds.y + targetBounds.height;
	const verticalOverlap = rangesOverlap(sourceBounds.y, sourceBottom, targetBounds.y, targetBottom);
	const horizontalOverlap = rangesOverlap(sourceBounds.x, sourceRight, targetBounds.x, targetRight);

	if (verticalOverlap && !horizontalOverlap) {
		const sourcePreservingPoints = sourcePreservingHorizontalPoints(edge, sourceBounds, targetBounds);
		if (sourcePreservingPoints !== undefined) {
			return sourcePreservingPoints;
		}

		return horizontalPoints(sourceBounds, targetBounds);
	}
	if (horizontalOverlap && !verticalOverlap) {
		return verticalPoints(sourceBounds, targetBounds);
	}

	const verticalGap = rangeGap(sourceBounds.y, sourceBottom, targetBounds.y, targetBottom);
	const horizontalGap = rangeGap(sourceBounds.x, sourceRight, targetBounds.x, targetRight);
	if (verticalGap < horizontalGap) {
		return horizontalPoints(sourceBounds, targetBounds);
	}
	if (horizontalGap < verticalGap) {
		return verticalPoints(sourceBounds, targetBounds);
	}

	return Math.abs(targetCenter.x - sourceCenter.x) >= Math.abs(targetCenter.y - sourceCenter.y)
		? horizontalPoints(sourceBounds, targetBounds)
		: verticalPoints(sourceBounds, targetBounds);
}

function sourcePreservingHorizontalPoints(edge: DiagramEdge, sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] | undefined {
	if (!isOrthogonalRoute(edge)) {
		return undefined;
	}

	const sourcePoint = edge.points[0];
	if (!pointOnBoundsY(sourcePoint, sourceBounds) || !pointOnBoundsY(sourcePoint, targetBounds)) {
		return undefined;
	}

	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const targetX = sourceCenter.x <= targetCenter.x
		? targetBounds.x
		: targetBounds.x + targetBounds.width;
	const y = roundCoordinate(sourcePoint.y);

	return [
		new Point(roundCoordinate(sourcePoint.x), y),
		new Point(roundCoordinate(targetX), y),
	];
}

function isOrthogonalRoute(edge: DiagramEdge): boolean {
	return edge.routeLayout === undefined || edge.routeLayout === 'orthogonal';
}

function pointOnBoundsY(point: Point, bounds: Bounds): boolean {
	return point.y >= bounds.y && point.y <= bounds.y + bounds.height;
}

function horizontalPoints(sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const sourceX = sourceCenter.x <= targetCenter.x
		? sourceBounds.x + sourceBounds.width
		: sourceBounds.x;
	const targetX = sourceCenter.x <= targetCenter.x
		? targetBounds.x
		: targetBounds.x + targetBounds.width;
	const y = sharedCoordinate(sourceBounds.y, sourceBounds.y + sourceBounds.height, targetBounds.y, targetBounds.y + targetBounds.height);

	return [
		new Point(roundCoordinate(sourceX), y),
		new Point(roundCoordinate(targetX), y),
	];
}

function verticalPoints(sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const sourceY = sourceCenter.y <= targetCenter.y
		? sourceBounds.y + sourceBounds.height
		: sourceBounds.y;
	const targetY = sourceCenter.y <= targetCenter.y
		? targetBounds.y
		: targetBounds.y + targetBounds.height;
	const x = sharedCoordinate(sourceBounds.x, sourceBounds.x + sourceBounds.width, targetBounds.x, targetBounds.x + targetBounds.width);

	return [
		new Point(x, roundCoordinate(sourceY)),
		new Point(x, roundCoordinate(targetY)),
	];
}

function sharedCoordinate(sourceStart: number, sourceEnd: number, targetStart: number, targetEnd: number): number {
	if (rangesOverlap(sourceStart, sourceEnd, targetStart, targetEnd)) {
		return roundCoordinate((Math.max(sourceStart, targetStart) + Math.min(sourceEnd, targetEnd)) / 2);
	}

	if (sourceEnd < targetStart) {
		return roundCoordinate((sourceEnd + targetStart) / 2);
	}

	return roundCoordinate((targetEnd + sourceStart) / 2);
}

function rangesOverlap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): boolean {
	return firstStart <= secondEnd && secondStart <= firstEnd;
}

function rangeGap(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): number {
	if (rangesOverlap(firstStart, firstEnd, secondStart, secondEnd)) {
		return 0;
	}

	return firstEnd < secondStart
		? secondStart - firstEnd
		: firstStart - secondEnd;
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
