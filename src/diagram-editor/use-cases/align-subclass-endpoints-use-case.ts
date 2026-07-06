import { Bounds, DiagramEdge, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { roundCoordinate } from './geometry';
import { ontologyReferencesEqual } from './ontology-edge-endpoints';

type BoundsSide = 'left' | 'right' | 'top' | 'bottom';
type GeneralizationSetRoute = {
	readonly sourceSide: BoundsSide;
	readonly targetSide: BoundsSide;
	readonly targetPoint: Point;
	readonly sharedAxisCoordinate: number;
};

export class AlignSubclassEndpointsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		nodeIds: readonly string[],
	): DiagramMutationResult {
		const selectedNodeIds = [...new Set(nodeIds)];
		if (selectedNodeIds.length < 2) {
			return { notification: 'Select at least two subclass nodes to align.' };
		}

		const nodeById = new Map(diagram.nodes.map((node) => [node.id.value, node] as const));
		const selectedNodes = selectedNodeIds.flatMap((id) => {
			const node = nodeById.get(id);
			return node === undefined ? [] : [node];
		});
		if (selectedNodes.length !== selectedNodeIds.length) {
			return { notification: 'Select only ontology nodes to align subclass endpoints.' };
		}

		const selectedIds = new Set(selectedNodeIds);
		const subclassEdges = diagram.edges.filter((edge) =>
			selectedIds.has(edge.source.value) && isSubclassRelationship(edge, diagram),
		);
		const commonTargetIds = sharedTargetIds(selectedNodeIds, subclassEdges);
		if (commonTargetIds.length === 0) {
			return { notification: 'Selected nodes do not share the same superclass edge.' };
		}
		if (commonTargetIds.length > 1) {
			return { notification: 'Selected nodes share more than one superclass edge.' };
		}

		const targetId = commonTargetIds[0];
		const targetNode = nodeById.get(targetId);
		if (targetNode === undefined) {
			return { notification: 'The shared superclass is not an ontology node.' };
		}

		const selectedBounds = groupBounds(selectedNodes.map((node) => node.bounds));
		const route = generalizationSetRoute(selectedBounds, targetNode.bounds);
		const edgeBySource = new Map(subclassEdges
			.filter((edge) => edge.target.value === targetId)
			.map((edge) => [edge.source.value, edge] as const));
		const edgeIds = new Set(selectedNodeIds.flatMap((nodeId) => {
			const edge = edgeBySource.get(nodeId);
			return edge === undefined ? [] : [edge.id.value];
		}));
		if (edgeIds.size !== selectedNodeIds.length) {
			return { notification: 'Each selected node needs a subclass edge to the same superclass node.' };
		}

		let changed = false;
		const nextEdges = diagram.edges.map((edge) => {
			if (!edgeIds.has(edge.id.value)) {
				return edge;
			}

			const sourceNode = nodeById.get(edge.source.value);
			if (sourceNode === undefined) {
				return edge;
			}

			const nextPoints = generalizationSetRoutePoints(sourceNode.bounds, route);
			const nextLabel = routeMiddlePoint(nextPoints);
			const nextRouteLayout = edge.routeLayout === undefined || edge.routeLayout === 'orthogonal'
				? edge.routeLayout
				: 'orthogonal';
			if (samePoints(edge.points, nextPoints) && pointsEqual(edge.label, nextLabel) && edge.routeLayout === nextRouteLayout) {
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
				nextRouteLayout,
			);
		});

		return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
	}
}

function sharedTargetIds(selectedNodeIds: readonly string[], subclassEdges: readonly DiagramEdge[]): readonly string[] {
	const targetsBySource = new Map(selectedNodeIds.map((nodeId) => [
		nodeId,
		new Set(subclassEdges.filter((edge) => edge.source.value === nodeId).map((edge) => edge.target.value)),
	] as const));
	const firstTargets = targetsBySource.get(selectedNodeIds[0]);
	if (firstTargets === undefined || firstTargets.size === 0) {
		return [];
	}

	return [...firstTargets].filter((targetId) =>
		selectedNodeIds.every((nodeId) => targetsBySource.get(nodeId)?.has(targetId) === true),
	);
}

function isSubclassRelationship(edge: DiagramEdge, diagram: OntologyDiagramDocument): boolean {
	return edge.extra.ontology_item_type === 'subclassRelationship'
		|| ontologyReferencesEqual(edge.ontologyRef.value, 'rdfs:subClassOf', diagram.namespaces);
}

function groupBounds(bounds: readonly Bounds[]): Bounds {
	const minX = Math.min(...bounds.map((value) => value.x));
	const minY = Math.min(...bounds.map((value) => value.y));
	const maxX = Math.max(...bounds.map((value) => value.x + value.width));
	const maxY = Math.max(...bounds.map((value) => value.y + value.height));

	return new Bounds(minX, minY, maxX - minX, maxY - minY);
}

function boundsCenter(bounds: Bounds): Point {
	return new Point(
		roundCoordinate(bounds.x + bounds.width / 2),
		roundCoordinate(bounds.y + bounds.height / 2),
	);
}

function generalizationSetRoute(selectedBounds: Bounds, targetBounds: Bounds): GeneralizationSetRoute {
	const selectedCenter = boundsCenter(selectedBounds);
	const targetCenter = boundsCenter(targetBounds);
	const targetSide = dominantSide(targetCenter, selectedCenter);
	const sourceSide = oppositeSide(targetSide);
	const targetPoint = sideMidpoint(targetBounds, targetSide);

	return {
		sourceSide,
		targetSide,
		targetPoint,
		sharedAxisCoordinate: sharedAxisCoordinate(selectedBounds, targetPoint, targetSide),
	};
}

function dominantSide(origin: Point, point: Point): BoundsSide {
	const dx = point.x - origin.x;
	const dy = point.y - origin.y;
	if (Math.abs(dx) > Math.abs(dy)) {
		return dx < 0 ? 'left' : 'right';
	}

	return dy < 0 ? 'top' : 'bottom';
}

function sideMidpoint(bounds: Bounds, side: BoundsSide): Point {
	const centerX = roundCoordinate(bounds.x + bounds.width / 2);
	const centerY = roundCoordinate(bounds.y + bounds.height / 2);
	switch (side) {
		case 'left':
			return new Point(roundCoordinate(bounds.x), centerY);
		case 'right':
			return new Point(roundCoordinate(bounds.x + bounds.width), centerY);
		case 'top':
			return new Point(centerX, roundCoordinate(bounds.y));
		case 'bottom':
			return new Point(centerX, roundCoordinate(bounds.y + bounds.height));
	}
}

function oppositeSide(side: BoundsSide): BoundsSide {
	switch (side) {
		case 'left':
			return 'right';
		case 'right':
			return 'left';
		case 'top':
			return 'bottom';
		case 'bottom':
			return 'top';
	}
}

function sharedAxisCoordinate(selectedBounds: Bounds, targetPoint: Point, targetSide: BoundsSide): number {
	const fallbackOffset = 40;
	switch (targetSide) {
		case 'left': {
			const selectedEdge = selectedBounds.x + selectedBounds.width;
			return roundCoordinate(targetPoint.x > selectedEdge
				? (selectedEdge + targetPoint.x) / 2
				: selectedEdge + fallbackOffset);
		}
		case 'right': {
			const selectedEdge = selectedBounds.x;
			return roundCoordinate(targetPoint.x < selectedEdge
				? (selectedEdge + targetPoint.x) / 2
				: selectedEdge - fallbackOffset);
		}
		case 'top': {
			const selectedEdge = selectedBounds.y + selectedBounds.height;
			return roundCoordinate(targetPoint.y > selectedEdge
				? (selectedEdge + targetPoint.y) / 2
				: selectedEdge + fallbackOffset);
		}
		case 'bottom': {
			const selectedEdge = selectedBounds.y;
			return roundCoordinate(targetPoint.y < selectedEdge
				? (selectedEdge + targetPoint.y) / 2
				: selectedEdge - fallbackOffset);
		}
	}
}

function generalizationSetRoutePoints(sourceBounds: Bounds, route: GeneralizationSetRoute): readonly Point[] {
	const sourcePoint = sideMidpoint(sourceBounds, route.sourceSide);
	const points = route.targetSide === 'left' || route.targetSide === 'right'
		? [
			sourcePoint,
			new Point(route.sharedAxisCoordinate, sourcePoint.y),
			new Point(route.sharedAxisCoordinate, route.targetPoint.y),
			route.targetPoint,
		]
		: [
			sourcePoint,
			new Point(sourcePoint.x, route.sharedAxisCoordinate),
			new Point(route.targetPoint.x, route.sharedAxisCoordinate),
			route.targetPoint,
		];

	return withoutRedundantPoints(points);
}

function withoutRedundantPoints(points: readonly Point[]): readonly Point[] {
	const withoutDuplicates = points.filter((point, index) => {
		const previous = points[index - 1];
		return previous === undefined || !pointsEqual(previous, point);
	});

	const withoutCollinearPoints = withoutDuplicates.filter((point, index) => {
		const previous = withoutDuplicates[index - 1];
		const next = withoutDuplicates[index + 1];
		return previous === undefined || next === undefined || !areCollinear(previous, point, next);
	});

	return withoutCollinearPoints.length >= 2
		? withoutCollinearPoints
		: [points[0], points[points.length - 1]];
}

function areCollinear(first: Point, second: Point, third: Point): boolean {
	return first.x === second.x && second.x === third.x
		|| first.y === second.y && second.y === third.y;
}

function routeMiddlePoint(points: readonly Point[]): Point {
	const totalLength = routeLength(points);
	if (totalLength === 0) {
		return points[0];
	}

	const targetLength = totalLength / 2;
	let traversedLength = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = pointDistance(start, end);
		if (segmentLength === 0) {
			continue;
		}
		if (traversedLength + segmentLength >= targetLength) {
			const ratio = (targetLength - traversedLength) / segmentLength;
			return new Point(
				roundCoordinate(start.x + (end.x - start.x) * ratio),
				roundCoordinate(start.y + (end.y - start.y) * ratio),
			);
		}

		traversedLength += segmentLength;
	}

	return points[points.length - 1];
}

function routeLength(points: readonly Point[]): number {
	return points.slice(1).reduce((length, point, index) =>
		length + pointDistance(points[index], point), 0);
}

function pointDistance(left: Point, right: Point): number {
	return Math.abs(left.x - right.x) + Math.abs(left.y - right.y);
}

function pointsEqual(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointsEqual(point, right[index]));
}
