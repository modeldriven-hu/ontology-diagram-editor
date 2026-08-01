import * as path from 'path';
import * as vscode from 'vscode';
import { readFile } from 'fs/promises';

async function pickImageFile(openLabel: string, title: string): Promise<vscode.Uri | undefined> {
	const selectedImage = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: {
			Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
		},
		openLabel,
		title,
	});

	return selectedImage?.[0];
}

export async function resolveEmbeddedImageSource(
	source: string | undefined,
	pickFile: boolean,
	openLabel: string,
	title: string,
): Promise<string | undefined> {
	if (source !== undefined) {
		return source;
	}
	if (!pickFile) {
		return undefined;
	}

	const imageUri = await pickImageFile(openLabel, title);
	return imageUri === undefined ? undefined : embeddedImageSourceFromFile(imageUri.fsPath);
}

async function embeddedImageSourceFromFile(filePath: string): Promise<string> {
	const content = await readFile(filePath);

	return `data:${imageMimeType(filePath)};base64,${content.toString('base64')}`;
}

function imageMimeType(filePath: string): string {
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


