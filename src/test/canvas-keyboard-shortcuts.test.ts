import * as assert from 'assert';

import { isSelectAllShortcut } from '../ui/webview/engine/canvas-keyboard-shortcuts';

suite('Canvas keyboard shortcuts', () => {
	test('recognizes Ctrl+A and Cmd+A', () => {
		assert.strictEqual(isSelectAllShortcut(keyboardEvent({ ctrlKey: true })), true);
		assert.strictEqual(isSelectAllShortcut(keyboardEvent({ metaKey: true })), true);
	});

	test('does not recognize modified or unrelated keys', () => {
		assert.strictEqual(isSelectAllShortcut(keyboardEvent()), false);
		assert.strictEqual(isSelectAllShortcut(keyboardEvent({ key: 'b', ctrlKey: true })), false);
		assert.strictEqual(isSelectAllShortcut(keyboardEvent({ ctrlKey: true, altKey: true })), false);
		assert.strictEqual(isSelectAllShortcut(keyboardEvent({ ctrlKey: true, shiftKey: true })), false);
	});
});

function keyboardEvent(overrides: Partial<Parameters<typeof isSelectAllShortcut>[0]> = {}): Parameters<typeof isSelectAllShortcut>[0] {
	return {
		key: 'a',
		altKey: false,
		ctrlKey: false,
		metaKey: false,
		shiftKey: false,
		...overrides,
	};
}
