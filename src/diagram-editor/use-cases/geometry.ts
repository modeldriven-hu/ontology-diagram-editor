import { Bounds, DiagramEdge, Point } from '../../documents/odiagram';
import type { NodeBoundsUpdate } from '../../shared/canvas-geometry';

export function recalculateConnectedEdgeEndpoints(
	edge: DiagramEdge,
	updateById: ReadonlyMap<string, NodeBoundsUpdate>,
	boundsByNodeId: ReadonlyMap<string, Bounds>,
): DiagramEdge {
	const sourceChanged = updateById.has(edge.source.value);
	const targetChanged = updateById.has(edge.target.value);
	if (!sourceChanged && !targetChanged) {
		return edge;
	}

	if (edge.source.value === edge.target.value) {
		const selfBounds = boundsByNodeId.get(edge.source.value);
		if (selfBounds === undefined) {
			return edge;
		}

		const nextPoints = selfLoopEdgePoints(selfBounds);
		const nextLabel = selfLoopEdgeLabel(nextPoints);
		if (samePoints(edge.points, nextPoints) && pointsEqual(edge.label, nextLabel)) {
			return edge;
		}

		return new DiagramEdge(
			edge.id.value,
			edge.source.value,
			edge.target.value,
			edge.ontologyRef.value,
			nextLabel,
			nextPoints,
			edge.style,
			edge.extra,
		);
	}

	const nextPoints = [...edge.points];
	if (sourceChanged) {
		const sourceBounds = boundsByNodeId.get(edge.source.value);
		if (sourceBounds !== undefined) {
			nextPoints[0] = boundaryPoint(sourceBounds, nextPoints[1]);
		}
	}
	if (targetChanged) {
		const targetBounds = boundsByNodeId.get(edge.target.value);
		if (targetBounds !== undefined) {
			nextPoints[nextPoints.length - 1] = boundaryPoint(targetBounds, nextPoints[nextPoints.length - 2]);
		}
	}

	if (samePoints(edge.points, nextPoints)) {
		return edge;
	}

	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		edge.label,
		nextPoints,
		edge.style,
		edge.extra,
	);
}

export function roundCoordinate(value: number): number {
	return Math.max(0, Math.round(value));
}

export function roundPositiveSize(value: number): number {
	return Math.max(1, Math.round(value));
}

export function boundaryPoint(bounds: Bounds, toward: Point): Point {
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	const dx = toward.x - centerX;
	const dy = toward.y - centerY;
	if (dx === 0 && dy === 0) {
		return new Point(roundCoordinate(bounds.x + bounds.width), roundCoordinate(centerY));
	}

	const scale = Math.min(
		dx === 0 ? Number.POSITIVE_INFINITY : (bounds.width / 2) / Math.abs(dx),
		dy === 0 ? Number.POSITIVE_INFINITY : (bounds.height / 2) / Math.abs(dy),
	);

	return new Point(
		roundCoordinate(centerX + dx * scale),
		roundCoordinate(centerY + dy * scale),
	);
}

export function nearestBoundaryPoint(bounds: Bounds, point: Point): Point {
	const clampedX = Math.min(bounds.x + bounds.width, Math.max(bounds.x, point.x));
	const clampedY = Math.min(bounds.y + bounds.height, Math.max(bounds.y, point.y));
	const distances = [
		{ side: 'left', value: Math.abs(clampedX - bounds.x) },
		{ side: 'right', value: Math.abs((bounds.x + bounds.width) - clampedX) },
		{ side: 'top', value: Math.abs(clampedY - bounds.y) },
		{ side: 'bottom', value: Math.abs((bounds.y + bounds.height) - clampedY) },
	].sort((left, right) => left.value - right.value);

	switch (distances[0].side) {
		case 'left':
			return new Point(roundCoordinate(bounds.x), roundCoordinate(clampedY));
		case 'right':
			return new Point(roundCoordinate(bounds.x + bounds.width), roundCoordinate(clampedY));
		case 'top':
			return new Point(roundCoordinate(clampedX), roundCoordinate(bounds.y));
		case 'bottom':
			return new Point(roundCoordinate(clampedX), roundCoordinate(bounds.y + bounds.height));
	}

	return new Point(roundCoordinate(clampedX), roundCoordinate(clampedY));
}

export function selfLoopEdgePoints(bounds: Bounds): readonly [Point, Point, Point, Point] {
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;
	const startY = bounds.y + bounds.height * 0.35;
	const loopX = right + Math.max(80, bounds.width * 0.45);
	const loopY = bottom + Math.max(56, bounds.height * 0.75);
	const endX = bounds.x + bounds.width * 0.65;

	return [
		new Point(roundCoordinate(right), roundCoordinate(startY)),
		new Point(roundCoordinate(loopX), roundCoordinate(startY)),
		new Point(roundCoordinate(loopX), roundCoordinate(loopY)),
		new Point(roundCoordinate(endX), roundCoordinate(bottom)),
	];
}

export function selfLoopEdgeLabel(points: readonly [Point, Point, Point, Point]): Point {
	return new Point(
		roundCoordinate(points[1].x + 8),
		roundCoordinate(((points[1].y + points[2].y) / 2) - 12),
	);
}

function pointsEqual(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointsEqual(point, right[index]));
}
