import * as path from 'path';
import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument } from '../odiagram';
import { modelTreeDragMimeType } from '../model-tree/model-tree-controller';
import { escapeHtml } from '../shared/html';

export function buildOntologyDiagramWebviewHtml(
	document: vscode.TextDocument,
	webview: vscode.Webview,
): string {
	const payload = getDiagramPayload(document, webview);
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
		<div class="canvas-scroll" id="canvasScroll" tabindex="0">
			<div class="canvas-actions" role="toolbar" aria-label="Canvas tools">
				<button class="canvas-action" id="addNoteButton" type="button" title="Add note" aria-label="Add note"></button>
				<button class="canvas-action" id="addLabelButton" type="button" title="Add label" aria-label="Add label"></button>
				<button class="canvas-action" id="addImageButton" type="button" title="Add image" aria-label="Add image"></button>
			</div>
			<form class="note-editor" id="noteEditor" hidden>
				<textarea class="note-editor-text" id="noteEditorText" rows="5" aria-label="Note text"></textarea>
				<div class="note-editor-actions">
					<button class="note-editor-button primary" id="saveNoteButton" type="button">Save</button>
					<button class="note-editor-button" id="cancelNoteButton" type="button">Cancel</button>
				</div>
			</form>
			<div class="canvas-content" id="canvasContent"></div>
			<p class="status" id="status"></p>
		</div>
		<section class="property-panel" id="propertyPanel">
			<header class="property-panel-header">
				<strong id="propertyPanelTitle">Properties</strong>
				<button class="property-panel-toggle" id="propertyPanelToggle" type="button" aria-expanded="true" title="Toggle properties">Properties</button>
			</header>
			<div class="property-panel-body" id="propertyPanelBody"></div>
		</section>
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
		grid-template-rows: auto minmax(0, 1fr) auto;
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
		outline: none;
		background:
			linear-gradient(color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background)), color-mix(in srgb, var(--vscode-editor-background) 94%, var(--vscode-sideBar-background))),
			linear-gradient(color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--vscode-editor-foreground) 7%, transparent) 1px, transparent 1px),
			linear-gradient(color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent) 1px, transparent 1px),
			linear-gradient(90deg, color-mix(in srgb, var(--vscode-editor-foreground) 12%, transparent) 1px, transparent 1px);
		background-size: auto, 12px 12px, 12px 12px, 60px 60px, 60px 60px;
	}

	.canvas-actions {
		position: absolute;
		top: 12px;
		left: 12px;
		z-index: 3;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		margin: 0;
		padding: 4px;
		border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 84%, transparent);
		border-radius: 6px;
		background: color-mix(in srgb, var(--vscode-sideBar-background) 92%, var(--vscode-editor-background));
		box-shadow: 0 8px 22px rgb(0 0 0 / 18%);
	}

	.canvas-action {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 30px;
		padding: 0;
		border: 1px solid transparent;
		border-radius: 4px;
		background: transparent;
		color: var(--vscode-foreground);
		cursor: pointer;
	}

	.canvas-action:hover,
	.canvas-action:focus-visible {
		border-color: var(--vscode-focusBorder);
		background: color-mix(in srgb, var(--vscode-focusBorder) 14%, transparent);
		outline: none;
	}

	.canvas-action-icon {
		width: 19px;
		height: 19px;
		stroke-width: 1.9;
	}

	.note-editor {
		position: absolute;
		top: 56px;
		left: 12px;
		z-index: 4;
		width: min(320px, calc(100% - 24px));
		padding: 8px;
		border: 1px solid color-mix(in srgb, var(--vscode-focusBorder) 70%, var(--vscode-panel-border));
		border-radius: 6px;
		background: var(--vscode-sideBar-background);
		box-shadow: 0 10px 28px rgb(0 0 0 / 26%);
	}

	.note-editor[hidden] {
		display: none;
	}

	.note-editor-text {
		display: block;
		width: 100%;
		min-height: 112px;
		resize: vertical;
		padding: 8px;
		border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
		border-radius: 4px;
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		font: inherit;
		line-height: 1.4;
	}

	.note-editor-text:focus {
		border-color: var(--vscode-focusBorder);
		outline: none;
	}

	.note-editor-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		margin-top: 8px;
	}

	.note-editor-button {
		min-width: 68px;
		height: 28px;
		padding: 0 10px;
		border: 1px solid var(--vscode-button-border, transparent);
		border-radius: 4px;
		background: var(--vscode-button-secondaryBackground);
		color: var(--vscode-button-secondaryForeground);
		font: inherit;
		cursor: pointer;
	}

	.note-editor-button.primary {
		background: var(--vscode-button-background);
		color: var(--vscode-button-foreground);
	}

	.note-editor-button:hover,
	.note-editor-button:focus-visible {
		outline: 1px solid var(--vscode-focusBorder);
		outline-offset: 1px;
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
	}

	.property-panel {
		min-height: 112px;
		max-height: 340px;
		resize: vertical;
		overflow: auto;
		border-top: 1px solid var(--vscode-panel-border);
		background: var(--vscode-sideBar-background);
	}

	.property-panel.collapsed {
		min-height: 34px;
		height: 34px !important;
		resize: none;
		overflow: hidden;
	}

	.property-panel-header {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
		min-height: 34px;
		padding: 5px 12px;
		border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 76%, transparent);
		background: var(--vscode-sideBar-background);
	}

	.property-panel-toggle {
		height: 24px;
		padding: 0 8px;
		border: 1px solid var(--vscode-button-border, transparent);
		border-radius: 4px;
		background: var(--vscode-button-secondaryBackground);
		color: var(--vscode-button-secondaryForeground);
		font: inherit;
		cursor: pointer;
	}

	.property-panel-body {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
		gap: 12px;
		padding: 10px 12px 12px;
	}

	.property-section {
		min-width: 0;
	}

	.property-section-title {
		margin: 0 0 6px;
		color: var(--vscode-descriptionForeground);
		font-size: 11px;
		font-weight: 600;
		text-transform: uppercase;
	}

	.property-field {
		display: grid;
		grid-template-columns: minmax(72px, max-content) minmax(0, 1fr);
		align-items: center;
		gap: 6px 10px;
		margin-bottom: 7px;
	}

	.property-label {
		color: var(--vscode-descriptionForeground);
		font-size: 12px;
	}

	.property-value,
	.property-input,
	.property-textarea {
		min-width: 0;
		width: 100%;
	}

	.property-value {
		overflow-wrap: anywhere;
		font-size: 12px;
	}

	.property-input,
	.property-textarea {
		padding: 4px 6px;
		border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
		border-radius: 4px;
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		font: inherit;
	}

	.property-input:focus,
	.property-textarea:focus {
		border-color: var(--vscode-focusBorder);
		outline: none;
	}

	.property-textarea {
		min-height: 58px;
		resize: vertical;
	}

	.property-inline {
		display: flex;
		align-items: center;
		gap: 6px;
		min-width: 0;
	}

	.property-inline .property-input {
		flex: 1 1 auto;
	}

	.property-button {
		flex: 0 0 auto;
		height: 26px;
		padding: 0 8px;
		border: 1px solid var(--vscode-button-border, transparent);
		border-radius: 4px;
		background: var(--vscode-button-secondaryBackground);
		color: var(--vscode-button-secondaryForeground);
		font: inherit;
		cursor: pointer;
	}`;
}

function getDiagramPayload(document: vscode.TextDocument, webview: vscode.Webview): JsonPayload {
	try {
		const diagram = parseOntologyDiagramTextDocument(document);
		const persistenceObject = diagram.toPersistenceObject();

		return {
			file: {
				fsPath: document.uri.fsPath,
				uri: document.uri.toString(),
				directory: path.dirname(document.uri.fsPath),
			},
			diagram: {
				...persistenceObject,
				images: diagram.images.map((image) => ({
					...image.toPersistenceObject(),
					webview_src: imageWebviewSource(document, webview, image.source),
				})),
			},
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

function imageWebviewSource(document: vscode.TextDocument, webview: vscode.Webview, source: string): string {
	if (source.startsWith('data:image/')) {
		return source;
	}

	const imagePath = path.resolve(path.dirname(document.uri.fsPath), source);

	return webview.asWebviewUri(vscode.Uri.file(imagePath)).toString();
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
