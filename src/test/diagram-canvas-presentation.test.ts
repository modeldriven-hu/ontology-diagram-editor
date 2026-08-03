import * as assert from 'assert';

import { diagramGridIsVisible, diagramPresentationTheme } from '../ui/webview/components/diagram-canvas-presentation';
import type { WebviewTheme } from '../ui/webview/webview-theme';

suite('Diagram canvas presentation', () => {
	test('keeps existing defaults when presentation metadata is omitted', () => {
		assert.strictEqual(diagramPresentationTheme(theme, {}).canvasBackground, '#123456');
		assert.strictEqual(diagramGridIsVisible({}), true);
	});

	test('resolves white and transparent backgrounds and hidden grid', () => {
		assert.strictEqual(diagramPresentationTheme(theme, { diagram: { metadata: { canvas_background: 'white' } } }).canvasBackground, '#FFFFFF');
		assert.strictEqual(diagramPresentationTheme({ ...theme, mode: 'dark' }, { diagram: { metadata: { canvas_background: 'white' } } }).canvasBackground, '#000000');
		assert.strictEqual(diagramPresentationTheme(theme, { diagram: { metadata: { canvas_background: 'transparent' } } }).canvasBackground, 'transparent');
		assert.strictEqual(diagramGridIsVisible({ diagram: { metadata: { show_grid: false } } }), false);
	});
});

const theme = {
	canvasBackground: '#123456',
} as WebviewTheme;
