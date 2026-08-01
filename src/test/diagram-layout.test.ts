import * as assert from 'assert';

import { ElkLayeredLayoutAlgorithm } from '../diagram-editor/layout';
import { Bounds, DiagramEdge, DiagramMetadata, DiagramNode, OntologyDiagramDocument, Point } from '../documents/odiagram';
import { defaultElkLayeredDirection, defaultElkLayeredLayerSpacing, defaultElkLayeredNodeSpacing, isElkLayeredDirection, maximumElkLayeredSpacing, minimumElkLayeredSpacing, normalizeElkLayeredSpacing, type ElkLayeredLayoutOptions } from '../shared/diagram-layout';

class TestElkLayeredLayoutAlgorithm extends ElkLayeredLayoutAlgorithm {
	public directionOptionsFor(options: ElkLayeredLayoutOptions | undefined): Readonly<Record<string, string>> {
		return this.directionOptions(options);
	}
}

suite('Diagram layout options', () => {
	test('defaults ELK layered direction and gaps to horizontal with 30 pixel spacing', () => {
		assert.strictEqual(defaultElkLayeredDirection, 'horizontal');
		assert.strictEqual(defaultElkLayeredNodeSpacing, 30);
		assert.strictEqual(defaultElkLayeredLayerSpacing, 30);
		assert.strictEqual(isElkLayeredDirection('vertical'), true);
		assert.strictEqual(isElkLayeredDirection('bottom-up'), true);
		assert.strictEqual(isElkLayeredDirection('diagonal'), false);
	});

	test('maps ELK layered directions to all supported ELK directions', () => {
		const algorithm = new TestElkLayeredLayoutAlgorithm();
		assert.deepStrictEqual(algorithm.directionOptionsFor(undefined), { 'elk.direction': 'RIGHT' });
		assert.deepStrictEqual(algorithm.directionOptionsFor({ direction: 'right-to-left' }), { 'elk.direction': 'LEFT' });
		assert.deepStrictEqual(algorithm.directionOptionsFor({ direction: 'vertical' }), { 'elk.direction': 'DOWN' });
		assert.deepStrictEqual(algorithm.directionOptionsFor({ direction: 'bottom-up' }), { 'elk.direction': 'UP' });
	});

	test('normalizes ELK layered spacing to a whole number within the supported range', () => {
		assert.strictEqual(normalizeElkLayeredSpacing(72.6, defaultElkLayeredNodeSpacing), 73);
		assert.strictEqual(normalizeElkLayeredSpacing(0, defaultElkLayeredNodeSpacing), minimumElkLayeredSpacing);
		assert.strictEqual(normalizeElkLayeredSpacing(999, defaultElkLayeredNodeSpacing), maximumElkLayeredSpacing);
		assert.strictEqual(normalizeElkLayeredSpacing(undefined, defaultElkLayeredNodeSpacing), defaultElkLayeredNodeSpacing);
	});

	test('places ELK layered labels directly on their routed edge when possible', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Inline labels'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(10, 20, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 20, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
			],
		);

		for (const direction of ['horizontal', 'right-to-left', 'vertical', 'bottom-up'] as const) {
			const result = await new ElkLayeredLayoutAlgorithm().layout(diagram, { direction });
			const route = result.edgeRoutesById?.get('edge_relates');
			assert.ok(route);
			assert.ok(
				route.points.slice(1).some((end, index) => pointIsOnSegment(route.label, route.points[index], end)),
				`${direction} label should be on its routed edge`,
			);
		}
	});
});

function pointIsOnSegment(point: Point, start: Point, end: Point): boolean {
	const crossProduct = ((point.y - start.y) * (end.x - start.x))
		- ((point.x - start.x) * (end.y - start.y));
	return crossProduct === 0
		&& point.x >= Math.min(start.x, end.x)
		&& point.x <= Math.max(start.x, end.x)
		&& point.y >= Math.min(start.y, end.y)
		&& point.y <= Math.max(start.y, end.y);
}
