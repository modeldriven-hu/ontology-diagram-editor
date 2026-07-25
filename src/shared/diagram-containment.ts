export const containmentHeaderHeight = 40;
export const containmentPadding = 16;
export const containmentChildGap = 16;

export type SerializedContainmentDirection = 'source_contains_target' | 'target_contains_source';

export interface SerializedContainmentEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	readonly render_as?: 'containment';
	readonly containment_direction?: SerializedContainmentDirection;
}

export interface DiagramContainmentIndex {
	readonly parentByNodeId: ReadonlyMap<string, string>;
	readonly childrenByNodeId: ReadonlyMap<string, readonly string[]>;
	readonly depthByNodeId: ReadonlyMap<string, number>;
	readonly containerNodeIds: ReadonlySet<string>;
	readonly containmentEdgeIds: ReadonlySet<string>;
}

export function createDiagramContainmentIndex(
	nodeIds: readonly string[],
	edges: readonly SerializedContainmentEdge[],
): DiagramContainmentIndex {
	const knownNodeIds = new Set(nodeIds);
	const parentByNodeId = new Map<string, string>();
	const childrenByNodeId = new Map<string, string[]>();
	const containmentEdgeIds = new Set<string>();

	for (const edge of edges) {
		if (edge.render_as !== 'containment' || edge.containment_direction === undefined) {
			continue;
		}
		const endpoints = serializedContainmentEndpoints(edge);
		if (!knownNodeIds.has(endpoints.parentNodeId)
			|| !knownNodeIds.has(endpoints.childNodeId)
			|| endpoints.parentNodeId === endpoints.childNodeId) {
			continue;
		}

		const existingParent = parentByNodeId.get(endpoints.childNodeId);
		if (existingParent !== undefined && existingParent !== endpoints.parentNodeId) {
			continue;
		}
		if (existingParent === undefined) {
			parentByNodeId.set(endpoints.childNodeId, endpoints.parentNodeId);
			const children = childrenByNodeId.get(endpoints.parentNodeId) ?? [];
			children.push(endpoints.childNodeId);
			childrenByNodeId.set(endpoints.parentNodeId, children);
		}
		containmentEdgeIds.add(edge.id);
	}

	const depthByNodeId = new Map<string, number>();
	const depthOf = (nodeId: string, visiting: ReadonlySet<string>): number => {
		const existing = depthByNodeId.get(nodeId);
		if (existing !== undefined) {
			return existing;
		}
		if (visiting.has(nodeId)) {
			return 0;
		}

		const parentId = parentByNodeId.get(nodeId);
		const depth = parentId === undefined
			? 0
			: depthOf(parentId, new Set([...visiting, nodeId])) + 1;
		depthByNodeId.set(nodeId, depth);
		return depth;
	};
	for (const nodeId of nodeIds) {
		depthOf(nodeId, new Set());
	}

	return {
		parentByNodeId,
		childrenByNodeId,
		depthByNodeId,
		containerNodeIds: new Set(childrenByNodeId.keys()),
		containmentEdgeIds,
	};
}

export function serializedContainmentEndpoints(edge: SerializedContainmentEdge): {
	readonly parentNodeId: string;
	readonly childNodeId: string;
} {
	return edge.containment_direction === 'source_contains_target'
		? { parentNodeId: edge.source, childNodeId: edge.target }
		: { parentNodeId: edge.target, childNodeId: edge.source };
}
