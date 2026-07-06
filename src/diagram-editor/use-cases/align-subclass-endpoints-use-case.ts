import { Bounds, DiagramEdge, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { roundCoordinate } from './geometry';
import { ontologyReferencesEqual } from './ontology-edge-endpoints';

type BoundsSide = 'left' | 'right' | 'top' | 'bottom';

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

		const sourceGroupCenter = boundsCenter(groupBounds(selectedNodes.map((node) => node.bounds)));
		const targetSide = nearestSide(targetNode.bounds, sourceGroupCenter);
		const targetPoint = sideMidpoint(targetNode.bounds, targetSide);
		const targetApproachPoint = approachPoint(targetPoint, targetSide);
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

			const sourceSide = nearestSide(sourceNode.bounds, targetPoint);
			const sourcePoint = sideMidpoint(sourceNode.bounds, sourceSide);
			const nextPoints = alignedRoutePoints(edge.points, sourcePoint, targetApproachPoint, targetPoint);
			if (samePoints(edge.points, nextPoints)) {
				return edge;
			}

			changed = true;
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

function nearestSide(bounds: Bounds, point: Point): BoundsSide {
	const sides: readonly BoundsSide[] = ['left', 'right', 'top', 'bottom'];
	return sides
		.map((side) => ({ side, point: sideMidpoint(bounds, side) }))
		.sort((left, right) => pointDistanceSquared(left.point, point) - pointDistanceSquared(right.point, point))[0]?.side ?? 'right';
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

function approachPoint(targetPoint: Point, side: BoundsSide): Point {
	const offset = 40;
	switch (side) {
		case 'left':
			return new Point(roundCoordinate(targetPoint.x - offset), targetPoint.y);
		case 'right':
			return new Point(roundCoordinate(targetPoint.x + offset), targetPoint.y);
		case 'top':
			return new Point(targetPoint.x, roundCoordinate(targetPoint.y - offset));
		case 'bottom':
			return new Point(targetPoint.x, roundCoordinate(targetPoint.y + offset));
	}
}

function pointDistanceSquared(left: Point, right: Point): number {
	return (left.x - right.x) ** 2 + (left.y - right.y) ** 2;
}

function alignedRoutePoints(
	points: readonly Point[],
	sourcePoint: Point,
	targetApproachPoint: Point,
	targetPoint: Point,
): readonly Point[] {
	return withoutConsecutiveDuplicatePoints([
		sourcePoint,
		...points.slice(1, -1),
		targetApproachPoint,
		targetPoint,
	]);
}

function withoutConsecutiveDuplicatePoints(points: readonly Point[]): readonly Point[] {
	return points.filter((point, index) => {
		const previous = points[index - 1];
		return previous === undefined || !pointsEqual(previous, point);
	});
}

function pointsEqual(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointsEqual(point, right[index]));
}
