import * as assert from 'assert';

import { ElkLayeredLayoutAlgorithm } from '../diagram-editor/layout';
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
});
