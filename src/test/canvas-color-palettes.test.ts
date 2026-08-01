import * as assert from 'assert';

import { canvasColorPalette, darkCanvasColorPalettes, lightCanvasColorPalettes, type CanvasColorRole } from '../ui/webview/components/canvas-color-palettes';

suite('Canvas color palettes', () => {
	const roles: readonly CanvasColorRole[] = ['surface', 'accent', 'foreground'];

	test('provides twelve distinct colors for every theme and color role', () => {
		for (const palettes of [lightCanvasColorPalettes, darkCanvasColorPalettes]) {
			for (const role of roles) {
				const colors = palettes[role].map((swatch) => swatch.value);
				assert.strictEqual(colors.length, 12);
				assert.strictEqual(new Set(colors).size, 12);
			}
		}
	});

	test('uses valid uppercase hex colors and consistent family names', () => {
		const expectedLabels = lightCanvasColorPalettes.accent.map((swatch) => swatch.label);
		for (const palettes of [lightCanvasColorPalettes, darkCanvasColorPalettes]) {
			for (const role of roles) {
				assert.deepStrictEqual(palettes[role].map((swatch) => swatch.label), expectedLabels);
				for (const swatch of palettes[role]) {
					assert.match(swatch.value, /^#[\dA-F]{6}$/u);
				}
			}
		}
	});

	test('selects a palette by theme mode and practical color role', () => {
		assert.strictEqual(canvasColorPalette('light', 'surface'), lightCanvasColorPalettes.surface);
		assert.strictEqual(canvasColorPalette('light', 'foreground'), lightCanvasColorPalettes.foreground);
		assert.strictEqual(canvasColorPalette('dark', 'accent'), darkCanvasColorPalettes.accent);
		assert.strictEqual(canvasColorPalette('dark', 'surface'), darkCanvasColorPalettes.surface);
	});

	test('uses clearly visible background shades in light mode', () => {
		assert.strictEqual(lightCanvasColorPalettes.surface[1]?.value, '#BFDBFE');
		assert.strictEqual(lightCanvasColorPalettes.surface[7]?.value, '#FDE68A');
	});

	test('uses a saturated accent palette when no role is supplied', () => {
		assert.strictEqual(canvasColorPalette('light'), lightCanvasColorPalettes.accent);
		assert.strictEqual(canvasColorPalette('dark'), darkCanvasColorPalettes.accent);
	});
});
