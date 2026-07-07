import type { BoundsUpdate } from '../../../shared/canvas-geometry';

export interface NodeSelectionLayoutNode {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export type NodeSelectionAlignment =
	| 'left'
	| 'horizontalCenter'
	| 'right'
	| 'top'
	| 'verticalCenter'
	| 'bottom';

export type NodeSelectionSizeMatch = 'width' | 'height' | 'size';
export type NodeSelectionDistribution = 'horizontal' | 'vertical';

export function alignNodeSelection(
	nodes: readonly NodeSelectionLayoutNode[],
	alignment: NodeSelectionAlignment,
): readonly BoundsUpdate[] {
	if (nodes.length < 2) {
		return [];
	}

	const bounds = groupBounds(nodes);
	return changedBoundsUpdates(nodes, nodes.map((node) => {
		switch (alignment) {
			case 'left':
				return boundsUpdate(node, { x: bounds.x });
			case 'horizontalCenter':
				return boundsUpdate(node, { x: bounds.x + (bounds.width / 2) - (node.width / 2) });
			case 'right':
				return boundsUpdate(node, { x: bounds.x + bounds.width - node.width });
			case 'top':
				return boundsUpdate(node, { y: bounds.y });
			case 'verticalCenter':
				return boundsUpdate(node, { y: bounds.y + (bounds.height / 2) - (node.height / 2) });
			case 'bottom':
				return boundsUpdate(node, { y: bounds.y + bounds.height - node.height });
		}
	}));
}

export function matchNodeSelectionSize(
	nodes: readonly NodeSelectionLayoutNode[],
	match: NodeSelectionSizeMatch,
): readonly BoundsUpdate[] {
	if (nodes.length < 2) {
		return [];
	}

	const source = nodes[0];
	return changedBoundsUpdates(nodes, nodes.map((node) => boundsUpdate(node, {
		width: match === 'height' ? node.width : source.width,
		height: match === 'width' ? node.height : source.height,
	})));
}

export function distributeNodeSelection(
	nodes: readonly NodeSelectionLayoutNode[],
	distribution: NodeSelectionDistribution,
): readonly BoundsUpdate[] {
	if (nodes.length < 3) {
		return [];
	}

	const sortedNodes = [...nodes].sort((left, right) => compareNodesForDistribution(left, right, distribution));
	const first = sortedNodes[0];
	const last = sortedNodes[sortedNodes.length - 1];
	const start = distribution === 'horizontal' ? first.x : first.y;
	const end = distribution === 'horizontal' ? last.x + last.width : last.y + last.height;
	const totalSize = sortedNodes.reduce((sum, node) => sum + (distribution === 'horizontal' ? node.width : node.height), 0);
	const gap = (end - start - totalSize) / (sortedNodes.length - 1);
	let cursor = start;

	return changedBoundsUpdates(nodes, sortedNodes.map((node, index) => {
		const size = distribution === 'horizontal' ? node.width : node.height;
		const position = index === 0
			? start
			: index === sortedNodes.length - 1
				? end - size
				: cursor;
		cursor = position + size + gap;

		return distribution === 'horizontal'
			? boundsUpdate(node, { x: position })
			: boundsUpdate(node, { y: position });
	}));
}

interface SelectionBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

function groupBounds(nodes: readonly NodeSelectionLayoutNode[]): SelectionBounds {
	const minX = Math.min(...nodes.map((node) => node.x));
	const minY = Math.min(...nodes.map((node) => node.y));
	const maxX = Math.max(...nodes.map((node) => node.x + node.width));
	const maxY = Math.max(...nodes.map((node) => node.y + node.height));

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

function boundsUpdate(
	node: NodeSelectionLayoutNode,
	update: Partial<Omit<BoundsUpdate, 'id'>>,
): BoundsUpdate {
	return {
		id: node.id,
		x: Math.max(0, roundCoordinate(update.x ?? node.x)),
		y: Math.max(0, roundCoordinate(update.y ?? node.y)),
		width: Math.max(1, roundCoordinate(update.width ?? node.width)),
		height: Math.max(1, roundCoordinate(update.height ?? node.height)),
	};
}

function changedBoundsUpdates(
	nodes: readonly NodeSelectionLayoutNode[],
	updates: readonly BoundsUpdate[],
): readonly BoundsUpdate[] {
	const nodeById = new Map(nodes.map((node) => [node.id, node] as const));
	return updates.filter((update) => {
		const node = nodeById.get(update.id);
		return node !== undefined
			&& (update.x !== node.x
				|| update.y !== node.y
				|| update.width !== node.width
				|| update.height !== node.height);
	});
}

function compareNodesForDistribution(
	left: NodeSelectionLayoutNode,
	right: NodeSelectionLayoutNode,
	distribution: NodeSelectionDistribution,
): number {
	if (distribution === 'horizontal') {
		return left.x - right.x || left.y - right.y || left.id.localeCompare(right.id);
	}

	return left.y - right.y || left.x - right.x || left.id.localeCompare(right.id);
}

function roundCoordinate(value: number): number {
	return Math.round(value);
}
