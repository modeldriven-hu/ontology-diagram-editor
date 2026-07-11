import * as assert from 'assert';

import { constrainFixedToolbarOffset } from '../ui/webview/engine/fixed-toolbar-controller';

suite('Fixed toolbar controller', () => {
	test('keeps a moved toolbar within its container bounds', () => {
		assert.deepStrictEqual(constrainFixedToolbarOffset(
			{ x: 500, y: -200 },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { x: 120, y: -4 });
	});

	test('preserves the default toolbar inset when it fits', () => {
		assert.deepStrictEqual(constrainFixedToolbarOffset(
			{ x: 0, y: 0 },
			{ width: 160, height: 36 },
			{ width: 300, height: 180 },
		), { x: 0, y: 0 });
	});
});
