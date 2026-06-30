import * as path from 'path';
import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument } from '../odiagram';
import { ModelTreeItemDraggedEvent, modelTreeDragMimeType } from '../model-tree/model-tree-controller';
import { escapeHtml } from '../shared/html';

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
			<div class="title-group">
				<span class="title-mark" aria-hidden="true"></span>
				<strong>Ontology Diagram Editor</strong>
			</div>
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
		line-height: 1.4;
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
		min-height: 44px;
		padding: 8px 14px;
		border-bottom: 1px solid var(--vscode-panel-border);
		background: var(--vscode-sideBar-background);
	}

	.title-group {
		display: inline-flex;
		align-items: center;
		gap: 9px;
		min-width: max-content;
		font-size: 13px;
	}

	.title-mark {
		width: 10px;
		height: 10px;
		border: 1px solid color-mix(in srgb, var(--vscode-focusBorder) 72%, var(--vscode-editor-background));
		border-radius: 2px;
		background: color-mix(in srgb, var(--vscode-focusBorder) 22%, var(--vscode-editor-background));
		box-shadow: inset 0 0 0 2px var(--vscode-sideBar-background);
	}

	.file-location {
		margin: 0;
		padding: 2px 7px;
		border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 80%, transparent);
		border-radius: 4px;
		background: color-mix(in srgb, var(--vscode-editor-background) 72%, transparent);
		color: var(--vscode-descriptionForeground);
		overflow-wrap: anywhere;
		min-width: 0;
		font-size: 12px;
		line-height: 1.35;
	}

	.canvas-scroll {
		position: relative;
		overflow: auto;
		background:
			linear-gradient(color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background)), color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background))),
			linear-gradient(color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent) 1px, transparent 1px),
			linear-gradient(color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent) 1px, transparent 1px);
		background-size: auto, 20px 20px, 20px 20px, 100px 100px, 100px 100px;
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
		padding: 12px 14px;
		border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 84%, transparent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background));
		color: var(--vscode-descriptionForeground);
		box-shadow: 0 8px 22px rgb(0 0 0 / 16%);
		font-size: 13px;
	}

	.error-state {
		border-color: color-mix(in srgb, var(--vscode-errorForeground) 42%, var(--vscode-panel-border));
		color: var(--vscode-errorForeground);
	}

	.drop-active .canvas-content {
		outline: 2px solid var(--vscode-focusBorder);
		outline-offset: -8px;
		background: color-mix(in srgb, var(--vscode-focusBorder) 7%, transparent);
	}

	.drop-rejected .canvas-content {
		outline: 2px solid var(--vscode-errorForeground);
		outline-offset: -8px;
	}

	.status {
		position: absolute;
		right: 16px;
		bottom: 16px;
		max-width: 360px;
		margin: 0;
		padding: 9px 11px;
		border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 84%, transparent);
		border-radius: 6px;
		background: var(--vscode-notifications-background);
		color: var(--vscode-notifications-foreground);
		font-size: 12px;
		box-shadow: 0 8px 24px rgb(0 0 0 / 22%);
		visibility: hidden;
		opacity: 0;
		transform: translateY(6px);
		transition: opacity 120ms ease, transform 120ms ease, visibility 120ms ease;
	}

	.status.visible {
		visibility: visible;
		opacity: 1;
		transform: translateY(0);
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
