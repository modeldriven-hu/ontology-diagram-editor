import * as assert from 'assert';
import * as path from 'path';
import { readFile } from 'fs/promises';

import { iconGallerySetDefinitions } from '../shared/icon-gallery';

suite('Icon gallery', () => {
	test('bundles three complementary offline icon collections', async () => {
		assert.deepStrictEqual(iconGallerySetDefinitions.map((set) => set.id), ['mdi', 'carbon', 'bi']);
		let iconCount = 0;
		let cloudIconCount = 0;
		for (const set of iconGallerySetDefinitions) {
			const filePath = path.join(__dirname, '..', '..', 'dist', 'webview', 'icon-sets', `${set.id}.json`);
			const collection = JSON.parse(await readFile(filePath, 'utf8')) as { readonly prefix: string; readonly icons: Record<string, unknown> };
			assert.strictEqual(collection.prefix, set.id);
			const names = Object.keys(collection.icons);
			assert.ok(names.length >= set.total);
			iconCount += names.length;
			cloudIconCount += names.filter((name) => name.includes('cloud')).length;
		}
		assert.ok(iconCount >= 12_000);
		assert.ok(cloudIconCount >= 200);
	});
});
