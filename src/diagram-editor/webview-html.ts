import * as vscode from 'vscode';
import { iconGallerySetDefinitions, type IconGallerySet } from '../shared/icon-gallery';
import type { CanvasViewport } from '../shared/canvas-viewport';
import { getDiagramPayload } from './diagram-webview-payload';
import { jsonForScript, webviewBody, webviewHead } from './diagram-webview-markup';

export async function buildDiagramWebviewHtml(
	document: vscode.TextDocument,
	webview: vscode.Webview,
	initialViewport?: CanvasViewport,
): Promise<string> {
	const payload = await getDiagramPayload(document);
	const nonce = createNonce();
	const styleUri = webview.asWebviewUri(
		vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'webview', 'diagram-webview.css'),
	);
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'webview', 'ontology-diagram-canvas.js'),
	);
	const x6ScriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'webview', 'x6.min.js'),
	);
	const iconGallerySets = iconGallerySetDefinitions.map((set): IconGallerySet => ({
		...set,
		uri: webview.asWebviewUri(vscode.Uri.joinPath(
			vscode.Uri.file(__dirname),
			'webview',
			'icon-sets',
			`${set.id}.json`,
		)).toString(),
	}));

	return `<!DOCTYPE html>
<html lang="en">
${webviewHead(document, nonce, webview.cspSource, styleUri)}
${webviewBody(document, nonce, x6ScriptUri, scriptUri, payload, iconGallerySets, initialViewport)}
</html>`;
}


export { getDiagramPayload } from './diagram-webview-payload';
export { jsonForScript } from './diagram-webview-markup';

function createNonce(): string {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let index = 0; index < 32; index += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}
