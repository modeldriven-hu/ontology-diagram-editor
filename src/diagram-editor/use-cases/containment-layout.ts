import { Bounds, containmentEndpoints, DiagramNode, type OntologyDiagramDocument } from '../../documents/odiagram';
import { containmentChildGap, containmentHeaderHeight, containmentPadding } from '../../shared/diagram-containment';

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

export interface DocumentContainmentIndex {
	readonly parentByNodeId: ReadonlyMap<string, string>;
	readonly childrenByNodeId: ReadonlyMap<string, readonly string[]>;
	readonly rootByNodeId: ReadonlyMap<string, string>;
	readonly nodeIdsByRootId: ReadonlyMap<string, readonly string[]>;
	readonly containmentEdgeIds: ReadonlySet<string>;
}

export function createDocumentContainmentIndex(diagram: OntologyDiagramDocument): DocumentContainmentIndex {
	const parentByNodeId = new Map<string, string>();
	const childrenByNodeId = new Map<string, string[]>();
	const containmentEdgeIds = new Set<string>();
	for (const edge of diagram.edges) {
		if (edge.renderAs !== 'containment' || edge.containmentDirection === undefined) {
			continue;
		}

		const endpoints = containmentEndpoints(edge);
		const existingParent = parentByNodeId.get(endpoints.childNodeId);
		if (existingParent === undefined) {
			parentByNodeId.set(endpoints.childNodeId, endpoints.parentNodeId);
			const children = childrenByNodeId.get(endpoints.parentNodeId) ?? [];
			children.push(endpoints.childNodeId);
			childrenByNodeId.set(endpoints.parentNodeId, children);
		}
		containmentEdgeIds.add(edge.id.value);
	}

	const rootByNodeId = new Map<string, string>();
	const rootFor = (nodeId: string): string => {
		const existing = rootByNodeId.get(nodeId);
		if (existing !== undefined) {
			return existing;
		}
		const parentId = parentByNodeId.get(nodeId);
		const rootId = parentId === undefined ? nodeId : rootFor(parentId);
		rootByNodeId.set(nodeId, rootId);
		return rootId;
	};
	const nodeIdsByRootId = new Map<string, string[]>();
	for (const node of diagram.nodes) {
		const rootId = rootFor(node.id.value);
		const nodeIds = nodeIdsByRootId.get(rootId) ?? [];
		nodeIds.push(node.id.value);
		nodeIdsByRootId.set(rootId, nodeIds);
	}

	return {
		parentByNodeId,
		childrenByNodeId,
		rootByNodeId,
		nodeIdsByRootId,
		containmentEdgeIds,
	};
}

export function layoutContainmentNodes(
	diagram: OntologyDiagramDocument,
	index: DocumentContainmentIndex = createDocumentContainmentIndex(diagram),
	rootIds: ReadonlySet<string> = new Set(index.nodeIdsByRootId.keys()),
): readonly DiagramNode[] {
	const nodeById = new Map(diagram.nodes.map((node) => [node.id.value, node]));
	const nextBoundsById = new Map<string, Bounds>();
	const layoutSubtree = (nodeId: string): SubtreeLayout => {
		const node = nodeById.get(nodeId);
		if (node === undefined) {
			return { width: 1, height: 1, bounds: [] };
		}
		const children = (index.childrenByNodeId.get(nodeId) ?? []).map(layoutSubtree);
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
		children.forEach((child, childIndex) => {
			const column = childIndex % columnCount;
			const row = Math.floor(childIndex / columnCount);
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

		children.forEach((child, childIndex) => {
			const column = childIndex % columnCount;
			const row = Math.floor(childIndex / columnCount);
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

	for (const rootId of index.nodeIdsByRootId.keys()) {
		if (!rootIds.has(rootId) || !index.childrenByNodeId.has(rootId)) {
			continue;
		}
		const root = nodeById.get(rootId);
		if (root === undefined) {
			continue;
		}
		const subtree = layoutSubtree(rootId);
		for (const relative of subtree.bounds) {
			nextBoundsById.set(relative.nodeId, new Bounds(
				root.bounds.x + relative.x,
				root.bounds.y + relative.y,
				relative.width,
				relative.height,
			));
		}
	}

	return diagram.nodes.map((node) => copyNodeWithBounds(node, nextBoundsById.get(node.id.value)));
}

export function copyNodeWithBounds(node: DiagramNode, bounds: Bounds | undefined): DiagramNode {
	if (bounds === undefined || boundsEqual(node.bounds, bounds)) {
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
}

function sumBefore(values: readonly number[], end: number): number {
	return values.slice(0, end).reduce((sum, value) => sum + value, 0);
}

function boundsEqual(left: Bounds, right: Bounds): boolean {
	return left.x === right.x
		&& left.y === right.y
		&& left.width === right.width
		&& left.height === right.height;
}
