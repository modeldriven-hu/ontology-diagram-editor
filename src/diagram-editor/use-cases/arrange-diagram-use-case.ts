import { Bounds, DiagramEdge, DiagramNode, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from '../../shared/diagram-layout';
import { createDefaultDiagramLayoutAlgorithms, type DiagramLayoutAlgorithm, type DiagramLayoutEdgeRoute } from '../layout';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { boundaryPoint, closestBoundaryPointPair, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';

export class ArrangeDiagramUseCase {
	public constructor(
		private readonly algorithms: readonly DiagramLayoutAlgorithm[] = createDefaultDiagramLayoutAlgorithms(),
	) {}

	public async execute(
		diagram: OntologyDiagramDocument,
		algorithmId: DiagramLayoutAlgorithmId = defaultDiagramLayoutAlgorithmId,
		elkLayeredOptions?: ElkLayeredLayoutOptions,
	): Promise<DiagramMutationResult> {
		if (diagram.nodes.length === 0) {
			return { notification: 'There are no ontology nodes to arrange.' };
		}

		const algorithm = this.algorithms.find((candidate) => candidate.id === algorithmId);
		if (algorithm === undefined) {
			return { notification: `The diagram layout algorithm "${algorithmId}" is not available.` };
		}

		const layout = await algorithm.layout(
			diagram,
			algorithmId === 'elk-layered' ? elkLayeredOptions : undefined,
		);
		const arrangedBoundsById = layout.nodeBoundsById;
		const arrangedNodeIds = new Set(arrangedBoundsById.keys());
		const movedNodeIds = new Set<string>();
		const nextNodes = diagram.nodes.map((node) => {
			const bounds = arrangedBoundsById.get(node.id.value);
			if (bounds === undefined || boundsEqual(node.bounds, bounds)) {
				return node;
			}

			movedNodeIds.add(node.id.value);
			return new DiagramNode(
				node.id.value,
				node.ontologyRef.value,
				bounds,
				node.style,
				node.image,
				node.extra,
				node.showDataProperties,
				node.showType,
				node.showPropertyValues,
				node.propertyValueTextOverflow,
			);
		});

		const boundsByElementId = new Map([
			...nextNodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const nextEdges = diagram.edges.map((edge) => arrangeEdge(
			edge,
			boundsByElementId,
			arrangedNodeIds,
			layout.edgeRoutesById?.get(edge.id.value),
		));
		const changed = movedNodeIds.size > 0 || nextEdges.some((edge, index) => edge !== diagram.edges[index]);
		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				nodes: nextNodes,
				edges: nextEdges,
			}),
		};
	}
}

function arrangeEdge(
	edge: DiagramEdge,
	boundsByElementId: ReadonlyMap<string, Bounds>,
	arrangedNodeIds: ReadonlySet<string>,
	providedRoute?: DiagramLayoutEdgeRoute,
): DiagramEdge {
	if (!arrangedNodeIds.has(edge.source.value) && !arrangedNodeIds.has(edge.target.value)) {
		return edge;
	}

	const sourceBounds = boundsByElementId.get(edge.source.value);
	const targetBounds = boundsByElementId.get(edge.target.value);
	if (sourceBounds === undefined || targetBounds === undefined) {
		return edge;
	}

	const nextRoute = providedRoute ?? (edge.source.value === edge.target.value
		? selfLoopRoute(sourceBounds)
		: edgeRoute(edge, sourceBounds, targetBounds));
	if (samePoints(edge.points, nextRoute.points) && pointEquals(edge.label, nextRoute.label)) {
		return edge;
	}

	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		nextRoute.label,
		nextRoute.points,
		edge.style,
		edge.extra,
		edge.routeLayout,
	);
}

function selfLoopRoute(bounds: Bounds): { readonly label: Point; readonly points: readonly Point[] } {
	const points = selfLoopEdgePoints(bounds);
	return {
		label: selfLoopEdgeLabel(points),
		points,
	};
}

function edgeRoute(edge: DiagramEdge, sourceBounds: Bounds, targetBounds: Bounds): {
	readonly label: Point;
	readonly points: readonly Point[];
} {
	if (isNoteConnection(edge)) {
		const points = closestBoundaryPointPair(sourceBounds, targetBounds);
		return routeWithLabel([points.source, points.target]);
	}

	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);
	const source = boundaryPoint(sourceBounds, targetCenter);
	const target = boundaryPoint(targetBounds, sourceCenter);
	return routeWithLabel(edge.routeLayout === 'direct' ? [source, target] : orthogonalPoints(source, target));
}

function routeWithLabel(points: readonly Point[]): { readonly label: Point; readonly points: readonly Point[] } {
	return {
		label: midpoint(points[0], points[points.length - 1]),
		points,
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

function boundsEqual(left: Bounds, right: Bounds): boolean {
	return left.x === right.x
		&& left.y === right.y
		&& left.width === right.width
		&& left.height === right.height;
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
