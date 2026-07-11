import { Bounds, DiagramEdge, DiagramNode, Point, type JsonObject, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNodeHeight, defaultNodeWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { boundaryPoint, roundCoordinate, selfLoopEdgeLabel, selfLoopEdgePoints } from './geometry';
import { expandedOntologyReference, namespacesWithRequiredEdgePrefixes, ontologyReferencesEqual, resolveEdgeEndpoints, type ResolvedEdgeEndpointNodeType, type ResolvedEdgeEndpoints } from './ontology-edge-endpoints';

interface RelatedEdgeCandidate {
	readonly payload: ModelTreeItemDropPayload;
	readonly resolved: ResolvedEdgeEndpoints;
	readonly sourceKey: string;
	readonly targetKey: string;
	readonly edgeKey: string;
}

interface DiscoveredReference {
	readonly reference: string;
	readonly nodeType: ResolvedEdgeEndpointNodeType;
	readonly depth: number;
	readonly side: ExpansionSide;
	readonly order: number;
}

interface Expansion {
	readonly references: ReadonlyMap<string, DiscoveredReference>;
	readonly edges: readonly RelatedEdgeCandidate[];
	readonly skippedAmbiguousCount: number;
}

type ExpansionSide = 'left' | 'right';
type ExistingNodeLookup = ReturnType<typeof existingNodeLookup>;

const horizontalGap = 180;
const verticalGap = 72;
const canvasMargin = 40;

export class ShowRelatedElementsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		nodeId: string,
		depth: number,
		relationshipPayloads: readonly ModelTreeItemDropPayload[],
	): DiagramMutationResult {
		const selectedNode = diagram.nodes.find((node) => node.id.value === nodeId);
		if (selectedNode === undefined) {
			return { notification: 'Select a node to show related elements.' };
		}

		if (!Number.isInteger(depth) || depth < 1) {
			return { notification: 'Related element depth must be at least 1.' };
		}

		const candidates = relationshipCandidates(relationshipPayloads, diagram.namespaces);
		const expansion = discoverRelatedElements(selectedNode, diagram.namespaces, Math.min(depth, 5), candidates.items, candidates.skippedAmbiguousCount);
		if (expansion.edges.length === 0) {
			return {
				notification: expansion.skippedAmbiguousCount > 0
					? 'No unambiguous related ontology relationships were found for the selected node.'
					: 'No related ontology relationships were found for the selected node.',
			};
		}

		const existing = existingNodeLookup(diagram, selectedNode);
		const newNodes = createMissingNodes(diagram, selectedNode, expansion.references, existing);
		const nodesByKey = new Map(existing.nodesByKey);
		for (const node of newNodes) {
			nodesByKey.set(referenceKey(node.ontologyRef.value, diagram.namespaces), node);
		}

		const nextNodes = [...diagram.nodes, ...newNodes];
		const nextEdges = [...diagram.edges];
		let nextNamespaces = diagram.namespaces;
		let addedEdges = 0;
		for (const candidate of expansion.edges) {
			if (existing.duplicatedKeys.has(candidate.sourceKey) || existing.duplicatedKeys.has(candidate.targetKey)) {
				continue;
			}

			const source = nodesByKey.get(candidate.sourceKey);
			const target = nodesByKey.get(candidate.targetKey);
			if (source === undefined || target === undefined) {
				continue;
			}

			const edgeNamespaces = namespacesWithRequiredEdgePrefixes(cloneDiagram(diagram, { namespaces: nextNamespaces }), candidate.resolved);
			if (hasEdge(nextEdges, candidate.resolved.edgeOntologyRef, source.id.value, target.id.value, edgeNamespaces)) {
				continue;
			}

			const route = edgeRoute(source, target);
			nextEdges.push(new DiagramEdge(
				nextElementId(nextEdges.map((edge) => edge.id.value), 'edge'),
				source.id.value,
				target.id.value,
				candidate.resolved.edgeOntologyRef,
				route.label,
				route.points,
				undefined,
				edgeExtraFields(candidate.payload),
			));
			nextNamespaces = edgeNamespaces;
			addedEdges += 1;
		}

		if (newNodes.length === 0 && addedEdges === 0) {
			return { notification: 'Related elements are already shown on the diagram.' };
		}

		return {
			diagram: cloneDiagram(diagram, {
				namespaces: nextNamespaces,
				nodes: nextNodes,
				edges: nextEdges,
			}),
		};
	}
}

function relationshipCandidates(payloads: readonly ModelTreeItemDropPayload[], namespaces: ReadonlyMap<string, string>): {
	readonly items: readonly RelatedEdgeCandidate[];
	readonly skippedAmbiguousCount: number;
} {
	const candidates: RelatedEdgeCandidate[] = [];
	let skippedAmbiguousCount = 0;
	for (const payload of payloads) {
		if (payload.ontologyItemType === 'dataProperty') {
			continue;
		}

		const resolved = resolveEdgeEndpoints(payload);
		if (resolved === undefined) {
			continue;
		}
		if (resolved === 'ambiguous') {
			skippedAmbiguousCount += 1;
			continue;
		}

		const sourceKey = referenceKey(resolved.sourceOntologyRef, namespaces);
		const targetKey = referenceKey(resolved.targetOntologyRef, namespaces);
		candidates.push({
			payload,
			resolved,
			sourceKey,
			targetKey,
			edgeKey: `${referenceKey(resolved.edgeOntologyRef, namespaces)}:${sourceKey}:${targetKey}`,
		});
	}

	return {
		items: candidates,
		skippedAmbiguousCount,
	};
}

function discoverRelatedElements(
	selectedNode: DiagramNode,
	namespaces: ReadonlyMap<string, string>,
	depth: number,
	candidates: readonly RelatedEdgeCandidate[],
	skippedAmbiguousCount: number,
): Expansion {
	const selectedKey = referenceKey(selectedNode.ontologyRef.value, namespaces);
	const references = new Map<string, DiscoveredReference>([
		[selectedKey, {
			reference: selectedNode.ontologyRef.value,
			nodeType: 'class',
			depth: 0,
			side: 'right',
			order: 0,
		}],
	]);
	const edgeByKey = new Map<string, RelatedEdgeCandidate>();
	let frontier = new Set([selectedKey]);
	let order = 1;

	for (let currentDepth = 1; currentDepth <= depth; currentDepth += 1) {
		const nextFrontier = new Set<string>();
		for (const candidate of candidates) {
			const sourceInFrontier = frontier.has(candidate.sourceKey);
			const targetInFrontier = frontier.has(candidate.targetKey);
			if (!sourceInFrontier && !targetInFrontier) {
				continue;
			}

			edgeByKey.set(candidate.edgeKey, candidate);
			if (sourceInFrontier) {
				order = discoverReference({
					references,
					nextFrontier,
					key: candidate.targetKey,
					reference: candidate.resolved.targetOntologyRef,
					nodeType: candidate.resolved.targetNodeType,
					depth: currentDepth,
					side: sideForExpansion(candidate.sourceKey, references, selectedKey, 'sourceToTarget'),
					order,
				});
			}
			if (targetInFrontier) {
				order = discoverReference({
					references,
					nextFrontier,
					key: candidate.sourceKey,
					reference: candidate.resolved.sourceOntologyRef,
					nodeType: candidate.resolved.sourceNodeType,
					depth: currentDepth,
					side: sideForExpansion(candidate.targetKey, references, selectedKey, 'targetToSource'),
					order,
				});
			}
		}

		if (nextFrontier.size === 0) {
			break;
		}

		frontier = nextFrontier;
	}

	return {
		references,
		edges: [...edgeByKey.values()].sort((left, right) => left.payload.displayLabel.localeCompare(right.payload.displayLabel)),
		skippedAmbiguousCount,
	};
}

function discoverReference(options: {
	readonly references: Map<string, DiscoveredReference>;
	readonly nextFrontier: Set<string>;
	readonly key: string;
	readonly reference: string;
	readonly nodeType: ResolvedEdgeEndpointNodeType;
	readonly depth: number;
	readonly side: ExpansionSide;
	readonly order: number;
}): number {
	if (options.references.has(options.key)) {
		return options.order;
	}

	options.references.set(options.key, {
		reference: options.reference,
		nodeType: options.nodeType,
		depth: options.depth,
		side: options.side,
		order: options.order,
	});
	options.nextFrontier.add(options.key);
	return options.order + 1;
}

function sideForExpansion(
	fromKey: string,
	references: ReadonlyMap<string, DiscoveredReference>,
	selectedKey: string,
	direction: 'sourceToTarget' | 'targetToSource',
): ExpansionSide {
	if (fromKey === selectedKey) {
		return direction === 'sourceToTarget' ? 'right' : 'left';
	}

	return references.get(fromKey)?.side ?? 'right';
}

function existingNodeLookup(diagram: OntologyDiagramDocument, selectedNode: DiagramNode): {
	readonly nodesByKey: Map<string, DiagramNode>;
	readonly duplicatedKeys: ReadonlySet<string>;
} {
	const selectedKey = referenceKey(selectedNode.ontologyRef.value, diagram.namespaces);
	const nodesByKey = new Map<string, DiagramNode>([[selectedKey, selectedNode]]);
	const duplicatedKeys = new Set<string>();
	for (const node of diagram.nodes) {
		if (node.id.value === selectedNode.id.value) {
			continue;
		}

		const key = referenceKey(node.ontologyRef.value, diagram.namespaces);
		if (key === selectedKey) {
			continue;
		}

		if (nodesByKey.has(key)) {
			duplicatedKeys.add(key);
			continue;
		}

		nodesByKey.set(key, node);
	}

	return { nodesByKey, duplicatedKeys };
}

function createMissingNodes(
	diagram: OntologyDiagramDocument,
	selectedNode: DiagramNode,
	references: ReadonlyMap<string, DiscoveredReference>,
	existing: ExistingNodeLookup,
): readonly DiagramNode[] {
	const occupied = [
		...diagram.nodes.map((node) => node.bounds),
		...diagram.notes.map((note) => note.bounds),
		...diagram.images.map((image) => image.bounds),
		...diagram.labels.map((label) => label.bounds),
	];
	const created: DiagramNode[] = [];
	const missing = [...references.entries()]
		.filter(([key, reference]) => reference.depth > 0 && !existing.nodesByKey.has(key) && !existing.duplicatedKeys.has(key))
		.sort((left, right) => left[1].depth - right[1].depth || left[1].side.localeCompare(right[1].side) || left[1].order - right[1].order);

	for (const [key, reference] of missing) {
		const bounds = availableBounds(
			proposedBounds(selectedNode.bounds, reference, references),
			[...occupied, ...created.map((node) => node.bounds)],
		);
		created.push(new DiagramNode(
			nextElementId([
				...diagram.nodes.map((node) => node.id.value),
				...created.map((node) => node.id.value),
			], 'node'),
			reference.reference,
			bounds,
			undefined,
			undefined,
			nodeExtraFields(reference),
			undefined,
			reference.nodeType === 'individual' ? true : undefined,
			reference.nodeType === 'individual' ? true : undefined,
		));
		existing.nodesByKey.set(key, created[created.length - 1]);
	}

	return created;
}

function proposedBounds(
	selectedBounds: Bounds,
	reference: DiscoveredReference,
	references: ReadonlyMap<string, DiscoveredReference>,
): Bounds {
	const layerReferences = [...references.values()]
		.filter((candidate) => candidate.depth === reference.depth && candidate.side === reference.side)
		.sort((left, right) => left.order - right.order);
	const index = layerReferences.findIndex((candidate) => candidate.reference === reference.reference);
	const layerHeight = (layerReferences.length * defaultNodeHeight) + (Math.max(0, layerReferences.length - 1) * verticalGap);
	const xOffset = reference.depth * (defaultNodeWidth + horizontalGap);
	const proposedX = reference.side === 'left'
		? selectedBounds.x - xOffset
		: selectedBounds.x + selectedBounds.width + horizontalGap + ((reference.depth - 1) * (defaultNodeWidth + horizontalGap));
	const x = reference.side === 'left' && proposedX >= canvasMargin
		? proposedX
		: selectedBounds.x + selectedBounds.width + horizontalGap + ((reference.depth - 1) * (defaultNodeWidth + horizontalGap));
	const y = selectedBounds.y + (selectedBounds.height / 2) - (layerHeight / 2) + (Math.max(0, index) * (defaultNodeHeight + verticalGap));

	return new Bounds(roundCoordinate(x), roundCoordinate(Math.max(canvasMargin, y)), defaultNodeWidth, defaultNodeHeight);
}

function availableBounds(candidate: Bounds, occupied: readonly Bounds[]): Bounds {
	let y = candidate.y;
	let next = candidate;
	while (occupied.some((bounds) => overlaps(next, bounds))) {
		y += defaultNodeHeight + verticalGap;
		next = new Bounds(candidate.x, roundCoordinate(y), candidate.width, candidate.height);
	}

	return next;
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

function hasEdge(
	edges: readonly DiagramEdge[],
	ontologyRef: string,
	sourceId: string,
	targetId: string,
	namespaces: ReadonlyMap<string, string>,
): boolean {
	return edges.some((edge) =>
		ontologyReferencesEqual(edge.ontologyRef.value, ontologyRef, namespaces)
		&& edge.source.value === sourceId
		&& edge.target.value === targetId,
	);
}

function edgeExtraFields(payload: ModelTreeItemDropPayload): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}

function nodeExtraFields(reference: DiscoveredReference): JsonObject {
	return {
		ontology_item_type: reference.nodeType,
	};
}

function referenceKey(reference: string, namespaces: ReadonlyMap<string, string>): string {
	return expandedOntologyReference(reference, namespaces);
}

function overlaps(left: Bounds, right: Bounds): boolean {
	return left.x < right.x + right.width + canvasMargin
		&& left.x + left.width + canvasMargin > right.x
		&& left.y < right.y + right.height + canvasMargin
		&& left.y + left.height + canvasMargin > right.y;
}
