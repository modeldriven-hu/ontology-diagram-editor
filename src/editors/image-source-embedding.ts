import * as path from 'path';
import { readFile } from 'fs/promises';

export async function embeddedImageSourceFromFile(filePath: string): Promise<string> {
	const content = await readFile(filePath);

	return `data:${imageMimeType(filePath)};base64,${content.toString('base64')}`;
}

export function imageMimeType(filePath: string): string {
	switch (path.extname(filePath).toLowerCase()) {
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.gif':
			return 'image/gif';
		case '.webp':
			return 'image/webp';
		case '.bmp':
			return 'image/bmp';
		case '.svg':
			return 'image/svg+xml';
		default:
			return 'application/octet-stream';
	}
}
