import { Bounds, DiagramEdge, DiagramNode, Point, type JsonObject, type OntologyDiagramDocument } from '../../odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNodeHeight, defaultNodeWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { boundaryPoint, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';

interface ResolvedEdgeEndpoints {
	readonly edgeOntologyRef: string;
	readonly sourceOntologyRef: string;
	readonly targetOntologyRef: string;
	readonly sourceNodeType: 'class';
	readonly targetNodeType: 'class' | 'datatype';
}

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
		const resolved = resolveEndpoints(payload);
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
			edge.ontologyRef.value === resolved.edgeOntologyRef
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
		label: midpoint(points[0], points[1]),
		points,
	};
}

function resolveEndpoints(payload: ModelTreeItemDropPayload): ResolvedEdgeEndpoints | 'ambiguous' | undefined {
	const metadata = payload.ontologyItemMetadata;
	if (!isObject(metadata)) {
		return undefined;
	}

	if (payload.ontologyItemType === 'objectProperty') {
		const source = singleString(metadata.domainReferences);
		const target = singleString(metadata.rangeReferences);
		return resolvedPropertyEndpoints(payload.ontologyItemReference, source, target, 'class');
	}

	if (payload.ontologyItemType === 'dataProperty') {
		const source = singleString(metadata.domainReferences);
		const target = singleString(metadata.rangeReferences);
		return resolvedPropertyEndpoints(payload.ontologyItemReference, source, target, 'datatype');
	}

	if (payload.ontologyItemType === 'subclassRelationship') {
		const source = stringValue(metadata.subclassReference);
		const target = stringValue(metadata.superclassReference);
		return resolvedPropertyEndpoints('rdfs:subClassOf', source, target, 'class');
	}

	return undefined;
}

function resolvedPropertyEndpoints(
	edgeOntologyRef: string,
	sourceOntologyRef: string | 'ambiguous' | undefined,
	targetOntologyRef: string | 'ambiguous' | undefined,
	targetNodeType: 'class' | 'datatype',
): ResolvedEdgeEndpoints | 'ambiguous' {
	if (sourceOntologyRef === 'ambiguous' || targetOntologyRef === 'ambiguous' || sourceOntologyRef === undefined || targetOntologyRef === undefined) {
		return 'ambiguous';
	}

	return {
		edgeOntologyRef,
		sourceOntologyRef,
		targetOntologyRef,
		sourceNodeType: 'class',
		targetNodeType,
	};
}

function resolveOrCreateEndpointNodes(
	diagram: OntologyDiagramDocument,
	resolved: ResolvedEdgeEndpoints,
	position: CanvasPoint,
): EndpointNodes | string {
	const sourceMatches = diagram.nodes.filter((node) => node.ontologyRef.value === resolved.sourceOntologyRef);
	const targetMatches = diagram.nodes.filter((node) => node.ontologyRef.value === resolved.targetOntologyRef);
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

function edgePoints(sourceBounds: Bounds, targetBounds: Bounds): readonly [Point, Point] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);

	return [
		boundaryPoint(sourceBounds, targetCenter),
		boundaryPoint(targetBounds, sourceCenter),
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

function singleString(value: unknown): string | 'ambiguous' | undefined {
	if (!Array.isArray(value) || value.length !== 1) {
		return value === undefined ? undefined : 'ambiguous';
	}

	return typeof value[0] === 'string' && value[0].length > 0 ? value[0] : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
