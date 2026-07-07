import * as assert from 'assert';

import { alignNodeSelection, distributeNodeSelection, matchNodeSelectionSize, type NodeSelectionLayoutNode } from '../ui/webview/components/node-selection-layout';

suite('Node selection layout', () => {
	const nodes: readonly NodeSelectionLayoutNode[] = [
		{ id: 'node_a', x: 20, y: 80, width: 100, height: 40 },
		{ id: 'node_b', x: 260, y: 120, width: 160, height: 60 },
		{ id: 'node_c', x: 520, y: 40, width: 120, height: 80 },
	];

	test('aligns selected nodes to selection edges and centers', () => {
		assert.deepStrictEqual(alignNodeSelection(nodes, 'left'), [
			{ id: 'node_b', x: 20, y: 120, width: 160, height: 60 },
			{ id: 'node_c', x: 20, y: 40, width: 120, height: 80 },
		]);
		assert.deepStrictEqual(alignNodeSelection(nodes, 'horizontalCenter'), [
			{ id: 'node_a', x: 280, y: 80, width: 100, height: 40 },
			{ id: 'node_b', x: 250, y: 120, width: 160, height: 60 },
			{ id: 'node_c', x: 270, y: 40, width: 120, height: 80 },
		]);
		assert.deepStrictEqual(alignNodeSelection(nodes, 'bottom'), [
			{ id: 'node_a', x: 20, y: 140, width: 100, height: 40 },
			{ id: 'node_c', x: 520, y: 100, width: 120, height: 80 },
		]);
	});

	test('matches selected node width, height, or full size to the first selected node', () => {
		assert.deepStrictEqual(matchNodeSelectionSize(nodes, 'width'), [
			{ id: 'node_b', x: 260, y: 120, width: 100, height: 60 },
			{ id: 'node_c', x: 520, y: 40, width: 100, height: 80 },
		]);
		assert.deepStrictEqual(matchNodeSelectionSize(nodes, 'height'), [
			{ id: 'node_b', x: 260, y: 120, width: 160, height: 40 },
			{ id: 'node_c', x: 520, y: 40, width: 120, height: 40 },
		]);
		assert.deepStrictEqual(matchNodeSelectionSize(nodes, 'size'), [
			{ id: 'node_b', x: 260, y: 120, width: 100, height: 40 },
			{ id: 'node_c', x: 520, y: 40, width: 100, height: 40 },
		]);
	});

	test('distributes selected nodes with equal gaps while keeping outer nodes fixed', () => {
		assert.deepStrictEqual(distributeNodeSelection(nodes, 'horizontal'), [
			{ id: 'node_b', x: 240, y: 120, width: 160, height: 60 },
		]);
		assert.deepStrictEqual(distributeNodeSelection(nodes, 'vertical'), [
			{ id: 'node_a', x: 20, y: 100, width: 100, height: 40 },
		]);
	});

	test('does not produce updates for too-small selections', () => {
		assert.deepStrictEqual(alignNodeSelection([nodes[0]], 'left'), []);
		assert.deepStrictEqual(matchNodeSelectionSize([nodes[0]], 'size'), []);
		assert.deepStrictEqual(distributeNodeSelection(nodes.slice(0, 2), 'horizontal'), []);
	});
});
