import { Bounds, DiagramEdge, Point } from '../../odiagram';
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

	if (edge.points.every((point, index) => pointsEqual(point, nextPoints[index]))) {
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

function boundaryPoint(bounds: Bounds, toward: Point): Point {
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

function pointsEqual(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}
