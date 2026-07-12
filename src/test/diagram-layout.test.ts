import * as assert from 'assert';

import { defaultElkLayeredNodeSpacing, maximumElkLayeredSpacing, minimumElkLayeredSpacing, normalizeElkLayeredSpacing } from '../shared/diagram-layout';

suite('Diagram layout options', () => {
	test('normalizes ELK layered spacing to a whole number within the supported range', () => {
		assert.strictEqual(normalizeElkLayeredSpacing(72.6, defaultElkLayeredNodeSpacing), 73);
		assert.strictEqual(normalizeElkLayeredSpacing(0, defaultElkLayeredNodeSpacing), minimumElkLayeredSpacing);
		assert.strictEqual(normalizeElkLayeredSpacing(999, defaultElkLayeredNodeSpacing), maximumElkLayeredSpacing);
		assert.strictEqual(normalizeElkLayeredSpacing(undefined, defaultElkLayeredNodeSpacing), defaultElkLayeredNodeSpacing);
	});
});
