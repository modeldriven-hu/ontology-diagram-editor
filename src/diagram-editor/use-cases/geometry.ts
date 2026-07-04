import { Bounds, DiagramEdge, Point } from '../../documents/odiagram';
import type { BoundsUpdate } from '../../shared/canvas-geometry';

export function recalculateConnectedEdgeEndpoints(
	edge: DiagramEdge,
	updateById: ReadonlyMap<string, BoundsUpdate>,
	boundsByElementId: ReadonlyMap<string, Bounds>,
): DiagramEdge {
	const sourceChanged = updateById.has(edge.source.value);
	const targetChanged = updateById.has(edge.target.value);
	if (!sourceChanged && !targetChanged) {
		return edge;
	}

	if (edge.source.value === edge.target.value) {
		const selfBounds = boundsByElementId.get(edge.source.value);
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
			edge.routeLayout,
		);
	}

	const nextPoints = [...edge.points];
	if (isNoteConnection(edge)) {
		const sourceBounds = boundsByElementId.get(edge.source.value);
		const targetBounds = boundsByElementId.get(edge.target.value);
		if (sourceBounds !== undefined && targetBounds !== undefined) {
			const closestPoints = closestBoundaryPointPair(sourceBounds, targetBounds);
			if (sourceChanged) {
				nextPoints[0] = closestPoints.source;
			}
			if (targetChanged) {
				nextPoints[nextPoints.length - 1] = closestPoints.target;
			}
		}
	} else {
		if (sourceChanged) {
			const sourceBounds = boundsByElementId.get(edge.source.value);
			if (sourceBounds !== undefined) {
				nextPoints[0] = boundaryPoint(sourceBounds, nextPoints[1]);
			}
		}
		if (targetChanged) {
			const targetBounds = boundsByElementId.get(edge.target.value);
			if (targetBounds !== undefined) {
				nextPoints[nextPoints.length - 1] = boundaryPoint(targetBounds, nextPoints[nextPoints.length - 2]);
			}
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
		edge.routeLayout,
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

export function closestBoundaryPointPair(sourceBounds: Bounds, targetBounds: Bounds): {
	readonly source: Point;
	readonly target: Point;
} {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const sourceRight = sourceBounds.x + sourceBounds.width;
	const sourceBottom = sourceBounds.y + sourceBounds.height;
	const targetRight = targetBounds.x + targetBounds.width;
	const targetBottom = targetBounds.y + targetBounds.height;
	const horizontalOverlap = sourceBounds.x <= targetRight && targetBounds.x <= sourceRight;
	const verticalOverlap = sourceBounds.y <= targetBottom && targetBounds.y <= sourceBottom;

	if (horizontalOverlap && sourceBottom <= targetBounds.y) {
		const x = roundCoordinate(overlapCenter(sourceBounds.x, sourceRight, targetBounds.x, targetRight));
		return {
			source: new Point(x, roundCoordinate(sourceBottom)),
			target: new Point(roundCoordinate(clamp(x, targetBounds.x, targetRight)), roundCoordinate(targetBounds.y)),
		};
	}
	if (horizontalOverlap && targetBottom <= sourceBounds.y) {
		const x = roundCoordinate(overlapCenter(sourceBounds.x, sourceRight, targetBounds.x, targetRight));
		return {
			source: new Point(x, roundCoordinate(sourceBounds.y)),
			target: new Point(roundCoordinate(clamp(x, targetBounds.x, targetRight)), roundCoordinate(targetBottom)),
		};
	}
	if (verticalOverlap && sourceRight <= targetBounds.x) {
		const y = roundCoordinate(overlapCenter(sourceBounds.y, sourceBottom, targetBounds.y, targetBottom));
		return {
			source: new Point(roundCoordinate(sourceRight), y),
			target: new Point(roundCoordinate(targetBounds.x), roundCoordinate(clamp(y, targetBounds.y, targetBottom))),
		};
	}
	if (verticalOverlap && targetRight <= sourceBounds.x) {
		const y = roundCoordinate(overlapCenter(sourceBounds.y, sourceBottom, targetBounds.y, targetBottom));
		return {
			source: new Point(roundCoordinate(sourceBounds.x), y),
			target: new Point(roundCoordinate(targetRight), roundCoordinate(clamp(y, targetBounds.y, targetBottom))),
		};
	}

	return {
		source: boundaryPoint(sourceBounds, targetCenter),
		target: boundaryPoint(targetBounds, sourceCenter),
	};
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

function center(bounds: Bounds): Point {
	return new Point(
		bounds.x + (bounds.width / 2),
		bounds.y + (bounds.height / 2),
	);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

function overlapCenter(firstStart: number, firstEnd: number, secondStart: number, secondEnd: number): number {
	return (Math.max(firstStart, secondStart) + Math.min(firstEnd, secondEnd)) / 2;
}

function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.extra.ontology_item_type === 'noteConnection'
		|| edge.source.value.startsWith('note_')
		|| edge.target.value.startsWith('note_');
}
