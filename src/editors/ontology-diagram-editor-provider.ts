import * as path from 'path';
import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument } from '../odiagram';

export const ontologyDiagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

export class OntologyDiagramEditorProvider implements vscode.CustomTextEditorProvider {
	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		webviewPanel.webview.options = {
			enableScripts: false,
		};

		const updateWebview = (): void => {
			webviewPanel.webview.html = buildWebviewHtml(document);
		};

		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});

		webviewPanel.onDidDispose(() => {
			documentChangeDisposable.dispose();
		});

		updateWebview();
	}
}

function buildWebviewHtml(document: vscode.TextDocument): string {
	const payload = getDiagramPayload(document);
	const json = JSON.stringify(payload, null, 2);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(path.basename(document.uri.fsPath))}</title>
	<style>
		body {
			box-sizing: border-box;
			margin: 0;
			padding: 24px;
			color: var(--vscode-editor-foreground);
			background: var(--vscode-editor-background);
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
		}

		main {
			display: grid;
			gap: 16px;
			max-width: 960px;
		}

		h1 {
			margin: 0;
			font-size: 20px;
			font-weight: 600;
		}

		.file-location {
			margin: 0;
			color: var(--vscode-descriptionForeground);
			overflow-wrap: anywhere;
		}

		pre {
			margin: 0;
			padding: 16px;
			overflow: auto;
			border: 1px solid var(--vscode-panel-border);
			background: var(--vscode-textCodeBlock-background);
			font-family: var(--vscode-editor-font-family);
			font-size: var(--vscode-editor-font-size);
			line-height: 1.5;
		}
	</style>
</head>
<body>
	<main>
		<h1>Ontology Diagram Editor</h1>
		<p class="file-location">${escapeHtml(document.uri.fsPath)}</p>
		<pre>${escapeHtml(json)}</pre>
	</main>
</body>
</html>`;
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

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
