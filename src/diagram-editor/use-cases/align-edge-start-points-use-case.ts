import { DiagramEdge, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

type EdgeEndpoint = 'start' | 'end';

export class AlignEdgeStartPointsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		edgeIds: readonly string[],
	): DiagramMutationResult {
		return alignSelectedEdgeEndpoint(diagram, edgeIds, 'start');
	}
}

export class AlignEdgeEndPointsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		edgeIds: readonly string[],
	): DiagramMutationResult {
		return alignSelectedEdgeEndpoint(diagram, edgeIds, 'end');
	}
}

function pointEquals(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

function samePoints(left: readonly Point[], right: readonly Point[]): boolean {
	return left.length === right.length && left.every((point, index) => pointEquals(point, right[index]));
}

function alignSelectedEdgeEndpoint(
	diagram: OntologyDiagramDocument,
	edgeIds: readonly string[],
	endpoint: EdgeEndpoint,
): DiagramMutationResult {
	const selectedEdgeIds = [...new Set(edgeIds)];
	if (selectedEdgeIds.length < 2) {
		return { notification: endpoint === 'start'
			? 'Select two or more edges to align their start positions.'
			: 'Select two or more edges to align their end positions.' };
	}

	const edgeById = new Map(diagram.edges.map((edge) => [edge.id.value, edge]));
	const referenceEdge = edgeById.get(selectedEdgeIds[0]);
	if (referenceEdge === undefined) {
		return { notification: 'The first selected edge was not found.' };
	}

	const referencePoint = endpointPoint(referenceEdge, endpoint);
	let changed = false;
	const selectedIds = new Set(selectedEdgeIds);
	const nextEdges = diagram.edges.map((edge) => {
		if (!selectedIds.has(edge.id.value) || !sharesReferenceEndpoint(edge, referenceEdge, endpoint) || edge.id.value === referenceEdge.id.value) {
			return edge;
		}

		const points = replaceEndpoint(edge.points, referencePoint, endpoint);
		if (samePoints(edge.points, points)) {
			return edge;
		}

		changed = true;
		return new DiagramEdge(
			edge.id.value,
			edge.source.value,
			edge.target.value,
			edge.ontologyRef.value,
			edge.label,
			points,
			edge.style,
			edge.extra,
			edge.routeLayout,
		);
	});

	return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
}

function sharesReferenceEndpoint(edge: DiagramEdge, referenceEdge: DiagramEdge, endpoint: EdgeEndpoint): boolean {
	return endpoint === 'start'
		? edge.source.value === referenceEdge.source.value
		: edge.target.value === referenceEdge.target.value;
}

function endpointPoint(edge: DiagramEdge, endpoint: EdgeEndpoint): Point {
	return endpoint === 'start'
		? edge.points[0]
		: edge.points[edge.points.length - 1];
}

function replaceEndpoint(points: readonly Point[], referencePoint: Point, endpoint: EdgeEndpoint): readonly Point[] {
	return endpoint === 'start'
		? [
			new Point(referencePoint.x, referencePoint.y),
			...points.slice(1),
		]
		: [
			...points.slice(0, -1),
			new Point(referencePoint.x, referencePoint.y),
		];
}
