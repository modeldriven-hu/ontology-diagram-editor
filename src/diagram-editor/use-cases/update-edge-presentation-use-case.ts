import { Bounds, containmentEndpoints, DiagramEdge, DiagramNode, OntologyDiagramValidationError, type ContainmentDirection, type EdgeRenderAs, type OntologyDiagramDocument } from '../../documents/odiagram';
import { containmentChildGap, containmentHeaderHeight, containmentPadding } from '../../shared/diagram-containment';
import type { NodeBoundsUpdate } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recalculateConnectedEdgeEndpoints } from './geometry';

interface RelativeNodeBounds {
	readonly nodeId: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

interface SubtreeLayout {
	readonly width: number;
	readonly height: number;
	readonly bounds: readonly RelativeNodeBounds[];
}

export class UpdateEdgePresentationUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		renderAs: EdgeRenderAs | undefined,
		containmentDirection: ContainmentDirection | undefined,
	): DiagramMutationResult {
		const selectedEdge = diagram.edges.find((edge) => edge.id.value === id);
		if (selectedEdge === undefined) {
			return { notification: `Edge "${id}" was not found.` };
		}

		const nextDirection = renderAs === 'containment' ? containmentDirection : undefined;
		if (renderAs === 'containment' && nextDirection === undefined) {
			return { notification: 'Choose which endpoint contains the other node.' };
		}
		if (selectedEdge.renderAs === renderAs && selectedEdge.containmentDirection === nextDirection) {
			return {};
		}

		const updatedEdges = diagram.edges.map((edge) => edge.id.value === id
			? copyEdge(edge, renderAs, nextDirection)
			: edge);
		let updatedDiagram: OntologyDiagramDocument;
		try {
			updatedDiagram = cloneDiagram(diagram, { edges: updatedEdges });
		} catch (error) {
			if (error instanceof OntologyDiagramValidationError) {
				return { notification: error.issues[0] ?? error.message };
			}
			throw error;
		}

		if (renderAs !== 'containment') {
			return {
				diagram: cloneDiagram(updatedDiagram, {
					edges: updatedEdges.map((edge) => edge.id.value === id
						? recalculateEdgeAfterRestoringConnection(edge, diagram)
						: edge),
				}),
			};
		}

		const nextNodes = layoutContainmentNodes(updatedDiagram);
		const updates = nodeBoundsUpdates(diagram.nodes, nextNodes);
		const updateById = new Map(updates.map((update) => [update.id, update]));
		const boundsByElementId = new Map([
			...nextNodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const nextEdges = updatedEdges.map((edge) => edge.renderAs === 'containment'
			? edge
			: recalculateConnectedEdgeEndpoints(edge, updateById, boundsByElementId));

		return {
			diagram: cloneDiagram(updatedDiagram, {
				nodes: nextNodes,
				edges: nextEdges,
			}),
		};
	}
}

function copyEdge(
	edge: DiagramEdge,
	renderAs: EdgeRenderAs | undefined,
	containmentDirection: ContainmentDirection | undefined,
): DiagramEdge {
	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		edge.label,
		edge.points,
		edge.style,
		edge.extra,
		edge.routeLayout,
		renderAs,
		containmentDirection,
	);
}

function recalculateEdgeAfterRestoringConnection(edge: DiagramEdge, diagram: OntologyDiagramDocument): DiagramEdge {
	const source = diagram.nodes.find((node) => node.id.value === edge.source.value);
	const target = diagram.nodes.find((node) => node.id.value === edge.target.value);
	if (source === undefined || target === undefined) {
		return edge;
	}

	const updates = new Map<string, NodeBoundsUpdate>([
		[source.id.value, {
			id: source.id.value,
			x: source.bounds.x,
			y: source.bounds.y,
			width: source.bounds.width,
			height: source.bounds.height,
		}],
		[target.id.value, {
			id: target.id.value,
			x: target.bounds.x,
			y: target.bounds.y,
			width: target.bounds.width,
			height: target.bounds.height,
		}],
	]);
	const bounds = new Map([
		[source.id.value, source.bounds],
		[target.id.value, target.bounds],
	]);
	return recalculateConnectedEdgeEndpoints(edge, updates, bounds);
}

function layoutContainmentNodes(diagram: OntologyDiagramDocument): readonly DiagramNode[] {
	const nodeById = new Map(diagram.nodes.map((node) => [node.id.value, node]));
	const childrenByParent = new Map<string, string[]>();
	const childNodeIds = new Set<string>();
	for (const edge of diagram.edges) {
		if (edge.renderAs !== 'containment' || edge.containmentDirection === undefined) {
			continue;
		}
		const endpoints = containmentEndpoints(edge);
		childNodeIds.add(endpoints.childNodeId);
		const children = childrenByParent.get(endpoints.parentNodeId) ?? [];
		if (!children.includes(endpoints.childNodeId)) {
			children.push(endpoints.childNodeId);
		}
		childrenByParent.set(endpoints.parentNodeId, children);
	}

	const nextBoundsById = new Map<string, Bounds>();
	const layoutSubtree = (nodeId: string): SubtreeLayout => {
		const node = nodeById.get(nodeId);
		if (node === undefined) {
			return { width: 1, height: 1, bounds: [] };
		}
		const children = (childrenByParent.get(nodeId) ?? []).map(layoutSubtree);
		if (children.length === 0) {
			return {
				width: node.bounds.width,
				height: node.bounds.height,
				bounds: [{
					nodeId,
					x: 0,
					y: 0,
					width: node.bounds.width,
					height: node.bounds.height,
				}],
			};
		}

		const columnCount = Math.min(3, Math.ceil(Math.sqrt(children.length)));
		const rowCount = Math.ceil(children.length / columnCount);
		const columnWidths = Array.from({ length: columnCount }, () => 0);
		const rowHeights = Array.from({ length: rowCount }, () => 0);
		children.forEach((child, index) => {
			const column = index % columnCount;
			const row = Math.floor(index / columnCount);
			columnWidths[column] = Math.max(columnWidths[column], child.width);
			rowHeights[row] = Math.max(rowHeights[row], child.height);
		});

		const contentWidth = columnWidths.reduce((sum, width) => sum + width, 0)
			+ containmentChildGap * Math.max(0, columnCount - 1);
		const contentHeight = rowHeights.reduce((sum, height) => sum + height, 0)
			+ containmentChildGap * Math.max(0, rowCount - 1);
		const width = Math.max(node.bounds.width, contentWidth + containmentPadding * 2);
		const height = Math.max(
			node.bounds.height,
			containmentHeaderHeight + containmentPadding + contentHeight + containmentPadding,
		);
		const bounds: RelativeNodeBounds[] = [{ nodeId, x: 0, y: 0, width, height }];

		children.forEach((child, index) => {
			const column = index % columnCount;
			const row = Math.floor(index / columnCount);
			const x = containmentPadding + sumBefore(columnWidths, column) + containmentChildGap * column;
			const y = containmentHeaderHeight + containmentPadding
				+ sumBefore(rowHeights, row) + containmentChildGap * row;
			for (const childBounds of child.bounds) {
				bounds.push({
					...childBounds,
					x: childBounds.x + x,
					y: childBounds.y + y,
				});
			}
		});
		return { width, height, bounds };
	};

	for (const root of diagram.nodes.filter((node) =>
		childrenByParent.has(node.id.value) && !childNodeIds.has(node.id.value))) {
		const subtree = layoutSubtree(root.id.value);
		for (const relative of subtree.bounds) {
			nextBoundsById.set(relative.nodeId, new Bounds(
				root.bounds.x + relative.x,
				root.bounds.y + relative.y,
				relative.width,
				relative.height,
			));
		}
	}

	return diagram.nodes.map((node) => {
		const bounds = nextBoundsById.get(node.id.value);
		if (bounds === undefined) {
			return node;
		}
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
}

function nodeBoundsUpdates(
	originalNodes: readonly DiagramNode[],
	nextNodes: readonly DiagramNode[],
): readonly NodeBoundsUpdate[] {
	const originalById = new Map(originalNodes.map((node) => [node.id.value, node.bounds]));
	return nextNodes.flatMap((node) => {
		const original = originalById.get(node.id.value);
		return original !== undefined
			&& original.x === node.bounds.x
			&& original.y === node.bounds.y
			&& original.width === node.bounds.width
			&& original.height === node.bounds.height
			? []
			: [{
				id: node.id.value,
				x: node.bounds.x,
				y: node.bounds.y,
				width: node.bounds.width,
				height: node.bounds.height,
			}];
	});
}

function sumBefore(values: readonly number[], end: number): number {
	return values.slice(0, end).reduce((sum, value) => sum + value, 0);
}
