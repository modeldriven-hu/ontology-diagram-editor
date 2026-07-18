import * as assert from 'assert';

import { createEmbeddedGalleryIcon, defaultGalleryIconColor, embeddedGalleryIconColor, recolorEmbeddedGalleryIcon } from '../shared/embedded-gallery-icon';

suite('Embedded gallery icon', () => {
	test('embeds SVG with the current gallery color by default', () => {
		const source = createEmbeddedGalleryIcon('<path fill="currentColor" d="M0 0h16v16z"/>', 16, 16);

		assert.ok(source.startsWith('data:image/svg+xml;base64,'));
		assert.strictEqual(embeddedGalleryIconColor(source), defaultGalleryIconColor);
		assert.match(decodeSvg(source), /fill="currentColor"/);
	});

	test('embeds and detects a selected icon color', () => {
		const source = createEmbeddedGalleryIcon('<path d="M0 0h24v24z"/>', 24, 24, '#12ab34');

		assert.strictEqual(embeddedGalleryIconColor(source), '#12AB34');
	});

	test('recolors a gallery icon without rasterizing it', () => {
		const source = createEmbeddedGalleryIcon('<path fill="currentColor" d="M0 0h16v16z"/>', 16, 16);
		const recolored = recolorEmbeddedGalleryIcon(source, '#AABBCC');

		assert.ok(recolored?.startsWith('data:image/svg+xml;base64,'));
		assert.strictEqual(embeddedGalleryIconColor(recolored), '#AABBCC');
		assert.match(decodeSvg(recolored ?? ''), /fill="currentColor"/);
	});

	test('recognizes and upgrades legacy blue gallery icons', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" color="#2563eb" fill="#2563eb"><path fill="#2563eb" d="M0 0h16v16z"/></svg>';
		const source = `data:image/svg+xml;base64,${btoa(svg)}`;
		const recolored = recolorEmbeddedGalleryIcon(source, '#000000');

		assert.strictEqual(embeddedGalleryIconColor(source), defaultGalleryIconColor);
		assert.strictEqual(embeddedGalleryIconColor(recolored), '#000000');
		assert.doesNotMatch(decodeSvg(recolored ?? '').toLocaleLowerCase(), /#2563eb/);
	});

	test('does not offer recoloring for uploaded images or unrelated SVGs', () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path fill="#2563EB"/></svg>';

		assert.strictEqual(embeddedGalleryIconColor('data:image/png;base64,aW1hZ2U='), undefined);
		assert.strictEqual(embeddedGalleryIconColor(`data:image/svg+xml;base64,${btoa(svg)}`), undefined);
	});
});

function decodeSvg(source: string): string {
	return atob(source.slice('data:image/svg+xml;base64,'.length));
}
