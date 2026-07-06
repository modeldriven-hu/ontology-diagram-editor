import { Bounds, DiagramEdge, DiagramNode, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { boundaryPoint, closestBoundaryPointPair, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';

const canvasMargin = 80;
const horizontalGap = 180;
const verticalGap = 72;

export class ArrangeDiagramUseCase {
	public execute(diagram: OntologyDiagramDocument): DiagramMutationResult {
		if (diagram.nodes.length === 0) {
			return { notification: 'There are no ontology nodes to arrange.' };
		}

		const arrangedBoundsById = arrangeNodeBounds(diagram);
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
			);
		});

		const boundsByElementId = new Map([
			...nextNodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const nextEdges = diagram.edges.map((edge) => arrangeEdge(edge, boundsByElementId, arrangedNodeIds));
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

function arrangeNodeBounds(diagram: OntologyDiagramDocument): ReadonlyMap<string, Bounds> {
	const layerByNodeId = nodeLayers(diagram);
	const nodesByLayer = new Map<number, DiagramNode[]>();
	for (const node of diagram.nodes) {
		const layer = layerByNodeId.get(node.id.value) ?? 0;
		const nodes = nodesByLayer.get(layer) ?? [];
		nodes.push(node);
		nodesByLayer.set(layer, nodes);
	}

	const arranged = new Map<string, Bounds>();
	let x = canvasMargin;
	for (const layer of [...nodesByLayer.keys()].sort((left, right) => left - right)) {
		const nodes = nodesByLayer.get(layer) ?? [];
		const layerWidth = Math.max(...nodes.map((node) => node.bounds.width));
		let y = canvasMargin;
		for (const node of nodes) {
			arranged.set(node.id.value, new Bounds(
				roundCoordinate(x),
				roundCoordinate(y),
				node.bounds.width,
				node.bounds.height,
			));
			y += node.bounds.height + verticalGap;
		}

		x += layerWidth + horizontalGap;
	}

	return arranged;
}

function nodeLayers(diagram: OntologyDiagramDocument): ReadonlyMap<string, number> {
	const nodeIds = new Set(diagram.nodes.map((node) => node.id.value));
	const nodeOrder = new Map(diagram.nodes.map((node, index) => [node.id.value, index]));
	const outgoing = new Map<string, Set<string>>();
	const incomingCount = new Map(diagram.nodes.map((node) => [node.id.value, 0]));

	for (const edge of diagram.edges) {
		if (!nodeIds.has(edge.source.value) || !nodeIds.has(edge.target.value) || edge.source.value === edge.target.value) {
			continue;
		}

		const targets = outgoing.get(edge.source.value) ?? new Set<string>();
		if (targets.has(edge.target.value)) {
			continue;
		}

		targets.add(edge.target.value);
		outgoing.set(edge.source.value, targets);
		incomingCount.set(edge.target.value, (incomingCount.get(edge.target.value) ?? 0) + 1);
	}

	const layerByNodeId = new Map<string, number>();
	const queue = diagram.nodes
		.filter((node) => incomingCount.get(node.id.value) === 0)
		.map((node) => node.id.value);
	for (const nodeId of queue) {
		layerByNodeId.set(nodeId, 0);
	}

	for (let index = 0; index < queue.length; index += 1) {
		const sourceId = queue[index];
		const sourceLayer = layerByNodeId.get(sourceId) ?? 0;
		const targets = [...(outgoing.get(sourceId) ?? [])].sort((left, right) => (nodeOrder.get(left) ?? 0) - (nodeOrder.get(right) ?? 0));
		for (const targetId of targets) {
			layerByNodeId.set(targetId, Math.max(layerByNodeId.get(targetId) ?? 0, sourceLayer + 1));
			const nextIncomingCount = (incomingCount.get(targetId) ?? 0) - 1;
			incomingCount.set(targetId, nextIncomingCount);
			if (nextIncomingCount === 0) {
				queue.push(targetId);
			}
		}
	}

	const fallbackLayer = layerByNodeId.size === 0 ? 0 : Math.max(...layerByNodeId.values()) + 1;
	for (const node of diagram.nodes) {
		if (!layerByNodeId.has(node.id.value)) {
			layerByNodeId.set(node.id.value, fallbackLayer);
		}
	}

	return layerByNodeId;
}

function arrangeEdge(
	edge: DiagramEdge,
	boundsByElementId: ReadonlyMap<string, Bounds>,
	arrangedNodeIds: ReadonlySet<string>,
): DiagramEdge {
	if (!arrangedNodeIds.has(edge.source.value) && !arrangedNodeIds.has(edge.target.value)) {
		return edge;
	}

	const sourceBounds = boundsByElementId.get(edge.source.value);
	const targetBounds = boundsByElementId.get(edge.target.value);
	if (sourceBounds === undefined || targetBounds === undefined) {
		return edge;
	}

	const nextRoute = edge.source.value === edge.target.value
		? selfLoopRoute(sourceBounds)
		: edgeRoute(edge, sourceBounds, targetBounds);
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
