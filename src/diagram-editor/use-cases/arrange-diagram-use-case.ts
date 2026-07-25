import { Bounds, DiagramEdge, DiagramNode, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from '../../shared/diagram-layout';
import { createDefaultDiagramLayoutAlgorithms, type DiagramLayoutAlgorithm, type DiagramLayoutEdgeRoute } from '../layout';
import { copyNodeWithBounds, createDocumentContainmentIndex, layoutContainmentNodes, type DocumentContainmentIndex } from './containment-layout';
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
		selectedNodeIds?: readonly string[],
	): Promise<DiagramMutationResult> {
		if (diagram.nodes.length === 0) {
			return { notification: 'There are no ontology nodes to arrange.' };
		}

		const algorithm = this.algorithms.find((candidate) => candidate.id === algorithmId);
		if (algorithm === undefined) {
			return { notification: `The diagram layout algorithm "${algorithmId}" is not available.` };
		}

		const containment = createDocumentContainmentIndex(diagram);
		const normalizedNodes = layoutContainmentNodes(diagram, containment);
		const normalizedDiagram = cloneDiagram(diagram, { nodes: normalizedNodes });
		const scope = compoundLayoutScope(normalizedDiagram, containment, selectedNodeIds);
		const layout = await algorithm.layout(
			scope.diagram,
			algorithmId === 'elk-layered' ? elkLayeredOptions : undefined,
		);
		const arrangedRootBoundsById = layout.nodeBoundsById;
		const arrangedNodeIds = arrangedCompoundNodeIds(containment, arrangedRootBoundsById);
		const nextNodes = applyCompoundRootBounds(normalizedNodes, containment, arrangedRootBoundsById);

		const boundsByElementId = new Map([
			...nextNodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const nextEdges = diagram.edges.map((edge) => arrangeEdge(
			edge,
			boundsByElementId,
			arrangedNodeIds,
			scope.routeEligibleEdgeIds.has(edge.id.value)
				? layout.edgeRoutesById?.get(edge.id.value)
				: undefined,
		));
		const changed = nextNodes.some((node, index) => node !== diagram.nodes[index])
			|| nextEdges.some((edge, index) => edge !== diagram.edges[index]);
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

interface CompoundLayoutScope {
	readonly diagram: OntologyDiagramDocument;
	readonly routeEligibleEdgeIds: ReadonlySet<string>;
}

function compoundLayoutScope(
	diagram: OntologyDiagramDocument,
	containment: DocumentContainmentIndex,
	selectedNodeIds: readonly string[] | undefined,
): CompoundLayoutScope {
	const allRootIds = new Set(containment.nodeIdsByRootId.keys());
	const selectedRootIds = selectedNodeIds === undefined || selectedNodeIds.length === 0
		? allRootIds
		: new Set(selectedNodeIds.flatMap((nodeId) => {
			const rootId = containment.rootByNodeId.get(nodeId);
			return rootId === undefined ? [] : [rootId];
		}));
	const scopedRootIds = selectedRootIds.size === 0 ? allRootIds : selectedRootIds;
	const rootNodes = diagram.nodes.filter((node) => scopedRootIds.has(node.id.value));
	const nodeIds = new Set(diagram.nodes.map((node) => node.id.value));
	const routeEligibleEdgeIds = new Set<string>();
	const projectedEdges = diagram.edges.flatMap((edge) => {
		if (edge.renderAs === 'containment'
			|| !nodeIds.has(edge.source.value)
			|| !nodeIds.has(edge.target.value)) {
			return [];
		}
		const sourceRootId = containment.rootByNodeId.get(edge.source.value);
		const targetRootId = containment.rootByNodeId.get(edge.target.value);
		if (sourceRootId === undefined
			|| targetRootId === undefined
			|| sourceRootId === targetRootId
			|| !scopedRootIds.has(sourceRootId)
			|| !scopedRootIds.has(targetRootId)) {
			return [];
		}
		if (sourceRootId === edge.source.value && targetRootId === edge.target.value) {
			routeEligibleEdgeIds.add(edge.id.value);
			return [edge];
		}
		return [new DiagramEdge(
			edge.id.value,
			sourceRootId,
			targetRootId,
			edge.ontologyRef.value,
			edge.label,
			edge.points,
			edge.style,
			edge.extra,
			edge.routeLayout,
		)];
	});

	return {
		diagram: cloneDiagram(diagram, {
			nodes: rootNodes,
			edges: projectedEdges,
		}),
		routeEligibleEdgeIds,
	};
}

function arrangedCompoundNodeIds(
	containment: DocumentContainmentIndex,
	arrangedRootBoundsById: ReadonlyMap<string, Bounds>,
): ReadonlySet<string> {
	return new Set([...arrangedRootBoundsById.keys()].flatMap((rootId) =>
		containment.nodeIdsByRootId.get(rootId) ?? []));
}

function applyCompoundRootBounds(
	nodes: readonly DiagramNode[],
	containment: DocumentContainmentIndex,
	arrangedRootBoundsById: ReadonlyMap<string, Bounds>,
): readonly DiagramNode[] {
	const nodeById = new Map(nodes.map((node) => [node.id.value, node]));
	const deltaByRootId = new Map<string, { readonly x: number; readonly y: number }>();
	for (const [rootId, arrangedBounds] of arrangedRootBoundsById) {
		const root = nodeById.get(rootId);
		if (root !== undefined) {
			deltaByRootId.set(rootId, {
				x: arrangedBounds.x - root.bounds.x,
				y: arrangedBounds.y - root.bounds.y,
			});
		}
	}

	return nodes.map((node) => {
		const rootId = containment.rootByNodeId.get(node.id.value);
		const delta = rootId === undefined ? undefined : deltaByRootId.get(rootId);
		if (rootId === undefined || delta === undefined) {
			return node;
		}
		const arrangedRootBounds = arrangedRootBoundsById.get(rootId);
		const bounds = node.id.value === rootId && arrangedRootBounds !== undefined
			? new Bounds(
				arrangedRootBounds.x,
				arrangedRootBounds.y,
				Math.max(node.bounds.width, arrangedRootBounds.width),
				Math.max(node.bounds.height, arrangedRootBounds.height),
			)
			: new Bounds(
				node.bounds.x + delta.x,
				node.bounds.y + delta.y,
				node.bounds.width,
				node.bounds.height,
			);
		return copyNodeWithBounds(node, bounds);
	});
}

function arrangeEdge(
	edge: DiagramEdge,
	boundsByElementId: ReadonlyMap<string, Bounds>,
	arrangedNodeIds: ReadonlySet<string>,
	providedRoute?: DiagramLayoutEdgeRoute,
): DiagramEdge {
	if (edge.renderAs === 'containment') {
		return edge;
	}
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
		edge.renderAs,
		edge.containmentDirection,
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
