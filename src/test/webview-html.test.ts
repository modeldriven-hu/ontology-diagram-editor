import * as assert from 'assert';

import { jsonForScript } from '../diagram-editor/webview-html';

suite('Diagram webview HTML', () => {
	test('serializes an absent optional value as JavaScript undefined', () => {
		assert.strictEqual(jsonForScript(undefined), 'undefined');
	});

	test('escapes opening angle brackets in serialized values', () => {
		assert.strictEqual(jsonForScript({ value: '</script>' }), '{"value":"\\u003c/script>"}');
	});
});
