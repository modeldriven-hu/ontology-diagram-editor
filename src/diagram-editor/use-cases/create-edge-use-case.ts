import { Bounds, DiagramEdge, DiagramNode, Point, type JsonObject, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNodeHeight, defaultNodeWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { boundaryPoint, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';
import { namespacesWithRequiredEdgePrefixes, ontologyReferencesEqual, resolveEdgeEndpoints, type ResolvedEdgeEndpoints } from './ontology-edge-endpoints';

interface EndpointNodes {
	readonly source: DiagramNode;
	readonly target: DiagramNode;
	readonly created: readonly DiagramNode[];
}

export class CreateEdgeUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		payload: ModelTreeItemDropPayload,
		position: CanvasPoint,
	): DiagramMutationResult {
		const resolved = resolveEdgeEndpoints(payload);
		if (resolved === undefined) {
			return { notification: 'This ontology item cannot create an edge in version 1.' };
		}
		if (resolved === 'ambiguous') {
			return { notification: 'Edge creation needs exactly one source and one target ontology item.' };
		}

		const endpointNodes = resolveOrCreateEndpointNodes(diagram, resolved, position);
		if (typeof endpointNodes === 'string') {
			return { notification: endpointNodes };
		}

		const existingEdge = diagram.edges.find((edge) =>
			ontologyReferencesEqual(edge.ontologyRef.value, resolved.edgeOntologyRef, diagram.namespaces)
			&& edge.source.value === endpointNodes.source.id.value
			&& edge.target.value === endpointNodes.target.id.value,
		);
		if (existingEdge !== undefined) {
			return { notification: `"${payload.displayLabel}" already has an edge in this diagram.` };
		}

		const route = edgeRoute(endpointNodes.source, endpointNodes.target);
		const edge = new DiagramEdge(
			nextElementId(diagram.edges.map((existing) => existing.id.value), 'edge'),
			endpointNodes.source.id.value,
			endpointNodes.target.id.value,
			resolved.edgeOntologyRef,
			route.label,
			route.points,
			undefined,
			edgeExtraFields(payload),
		);

		return {
			diagram: cloneDiagram(diagram, {
				namespaces: namespacesWithRequiredEdgePrefixes(diagram, resolved),
				nodes: [...diagram.nodes, ...endpointNodes.created],
				edges: [...diagram.edges, edge],
			}),
		};
	}
}

function edgeRoute(source: DiagramNode, target: DiagramNode): {
	readonly label: Point;
	readonly points: readonly Point[];
} {
	if (source.id.value === target.id.value) {
		const points = selfLoopEdgePoints(source.bounds);
		return {
			label: selfLoopEdgeLabel(points),
			points,
		};
	}

	const points = edgePoints(source.bounds, target.bounds);
	return {
		label: midpoint(points[0], points[points.length - 1]),
		points,
	};
}

function resolveOrCreateEndpointNodes(
	diagram: OntologyDiagramDocument,
	resolved: ResolvedEdgeEndpoints,
	position: CanvasPoint,
): EndpointNodes | string {
	const sourceMatches = diagram.nodes.filter((node) => ontologyReferencesEqual(node.ontologyRef.value, resolved.sourceOntologyRef, diagram.namespaces));
	const targetMatches = diagram.nodes.filter((node) => ontologyReferencesEqual(node.ontologyRef.value, resolved.targetOntologyRef, diagram.namespaces));
	if (sourceMatches.length > 1 || targetMatches.length > 1) {
		return 'Edge endpoint ontology items must not appear more than once on the canvas.';
	}

	const created: DiagramNode[] = [];
	if (resolved.sourceOntologyRef === resolved.targetOntologyRef) {
		const node = sourceMatches[0] ?? createEndpointNode(
			diagram,
			created,
			resolved.sourceOntologyRef,
			resolved.sourceNodeType,
			selfEndpointBounds(position),
		);
		created.push(...(sourceMatches[0] === undefined ? [node] : []));

		return {
			source: node,
			target: node,
			created,
		};
	}

	const source = sourceMatches[0] ?? createEndpointNode(
		diagram,
		created,
		resolved.sourceOntologyRef,
		resolved.sourceNodeType,
		sourceBounds(position, targetMatches[0]),
	);
	created.push(...(sourceMatches[0] === undefined ? [source] : []));

	const target = targetMatches[0] ?? createEndpointNode(
		diagram,
		created,
		resolved.targetOntologyRef,
		resolved.targetNodeType,
		targetBounds(position, source),
	);
	created.push(...(targetMatches[0] === undefined ? [target] : []));

	return {
		source,
		target,
		created,
	};
}

function createEndpointNode(
	diagram: OntologyDiagramDocument,
	created: readonly DiagramNode[],
	ontologyRef: string,
	ontologyItemType: 'class' | 'datatype',
	bounds: Bounds,
): DiagramNode {
	return new DiagramNode(
		nextElementId([
			...diagram.nodes.map((node) => node.id.value),
			...created.map((node) => node.id.value),
		], 'node'),
		ontologyRef,
		bounds,
		undefined,
		undefined,
		{ ontology_item_type: ontologyItemType },
	);
}

function selfEndpointBounds(position: CanvasPoint): Bounds {
	return new Bounds(
		roundCoordinate(position.x - defaultNodeWidth / 2),
		roundCoordinate(position.y),
		defaultNodeWidth,
		defaultNodeHeight,
	);
}

function sourceBounds(position: CanvasPoint, existingTarget: DiagramNode | undefined): Bounds {
	if (existingTarget !== undefined) {
		return new Bounds(
			roundCoordinate(existingTarget.bounds.x - defaultNodeWidth - 160),
			roundCoordinate(existingTarget.bounds.y),
			defaultNodeWidth,
			defaultNodeHeight,
		);
	}

	return new Bounds(
		roundCoordinate(position.x - defaultNodeWidth - 80),
		roundCoordinate(position.y),
		defaultNodeWidth,
		defaultNodeHeight,
	);
}

function targetBounds(position: CanvasPoint, source: DiagramNode): Bounds {
	return new Bounds(
		roundCoordinate(source.bounds.x + source.bounds.width + 160),
		roundCoordinate(source.bounds.y),
		defaultNodeWidth,
		defaultNodeHeight,
	);
}

function edgePoints(sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] | readonly [Point, Point, Point, Point] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);

	return orthogonalPoints(
		boundaryPoint(sourceBounds, targetCenter),
		boundaryPoint(targetBounds, sourceCenter),
	);
}

function orthogonalPoints(source: Point, target: Point): readonly [Point, Point] | readonly [Point, Point, Point, Point] {
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

function midpoint(source: Point, target: Point): Point {
	return new Point(
		roundCoordinate((source.x + target.x) / 2),
		roundCoordinate((source.y + target.y) / 2),
	);
}

function center(bounds: Bounds): Point {
	return new Point(
		bounds.x + (bounds.width / 2),
		bounds.y + (bounds.height / 2),
	);
}

function edgeExtraFields(payload: ModelTreeItemDropPayload): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}
