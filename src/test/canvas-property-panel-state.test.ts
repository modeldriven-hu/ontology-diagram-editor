import * as assert from 'assert';

import { resolvedPropertyPanelCollapsed } from '../ui/webview/components/canvas-property-panel';

suite('Canvas property panel state', () => {
	test('starts collapsed when no previous webview state exists', () => {
		assert.strictEqual(resolvedPropertyPanelCollapsed(), true);
	});

	test('restores an explicit collapsed or expanded state', () => {
		assert.strictEqual(resolvedPropertyPanelCollapsed(true), true);
		assert.strictEqual(resolvedPropertyPanelCollapsed(false), false);
	});
});
