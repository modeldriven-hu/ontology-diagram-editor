import * as assert from 'assert';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { embeddedImageSourceFromFile, imageMimeType } from '../editors/image-source-embedding';

suite('Image source embedding', () => {
	test('embeds selected image files as data URIs', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'image-source-test-'));
		try {
			const imagePath = path.join(directory, 'logo.png');
			await writeFile(imagePath, Buffer.from('image-content'), 'utf8');

			const source = await embeddedImageSourceFromFile(imagePath);

			assert.strictEqual(source, `data:image/png;base64,${Buffer.from('image-content').toString('base64')}`);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('detects supported image MIME types from file extensions', () => {
		assert.strictEqual(imageMimeType('/workspace/logo.svg'), 'image/svg+xml');
		assert.strictEqual(imageMimeType('/workspace/photo.jpeg'), 'image/jpeg');
		assert.strictEqual(imageMimeType('/workspace/unknown.bin'), 'application/octet-stream');
	});
});
