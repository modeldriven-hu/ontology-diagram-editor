import { DiagramEdge, Point, type Bounds, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { boundaryPoint, roundCoordinate, selfLoopEdgeLabel } from './geometry';

const routingClearance = 16;
const parallelEdgeSpacing = 12;
const turnPenalty = 8;
const crossingPenalty = 24;
const obstaclePenalty = 10_000;
const automaticLabelTolerance = 18;
const maximumPreservedLabelDistance = 120;

type PortSide = 'right' | 'bottom' | 'left' | 'top';
type TravelDirection = 'horizontal' | 'vertical' | 'none';

interface Rectangle {
	readonly id: string;
	readonly left: number;
	readonly top: number;
	readonly right: number;
	readonly bottom: number;
}

interface Segment {
	readonly start: Point;
	readonly end: Point;
}

interface Port {
	readonly side: PortSide;
	readonly anchor: Point;
	readonly escape: Point;
}

interface RouteResult {
	readonly points: readonly Point[];
	readonly label: Point;
}

interface PathResult {
	readonly points: readonly Point[];
	readonly score: number;
}

interface QueueEntry {
	readonly key: string;
	readonly xIndex: number;
	readonly yIndex: number;
	readonly direction: TravelDirection;
	readonly score: number;
}

export class OptimizeEdgeRouteUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
	): DiagramMutationResult {
		return this.executeMany(diagram, [id]);
	}

	public executeMany(
		diagram: OntologyDiagramDocument,
		ids: readonly string[],
	): DiagramMutationResult {
		const boundsByElementId = new Map([
			...diagram.nodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const selectedIds = new Set(ids);
		const elementRectangles = [...boundsByElementId].map(([id, bounds]) => rectangle(id, bounds));
		const routedLabelRectangles = diagram.edges
			.filter((edge) => !selectedIds.has(edge.id.value))
			.flatMap((edge) => edgeLabelRectangles(edge));
		const routedSegments = diagram.edges
			.filter((edge) => !selectedIds.has(edge.id.value))
			.flatMap((edge) => pathSegments(edge.points));
		const parallelOffsets = edgeParallelOffsets(diagram.edges);
		const parallelIndexes = edgeParallelIndexes(diagram.edges);
		let changed = false;
		const nextEdges: DiagramEdge[] = [];

		for (const edge of diagram.edges) {
			if (!selectedIds.has(edge.id.value)) {
				nextEdges.push(edge);
				continue;
			}

			const sourceBounds = boundsByElementId.get(edge.source.value);
			const targetBounds = boundsByElementId.get(edge.target.value);
			if (sourceBounds === undefined || targetBounds === undefined) {
				nextEdges.push(edge);
				continue;
			}

			const rectangles = [
				...elementRectangles,
				...routedLabelRectangles,
			];
			const route = optimizedRoute(edge, sourceBounds, targetBounds, {
				rectangles,
				routedSegments,
				parallelOffset: parallelOffsets.get(edge.id.value) ?? 0,
				parallelIndex: parallelIndexes.get(edge.id.value) ?? 0,
			});
			routedSegments.push(...pathSegments(route.points));
			routedLabelRectangles.push(
				...(isNoteConnection(edge) ? [] : [pointRectangle(edge.id.value, route.label, 88, 28)]),
				...(edge.sourceCardinalityLabel === undefined ? [] : [pointRectangle(edge.id.value, edge.sourceCardinalityLabel, 48, 22)]),
				...(edge.targetCardinalityLabel === undefined ? [] : [pointRectangle(edge.id.value, edge.targetCardinalityLabel, 48, 22)]),
			);
			if (samePoints(edge.points, route.points) && pointEquals(edge.label, route.label)) {
				nextEdges.push(edge);
				continue;
			}

			changed = true;
			nextEdges.push(new DiagramEdge(
				edge.id.value,
				edge.source.value,
				edge.target.value,
				edge.ontologyRef.value,
				route.label,
				route.points,
				edge.style,
				edge.extra,
				edge.routeLayout,
				edge.renderAs,
				edge.containmentDirection,
			));
		}

		return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
	}
}

function optimizedRoute(
	edge: DiagramEdge,
	sourceBounds: Bounds,
	targetBounds: Bounds,
	context: {
		readonly rectangles: readonly Rectangle[];
		readonly routedSegments: readonly Segment[];
		readonly parallelOffset: number;
		readonly parallelIndex: number;
	},
): RouteResult {
	const preserveLabel = shouldPreserveLabel(edge);
	let points: readonly Point[];

	if (edge.source.value === edge.target.value) {
		points = optimizedSelfLoop(edge, sourceBounds, context);
	} else if (edge.routeLayout === undefined || edge.routeLayout === 'orthogonal') {
		points = optimizedOrthogonalRoute(edge, sourceBounds, targetBounds, context);
	} else if (edge.routeLayout === 'direct') {
		points = optimizedDirectRoute(edge, sourceBounds, targetBounds, context);
	} else {
		const routed = optimizedOrthogonalRoute(edge, sourceBounds, targetBounds, context);
		points = [routed[0], routed[routed.length - 1]];
	}

	return {
		points,
		label: preserveLabel ? edge.label : pointAlongPath(points, 0.5),
	};
}

function optimizedOrthogonalRoute(
	edge: DiagramEdge,
	sourceBounds: Bounds,
	targetBounds: Bounds,
	context: {
		readonly rectangles: readonly Rectangle[];
		readonly routedSegments: readonly Segment[];
		readonly parallelOffset: number;
	},
): readonly Point[] {
	const sourcePorts = candidatePorts(sourceBounds, targetBounds, context.parallelOffset);
	const targetPorts = candidatePorts(targetBounds, sourceBounds, context.parallelOffset);
	const expandedRectangles = context.rectangles.map((candidate) => expandRectangle(candidate, routingClearance));
	let best: PathResult | undefined;

	for (const sourcePort of sourcePorts) {
		if (portExitBlocked(sourcePort, expandedRectangles, edge.source.value)) {
			continue;
		}
		for (const targetPort of targetPorts) {
			if (portExitBlocked(targetPort, expandedRectangles, edge.target.value)) {
				continue;
			}
			const middle = shortestRectilinearPath(
				sourcePort.escape,
				targetPort.escape,
				expandedRectangles,
				context.routedSegments,
			);
			if (middle === undefined) {
				continue;
			}

			const points = simplifyOrthogonalPoints([
				sourcePort.anchor,
				...middle.points,
				targetPort.anchor,
			]);
			const crossings = pathSegments(points).reduce((count, segment) =>
				count + context.routedSegments.filter((candidate) => segmentsCross(segment, candidate)).length, 0);
			const score = pathLength(points)
				+ portPreferencePenalty(sourcePort.side, sourceBounds, targetBounds)
				+ portPreferencePenalty(targetPort.side, targetBounds, sourceBounds)
				+ (Math.max(0, points.length - 2) * turnPenalty)
				+ (crossings * crossingPenalty);
			if (best === undefined || score < best.score) {
				best = { points, score };
			}
		}
	}

	if (best !== undefined) {
		return best.points;
	}

	const source = boundaryPoint(sourceBounds, boundsCenter(targetBounds));
	const target = boundaryPoint(targetBounds, boundsCenter(sourceBounds));
	return fallbackOrthogonalPoints(source, target);
}

function optimizedDirectRoute(
	edge: DiagramEdge,
	sourceBounds: Bounds,
	targetBounds: Bounds,
	context: {
		readonly rectangles: readonly Rectangle[];
		readonly routedSegments: readonly Segment[];
		readonly parallelOffset: number;
	},
): readonly [Point, Point] {
	const sourceCenter = boundsCenter(sourceBounds);
	const targetCenter = boundsCenter(targetBounds);
	const projectedSource = offsetBoundaryPoint(sourceBounds, targetCenter, context.parallelOffset);
	const projectedTarget = offsetBoundaryPoint(targetBounds, sourceCenter, context.parallelOffset);
	const sourcePorts = candidatePorts(sourceBounds, targetBounds, context.parallelOffset);
	const targetPorts = candidatePorts(targetBounds, sourceBounds, context.parallelOffset);
	const candidates: (readonly [Point, Point])[] = [
		[projectedSource, projectedTarget],
		...sourcePorts.flatMap((sourcePort) => targetPorts.map((targetPort) =>
			[sourcePort.anchor, targetPort.anchor] as const)),
	];
	let best = candidates[0];
	let bestScore = directRouteScore(best, edge, sourceBounds, targetBounds, context);

	for (const candidate of candidates.slice(1)) {
		const score = directRouteScore(candidate, edge, sourceBounds, targetBounds, context);
		if (score < bestScore) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
}

function directRouteScore(
	points: readonly [Point, Point],
	edge: DiagramEdge,
	sourceBounds: Bounds,
	targetBounds: Bounds,
	context: {
		readonly rectangles: readonly Rectangle[];
		readonly routedSegments: readonly Segment[];
	},
): number {
	const segment = { start: points[0], end: points[1] };
	const blocked = context.rectangles.filter((candidate) =>
		segmentCrossesRectangleInterior(segment, expandRectangle(candidate, routingClearance / 2))).length;
	const crossings = context.routedSegments.filter((candidate) => segmentsCross(segment, candidate)).length;
	const sourceSidePenalty = pointExitsBounds(points[0], points[1], sourceBounds) ? 0 : obstaclePenalty;
	const targetSidePenalty = pointExitsBounds(points[1], points[0], targetBounds) ? 0 : obstaclePenalty;
	return distance(points[0], points[1])
		+ (blocked * obstaclePenalty)
		+ (crossings * crossingPenalty)
		+ sourceSidePenalty
		+ targetSidePenalty
		+ (edge.source.value === edge.target.value ? obstaclePenalty : 0);
}

function pointExitsBounds(anchor: Point, toward: Point, bounds: Bounds): boolean {
	const probeDistance = 2;
	const length = distance(anchor, toward);
	if (length === 0) {
		return false;
	}
	const probe = new Point(
		roundCoordinate(anchor.x + (((toward.x - anchor.x) / length) * probeDistance)),
		roundCoordinate(anchor.y + (((toward.y - anchor.y) / length) * probeDistance)),
	);
	return probe.x < bounds.x || probe.x > bounds.x + bounds.width
		|| probe.y < bounds.y || probe.y > bounds.y + bounds.height;
}

function optimizedSelfLoop(
	edge: DiagramEdge,
	bounds: Bounds,
	context: {
		readonly rectangles: readonly Rectangle[];
		readonly routedSegments: readonly Segment[];
		readonly parallelIndex: number;
	},
): readonly Point[] {
	const extension = context.parallelIndex * parallelEdgeSpacing;
	const candidates = selfLoopCandidates(bounds, extension);
	const obstacles = context.rectangles
		.filter((candidate) => candidate.id !== edge.source.value)
		.map((candidate) => expandRectangle(candidate, routingClearance));
	let best = candidates[0];
	let bestScore = routeConflictScore(best, obstacles, context.routedSegments);

	for (const candidate of candidates.slice(1)) {
		const score = routeConflictScore(candidate, obstacles, context.routedSegments);
		if (score < bestScore) {
			best = candidate;
			bestScore = score;
		}
	}

	return best;
}

function candidatePorts(bounds: Bounds, otherBounds: Bounds, offset: number): readonly Port[] {
	const left = bounds.x;
	const right = bounds.x + bounds.width;
	const top = bounds.y;
	const bottom = bounds.y + bounds.height;
	const otherRight = otherBounds.x + otherBounds.width;
	const otherBottom = otherBounds.y + otherBounds.height;
	const horizontalOverlapStart = Math.max(left, otherBounds.x);
	const horizontalOverlapEnd = Math.min(right, otherRight);
	const verticalOverlapStart = Math.max(top, otherBounds.y);
	const verticalOverlapEnd = Math.min(bottom, otherBottom);
	const preferredX = horizontalOverlapStart <= horizontalOverlapEnd
		? (horizontalOverlapStart + horizontalOverlapEnd) / 2
		: otherBounds.x + (otherBounds.width / 2);
	const preferredY = verticalOverlapStart <= verticalOverlapEnd
		? (verticalOverlapStart + verticalOverlapEnd) / 2
		: otherBounds.y + (otherBounds.height / 2);
	const x = clamp(preferredX + offset, left + Math.min(12, bounds.width / 2), right - Math.min(12, bounds.width / 2));
	const y = clamp(preferredY + offset, top + Math.min(12, bounds.height / 2), bottom - Math.min(12, bounds.height / 2));

	return [
		port('right', new Point(roundCoordinate(right), roundCoordinate(y))),
		port('bottom', new Point(roundCoordinate(x), roundCoordinate(bottom))),
		port('left', new Point(roundCoordinate(left), roundCoordinate(y))),
		port('top', new Point(roundCoordinate(x), roundCoordinate(top))),
	];
}

function port(side: PortSide, anchor: Point): Port {
	const normal = sideNormal(side);
	return {
		side,
		anchor,
		escape: new Point(
			roundCoordinate(anchor.x + (normal.x * routingClearance)),
			roundCoordinate(anchor.y + (normal.y * routingClearance)),
		),
	};
}

function shortestRectilinearPath(
	start: Point,
	end: Point,
	rectangles: readonly Rectangle[],
	existingSegments: readonly Segment[],
): PathResult | undefined {
	const corridor = {
		left: Math.max(0, Math.min(start.x, end.x) - 160),
		top: Math.max(0, Math.min(start.y, end.y) - 160),
		right: Math.max(start.x, end.x) + 160,
		bottom: Math.max(start.y, end.y) + 160,
	};
	const relevantRectangles = rectangles.filter((candidate) => rectanglesOverlap(candidate, corridor));
	const maximumRight = Math.max(start.x, end.x, ...relevantRectangles.map((candidate) => candidate.right));
	const maximumBottom = Math.max(start.y, end.y, ...relevantRectangles.map((candidate) => candidate.bottom));
	const xCoordinates = uniqueSorted([
		0,
		start.x,
		end.x,
		maximumRight + routingClearance,
		...relevantRectangles.flatMap((candidate) => [candidate.left, candidate.right]),
	]);
	const yCoordinates = uniqueSorted([
		0,
		start.y,
		end.y,
		maximumBottom + routingClearance,
		...relevantRectangles.flatMap((candidate) => [candidate.top, candidate.bottom]),
	]);
	const startX = xCoordinates.indexOf(start.x);
	const startY = yCoordinates.indexOf(start.y);
	const endX = xCoordinates.indexOf(end.x);
	const endY = yCoordinates.indexOf(end.y);
	const scores = new Map<string, number>();
	const previous = new Map<string, string>();
	const queue: QueueEntry[] = [];
	const startKey = stateKey(startX, startY, 'none');
	scores.set(startKey, 0);
	pushQueue(queue, { key: startKey, xIndex: startX, yIndex: startY, direction: 'none', score: 0 });
	let finalEntry: QueueEntry | undefined;

	while (queue.length > 0) {
		const current = popQueue(queue);
		if (current === undefined || current.score !== scores.get(current.key)) {
			continue;
		}
		if (current.xIndex === endX && current.yIndex === endY) {
			finalEntry = current;
			break;
		}

		for (const neighbor of gridNeighbors(current.xIndex, current.yIndex, xCoordinates, yCoordinates)) {
			const startPoint = new Point(xCoordinates[current.xIndex], yCoordinates[current.yIndex]);
			const endPoint = new Point(xCoordinates[neighbor.xIndex], yCoordinates[neighbor.yIndex]);
			const segment = { start: startPoint, end: endPoint };
			if (relevantRectangles.some((candidate) => segmentCrossesRectangleInterior(segment, candidate))) {
				continue;
			}
			const crossings = existingSegments.filter((candidate) => segmentsCross(segment, candidate)).length;
			const nextScore = current.score
				+ manhattanDistance(startPoint, endPoint)
				+ (current.direction !== 'none' && current.direction !== neighbor.direction ? turnPenalty : 0)
				+ (crossings * crossingPenalty);
			const nextKey = stateKey(neighbor.xIndex, neighbor.yIndex, neighbor.direction);
			if (nextScore >= (scores.get(nextKey) ?? Number.POSITIVE_INFINITY)) {
				continue;
			}
			scores.set(nextKey, nextScore);
			previous.set(nextKey, current.key);
			pushQueue(queue, { ...neighbor, key: nextKey, score: nextScore });
		}
	}

	if (finalEntry === undefined) {
		return undefined;
	}

	const reversedPoints: Point[] = [];
	let key: string | undefined = finalEntry.key;
	while (key !== undefined) {
		const state = parseStateKey(key);
		reversedPoints.push(new Point(xCoordinates[state.xIndex], yCoordinates[state.yIndex]));
		key = previous.get(key);
	}

	return {
		points: simplifyOrthogonalPoints(reversedPoints.reverse()),
		score: finalEntry.score,
	};
}

function gridNeighbors(
	xIndex: number,
	yIndex: number,
	xCoordinates: readonly number[],
	yCoordinates: readonly number[],
): readonly Omit<QueueEntry, 'key' | 'score'>[] {
	return [
		...(xIndex > 0 ? [{ xIndex: xIndex - 1, yIndex, direction: 'horizontal' as const }] : []),
		...(xIndex + 1 < xCoordinates.length ? [{ xIndex: xIndex + 1, yIndex, direction: 'horizontal' as const }] : []),
		...(yIndex > 0 ? [{ xIndex, yIndex: yIndex - 1, direction: 'vertical' as const }] : []),
		...(yIndex + 1 < yCoordinates.length ? [{ xIndex, yIndex: yIndex + 1, direction: 'vertical' as const }] : []),
	];
}

function pushQueue(queue: QueueEntry[], entry: QueueEntry): void {
	queue.push(entry);
	let index = queue.length - 1;
	while (index > 0) {
		const parent = Math.floor((index - 1) / 2);
		if (queue[parent].score <= queue[index].score) {
			break;
		}
		[queue[parent], queue[index]] = [queue[index], queue[parent]];
		index = parent;
	}
}

function popQueue(queue: QueueEntry[]): QueueEntry | undefined {
	const first = queue[0];
	const last = queue.pop();
	if (first === undefined || last === undefined || queue.length === 0) {
		return first;
	}
	queue[0] = last;
	let index = 0;
	while (true) {
		const left = (index * 2) + 1;
		const right = left + 1;
		let smallest = index;
		if (left < queue.length && queue[left].score < queue[smallest].score) {
			smallest = left;
		}
		if (right < queue.length && queue[right].score < queue[smallest].score) {
			smallest = right;
		}
		if (smallest === index) {
			break;
		}
		[queue[index], queue[smallest]] = [queue[smallest], queue[index]];
		index = smallest;
	}
	return first;
}

function selfLoopCandidates(bounds: Bounds, extension: number): readonly (readonly Point[])[] {
	const left = bounds.x;
	const right = bounds.x + bounds.width;
	const top = bounds.y;
	const bottom = bounds.y + bounds.height;
	const x35 = roundCoordinate(bounds.x + (bounds.width * 0.35));
	const x65 = roundCoordinate(bounds.x + (bounds.width * 0.65));
	const y35 = roundCoordinate(bounds.y + (bounds.height * 0.35));
	const y65 = roundCoordinate(bounds.y + (bounds.height * 0.65));
	const horizontal = Math.max(80, bounds.width * 0.45) + extension;
	const vertical = Math.max(56, bounds.height * 0.75) + extension;
	const loopLeft = roundCoordinate(left - horizontal);
	const loopTop = roundCoordinate(top - vertical);
	const loopRight = roundCoordinate(right + horizontal);
	const loopBottom = roundCoordinate(bottom + vertical);

	return [
		[new Point(roundCoordinate(right), y35), new Point(loopRight, y35), new Point(loopRight, loopBottom), new Point(x65, roundCoordinate(bottom))],
		[new Point(x65, roundCoordinate(bottom)), new Point(x65, loopBottom), new Point(loopLeft, loopBottom), new Point(roundCoordinate(left), y65)],
		[new Point(roundCoordinate(left), y65), new Point(loopLeft, y65), new Point(loopLeft, loopTop), new Point(x35, roundCoordinate(top))],
		[new Point(x35, roundCoordinate(top)), new Point(x35, loopTop), new Point(loopRight, loopTop), new Point(roundCoordinate(right), y35)],
	];
}

function shouldPreserveLabel(edge: DiagramEdge): boolean {
	if (distanceToPath(edge.label, edge.points) > maximumPreservedLabelDistance) {
		return false;
	}
	const automaticPositions = [pointAlongPath(edge.points, 0.5)];
	if (edge.source.value === edge.target.value && edge.points.length === 4) {
		automaticPositions.push(selfLoopEdgeLabel(edge.points as readonly [Point, Point, Point, Point]));
	}
	return automaticPositions.every((position) => distance(edge.label, position) > automaticLabelTolerance);
}

function distanceToPath(point: Point, points: readonly Point[]): number {
	if (points.length === 0) {
		return Number.POSITIVE_INFINITY;
	}
	if (points.length === 1) {
		return distance(point, points[0]);
	}
	return Math.min(...pathSegments(points).map((segment) => distanceToSegment(point, segment)));
}

function distanceToSegment(point: Point, segment: Segment): number {
	const dx = segment.end.x - segment.start.x;
	const dy = segment.end.y - segment.start.y;
	const squaredLength = (dx * dx) + (dy * dy);
	if (squaredLength === 0) {
		return distance(point, segment.start);
	}
	const ratio = clamp(
		(((point.x - segment.start.x) * dx) + ((point.y - segment.start.y) * dy)) / squaredLength,
		0,
		1,
	);
	return Math.hypot(
		point.x - (segment.start.x + (ratio * dx)),
		point.y - (segment.start.y + (ratio * dy)),
	);
}

function pointAlongPath(points: readonly Point[], ratio: number): Point {
	if (points.length === 0) {
		return new Point(0, 0);
	}
	if (points.length === 1) {
		return points[0];
	}
	const lengths = points.slice(1).map((point, index) => distance(points[index], point));
	const total = lengths.reduce((sum, length) => sum + length, 0);
	if (total === 0) {
		return points[0];
	}
	let remaining = total * ratio;
	for (let index = 0; index < lengths.length; index += 1) {
		const length = lengths[index];
		if (remaining <= length) {
			const start = points[index];
			const end = points[index + 1];
			const segmentRatio = length === 0 ? 0 : remaining / length;
			return new Point(
				roundCoordinate(start.x + ((end.x - start.x) * segmentRatio)),
				roundCoordinate(start.y + ((end.y - start.y) * segmentRatio)),
			);
		}
		remaining -= length;
	}
	return points[points.length - 1];
}

function routeConflictScore(
	points: readonly Point[],
	obstacles: readonly Rectangle[],
	existingSegments: readonly Segment[],
): number {
	const segments = pathSegments(points);
	const obstaclesHit = segments.reduce((count, segment) =>
		count + obstacles.filter((candidate) => segmentCrossesRectangleInterior(segment, candidate)).length, 0);
	const crossings = segments.reduce((count, segment) =>
		count + existingSegments.filter((candidate) => segmentsCross(segment, candidate)).length, 0);
	return pathLength(points)
		+ (Math.max(0, points.length - 2) * turnPenalty)
		+ (obstaclesHit * obstaclePenalty)
		+ (crossings * crossingPenalty);
}

function portExitBlocked(portValue: Port, rectangles: readonly Rectangle[], ownId: string): boolean {
	const segment = { start: portValue.anchor, end: portValue.escape };
	return rectangles.some((candidate) =>
		candidate.id !== ownId && segmentCrossesRectangleInterior(segment, candidate));
}

function portPreferencePenalty(side: PortSide, bounds: Bounds, otherBounds: Bounds): number {
	const center = boundsCenter(bounds);
	const other = boundsCenter(otherBounds);
	const normal = sideNormal(side);
	const dot = ((other.x - center.x) * normal.x) + ((other.y - center.y) * normal.y);
	return dot >= 0 ? 0 : 12 + (Math.abs(dot) * 0.02);
}

function sideNormal(side: PortSide): { readonly x: number; readonly y: number } {
	switch (side) {
		case 'right': return { x: 1, y: 0 };
		case 'bottom': return { x: 0, y: 1 };
		case 'left': return { x: -1, y: 0 };
		case 'top': return { x: 0, y: -1 };
	}
}

function offsetBoundaryPoint(bounds: Bounds, toward: Point, offset: number): Point {
	const point = boundaryPoint(bounds, toward);
	const onVerticalSide = point.x === roundCoordinate(bounds.x)
		|| point.x === roundCoordinate(bounds.x + bounds.width);
	return onVerticalSide
		? new Point(point.x, roundCoordinate(clamp(point.y + offset, bounds.y, bounds.y + bounds.height)))
		: new Point(roundCoordinate(clamp(point.x + offset, bounds.x, bounds.x + bounds.width)), point.y);
}

function edgeParallelOffsets(edges: readonly DiagramEdge[]): ReadonlyMap<string, number> {
	const result = new Map<string, number>();
	for (const group of parallelEdgeGroups(edges).values()) {
		const sorted = [...group].sort((left, right) => left.id.value.localeCompare(right.id.value));
		for (let index = 0; index < sorted.length; index += 1) {
			result.set(sorted[index].id.value, (index - ((sorted.length - 1) / 2)) * parallelEdgeSpacing);
		}
	}
	return result;
}

function edgeParallelIndexes(edges: readonly DiagramEdge[]): ReadonlyMap<string, number> {
	const result = new Map<string, number>();
	for (const group of parallelEdgeGroups(edges).values()) {
		const sorted = [...group].sort((left, right) => left.id.value.localeCompare(right.id.value));
		sorted.forEach((edge, index) => result.set(edge.id.value, index));
	}
	return result;
}

function parallelEdgeGroups(edges: readonly DiagramEdge[]): ReadonlyMap<string, DiagramEdge[]> {
	const groups = new Map<string, DiagramEdge[]>();
	for (const edge of edges) {
		const endpoints = [edge.source.value, edge.target.value].sort();
		const key = `${endpoints[0]}\u0000${endpoints[1]}`;
		const group = groups.get(key) ?? [];
		group.push(edge);
		groups.set(key, group);
	}
	return groups;
}

function edgeLabelRectangles(edge: DiagramEdge): readonly Rectangle[] {
	return [
		...(isNoteConnection(edge) ? [] : [pointRectangle(edge.id.value, edge.label, 88, 28)]),
		...(edge.sourceCardinalityLabel === undefined ? [] : [pointRectangle(edge.id.value, edge.sourceCardinalityLabel, 48, 22)]),
		...(edge.targetCardinalityLabel === undefined ? [] : [pointRectangle(edge.id.value, edge.targetCardinalityLabel, 48, 22)]),
	];
}

function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.extra.ontology_item_type === 'noteConnection'
		|| edge.source.value.startsWith('note_')
		|| edge.target.value.startsWith('note_');
}

function pointRectangle(id: string, point: Point, width: number, height: number): Rectangle {
	return {
		id,
		left: Math.max(0, point.x - (width / 2)),
		top: Math.max(0, point.y - (height / 2)),
		right: point.x + (width / 2),
		bottom: point.y + (height / 2),
	};
}

function rectangle(id: string, bounds: Bounds): Rectangle {
	return {
		id,
		left: bounds.x,
		top: bounds.y,
		right: bounds.x + bounds.width,
		bottom: bounds.y + bounds.height,
	};
}

function expandRectangle(value: Rectangle, amount: number): Rectangle {
	return {
		id: value.id,
		left: Math.max(0, roundCoordinate(value.left - amount)),
		top: Math.max(0, roundCoordinate(value.top - amount)),
		right: roundCoordinate(value.right + amount),
		bottom: roundCoordinate(value.bottom + amount),
	};
}

function rectanglesOverlap(left: Rectangle, right: Omit<Rectangle, 'id'>): boolean {
	return left.left <= right.right && right.left <= left.right
		&& left.top <= right.bottom && right.top <= left.bottom;
}

function segmentCrossesRectangleInterior(segment: Segment, value: Rectangle): boolean {
	const epsilon = 0.001;
	const left = value.left + epsilon;
	const right = value.right - epsilon;
	const top = value.top + epsilon;
	const bottom = value.bottom - epsilon;
	if (left >= right || top >= bottom) {
		return false;
	}

	let minimum = 0;
	let maximum = 1;
	const dx = segment.end.x - segment.start.x;
	const dy = segment.end.y - segment.start.y;
	for (const [p, q] of [
		[-dx, segment.start.x - left],
		[dx, right - segment.start.x],
		[-dy, segment.start.y - top],
		[dy, bottom - segment.start.y],
	] as const) {
		if (p === 0) {
			if (q < 0) { return false; }
			continue;
		}
		const ratio = q / p;
		if (p < 0) {
			minimum = Math.max(minimum, ratio);
		} else {
			maximum = Math.min(maximum, ratio);
		}
		if (minimum > maximum) { return false; }
	}
	return maximum >= minimum;
}

function segmentsCross(left: Segment, right: Segment): boolean {
	if (pointEquals(left.start, right.start) || pointEquals(left.start, right.end)
		|| pointEquals(left.end, right.start) || pointEquals(left.end, right.end)) {
		return false;
	}
	const first = orientation(left.start, left.end, right.start);
	const second = orientation(left.start, left.end, right.end);
	const third = orientation(right.start, right.end, left.start);
	const fourth = orientation(right.start, right.end, left.end);
	if (first !== second && third !== fourth) {
		return true;
	}
	return (first === 0 && pointOnSegment(right.start, left))
		|| (second === 0 && pointOnSegment(right.end, left))
		|| (third === 0 && pointOnSegment(left.start, right))
		|| (fourth === 0 && pointOnSegment(left.end, right));
}

function orientation(first: Point, second: Point, third: Point): -1 | 0 | 1 {
	const value = ((second.y - first.y) * (third.x - second.x))
		- ((second.x - first.x) * (third.y - second.y));
	return Math.abs(value) < 0.001 ? 0 : value > 0 ? 1 : -1;
}

function pointOnSegment(point: Point, segment: Segment): boolean {
	return point.x <= Math.max(segment.start.x, segment.end.x)
		&& point.x >= Math.min(segment.start.x, segment.end.x)
		&& point.y <= Math.max(segment.start.y, segment.end.y)
		&& point.y >= Math.min(segment.start.y, segment.end.y);
}

function simplifyOrthogonalPoints(points: readonly Point[]): readonly Point[] {
	const unique = points.filter((point, index) => index === 0 || !pointEquals(point, points[index - 1]));
	const simplified: Point[] = [];
	for (const point of unique) {
		const previous = simplified[simplified.length - 1];
		const beforePrevious = simplified[simplified.length - 2];
		if (beforePrevious !== undefined && previous !== undefined
			&& ((beforePrevious.x === previous.x && previous.x === point.x)
				|| (beforePrevious.y === previous.y && previous.y === point.y))) {
			simplified[simplified.length - 1] = point;
		} else {
			simplified.push(point);
		}
	}
	return simplified;
}

function fallbackOrthogonalPoints(source: Point, target: Point): readonly Point[] {
	if (source.x === target.x || source.y === target.y) {
		return [source, target];
	}
	const middleX = roundCoordinate((source.x + target.x) / 2);
	return [source, new Point(middleX, source.y), new Point(middleX, target.y), target];
}

function pathSegments(points: readonly Point[]): Segment[] {
	return points.slice(1).map((point, index) => ({ start: points[index], end: point }));
}

function pathLength(points: readonly Point[]): number {
	return points.slice(1).reduce((sum, point, index) => sum + distance(points[index], point), 0);
}

function manhattanDistance(left: Point, right: Point): number {
	return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function distance(left: Point, right: Point): number {
	return Math.hypot(left.x - right.x, left.y - right.y);
}

function boundsCenter(bounds: Bounds): Point {
	return new Point(
		roundCoordinate(bounds.x + (bounds.width / 2)),
		roundCoordinate(bounds.y + (bounds.height / 2)),
	);
}

function uniqueSorted(values: readonly number[]): number[] {
	return [...new Set(values.map(roundCoordinate))].sort((left, right) => left - right);
}

function stateKey(xIndex: number, yIndex: number, direction: TravelDirection): string {
	return `${xIndex},${yIndex},${direction}`;
}

function parseStateKey(key: string): { readonly xIndex: number; readonly yIndex: number } {
	const [xIndex, yIndex] = key.split(',');
	return { xIndex: Number(xIndex), yIndex: Number(yIndex) };
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(maximum, Math.max(minimum, value));
}

function pointEquals(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointEquals(point, right[index]));
}
