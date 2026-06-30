import * as path from 'path';
import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument } from '../odiagram';
import { ModelTreeItemDraggedEvent, modelTreeDragMimeType } from '../model-tree/model-tree-controller';

export interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

export type WebviewMessage = CreateNodeMessage;

export interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDraggedEvent;
	readonly position: CanvasPoint;
}

export function buildOntologyDiagramWebviewHtml(
	document: vscode.TextDocument,
	webview: vscode.Webview,
): string {
	const payload = getDiagramPayload(document);
	const nonce = createNonce();
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'webview', 'ontology-diagram-canvas.js'),
	);

	return `<!DOCTYPE html>
<html lang="en">
${webviewHead(document, nonce, webview.cspSource)}
${webviewBody(document, nonce, scriptUri, payload)}
</html>`;
}

function webviewHead(document: vscode.TextDocument, nonce: string, cspSource: string): string {
	return `<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(path.basename(document.uri.fsPath))}</title>
	<style>${webviewStyles()}</style>
</head>`;
}

function webviewBody(
	document: vscode.TextDocument,
	nonce: string,
	scriptUri: vscode.Uri,
	payload: JsonPayload,
): string {
	return `<body>
	<div class="editor">
		<header class="header">
			<strong>Ontology Diagram Editor</strong>
			<p class="file-location">${escapeHtml(document.uri.fsPath)}</p>
		</header>
		<div class="canvas-scroll" id="canvasScroll">
			<div class="canvas-content" id="canvasContent"></div>
			<p class="status" id="status"></p>
		</div>
	</div>
	<script nonce="${nonce}">
		window.ontologyDiagramEditorConfig = {
			payload: ${jsonForScript(payload)},
			modelTreeDragMimeType: '${modelTreeDragMimeType.toLowerCase()}'
		};
	</script>
	<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>`;
}

function webviewStyles(): string {
	return `
	* {
		box-sizing: border-box;
	}

	body {
		margin: 0;
		color: var(--vscode-editor-foreground);
		background: var(--vscode-editor-background);
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
	}

	.editor {
		display: grid;
		grid-template-rows: auto 1fr;
		height: 100vh;
	}

	.header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		min-width: 0;
		padding: 10px 14px;
		border-bottom: 1px solid var(--vscode-panel-border);
		background: var(--vscode-sideBar-background);
	}

	.file-location {
		margin: 0;
		color: var(--vscode-descriptionForeground);
		overflow-wrap: anywhere;
		min-width: 0;
		font-size: 12px;
	}

	.canvas-scroll {
		position: relative;
		overflow: auto;
		background:
			linear-gradient(var(--vscode-editor-background), var(--vscode-editor-background)),
			radial-gradient(circle, color-mix(in srgb, var(--vscode-editor-foreground) 16%, transparent) 1px, transparent 1px);
		background-size: auto, 20px 20px;
	}

	.canvas-content {
		position: relative;
		min-width: 1800px;
		min-height: 1200px;
		cursor: default;
	}

	.empty-state,
	.error-state {
		position: absolute;
		left: 24px;
		top: 24px;
		max-width: 560px;
		padding: 14px 16px;
		border: 1px solid var(--vscode-panel-border);
		background: var(--vscode-editor-background);
		color: var(--vscode-descriptionForeground);
	}

	.error-state {
		color: var(--vscode-errorForeground);
	}

	.drop-active .canvas-content {
		outline: 2px dashed var(--vscode-focusBorder);
		outline-offset: -6px;
	}

	.drop-rejected .canvas-content {
		outline: 2px dashed var(--vscode-errorForeground);
		outline-offset: -6px;
	}

	.status {
		position: absolute;
		right: 16px;
		bottom: 16px;
		max-width: 360px;
		margin: 0;
		padding: 8px 10px;
		border: 1px solid var(--vscode-panel-border);
		background: var(--vscode-notifications-background);
		color: var(--vscode-notifications-foreground);
		font-size: 12px;
		visibility: hidden;
	}

	.status.visible {
		visibility: visible;
	}`;
}

function getDiagramPayload(document: vscode.TextDocument): JsonPayload {
	try {
		const diagram = parseOntologyDiagramTextDocument(document);

		return {
			file: {
				fsPath: document.uri.fsPath,
				uri: document.uri.toString(),
				directory: path.dirname(document.uri.fsPath),
			},
			diagram: diagram.toPersistenceObject(),
		};
	} catch (error) {
		return {
			file: {
				fsPath: document.uri.fsPath,
				uri: document.uri.toString(),
				directory: path.dirname(document.uri.fsPath),
			},
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

interface JsonPayload {
	readonly file: {
		readonly fsPath: string;
		readonly uri: string;
		readonly directory: string;
	};
	readonly diagram?: unknown;
	readonly error?: string;
}

function jsonForScript(value: unknown): string {
	return JSON.stringify(value).replaceAll('<', '\\u003c');
}

function createNonce(): string {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let index = 0; index < 32; index += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
