import * as path from 'path';
import * as vscode from 'vscode';

import { Bounds, DiagramNode, OntologyDiagramDocument, parseOntologyDiagramTextDocument, stringifyOntologyDiagramYaml } from '../odiagram';
import { ModelTreeItemDraggedEvent, modelTreeDragMimeType } from '../model-tree/model-tree-controller';

export const ontologyDiagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

const defaultNodeWidth = 180;
const defaultNodeHeight = 72;

export class OntologyDiagramEditorProvider implements vscode.CustomTextEditorProvider {
	public constructor(
		private readonly onDidOpenDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
	) {}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		await this.onDidOpenDiagram(document);

		webviewPanel.webview.options = {
			enableScripts: true,
		};

		const updateWebview = (): void => {
			webviewPanel.webview.html = buildWebviewHtml(document);
		};

		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});
		const messageDisposable = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			if (message.type === 'createNode') {
				const payload = message.payload ?? this.getLastDraggedModelTreeItem();
				if (payload === undefined) {
					vscode.window.showInformationMessage('Drag a model-tree item onto the canvas while holding Shift.');
					return;
				}

				await createNodeFromDrop(document, payload, message.position);
			}
		});

		webviewPanel.onDidDispose(() => {
			documentChangeDisposable.dispose();
			messageDisposable.dispose();
		});

		updateWebview();
	}
}

function buildWebviewHtml(document: vscode.TextDocument): string {
	const payload = getDiagramPayload(document);
	const nonce = createNonce();

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(path.basename(document.uri.fsPath))}</title>
	<style>
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

		.node {
			position: absolute;
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 8px;
			overflow: hidden;
			border: 1px solid var(--vscode-editorWidget-border);
			background: var(--vscode-editorWidget-background);
			color: var(--vscode-editor-foreground);
			box-shadow: 0 2px 8px rgb(0 0 0 / 16%);
			text-align: center;
			overflow-wrap: anywhere;
			line-height: 1.25;
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
		}
	</style>
</head>
<body>
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
		const vscode = acquireVsCodeApi();
		const payload = ${jsonForScript(payload)};
		const modelTreeDragMimeType = '${modelTreeDragMimeType.toLowerCase()}';
		const defaultNodeWidth = ${defaultNodeWidth};
		const defaultNodeHeight = ${defaultNodeHeight};
		const nodeCapableTypes = new Set(['class', 'individual', 'datatype']);
		const canvasScroll = document.getElementById('canvasScroll');
		const canvasContent = document.getElementById('canvasContent');
		const status = document.getElementById('status');

		render();

		canvasScroll.addEventListener('dragover', (event) => {
			event.preventDefault();
			event.dataTransfer.dropEffect = 'copy';
			canvasScroll.classList.add('drop-active');
			canvasScroll.classList.remove('drop-rejected');
		});

		canvasScroll.addEventListener('dragleave', (event) => {
			if (!canvasScroll.contains(event.relatedTarget)) {
				canvasScroll.classList.remove('drop-active', 'drop-rejected');
			}
		});

		canvasScroll.addEventListener('drop', (event) => {
			event.preventDefault();
			canvasScroll.classList.remove('drop-active', 'drop-rejected');

			const dragPayload = readDragPayload(event.dataTransfer);
			if (dragPayload && !nodeCapableTypes.has(dragPayload.ontologyItemType)) {
				showStatus('Only classes, individuals, and datatypes can create nodes for now.');
				return;
			}

			const rect = canvasContent.getBoundingClientRect();
			vscode.postMessage({
				type: 'createNode',
				payload: dragPayload,
				position: {
					x: Math.max(0, event.clientX - rect.left),
					y: Math.max(0, event.clientY - rect.top),
				},
			});
		});

		function render() {
			canvasContent.textContent = '';
			if (payload.error) {
				canvasContent.appendChild(messageElement('error-state', payload.error));
				return;
			}

			const nodes = payload.diagram?.nodes ?? [];
			if (nodes.length === 0) {
				canvasContent.appendChild(messageElement('empty-state', 'Drag a class, individual, or datatype from the model tree, then hold Shift while dropping it here.'));
				return;
			}

			for (const node of nodes) {
				canvasContent.appendChild(renderNode(node));
			}
		}

		function renderNode(node) {
			const element = document.createElement('div');
			element.className = 'node';
			element.dataset.nodeId = node.id;
			element.style.left = node.x + 'px';
			element.style.top = node.y + 'px';
			element.style.width = node.width + 'px';
			element.style.height = node.height + 'px';
			element.textContent = node.ontology_ref;
			element.title = node.id + '\\n' + node.ontology_ref;

			if (node.style?.bg_color) {
				element.style.background = node.style.bg_color;
			}
			if (node.style?.text_color) {
				element.style.color = node.style.text_color;
			}
			if (node.style?.border?.color) {
				element.style.borderColor = node.style.border.color;
			}
			if (node.style?.border?.weight !== undefined) {
				element.style.borderWidth = node.style.border.weight + 'px';
			}
			if (node.style?.border?.type === 'dashed' || node.style?.border?.type === 'dotted') {
				element.style.borderStyle = node.style.border.type;
			}
			if (node.style?.border?.type === 'none' || node.style?.border?.weight === 0) {
				element.style.borderStyle = 'none';
			}

			return element;
		}

		function messageElement(className, text) {
			const element = document.createElement('div');
			element.className = className;
			element.textContent = text;
			return element;
		}

		function readDragPayload(dataTransfer) {
			if (!dataTransfer) {
				return undefined;
			}

			const raw = dataTransfer.getData(modelTreeDragMimeType)
				|| dataTransfer.getData('${modelTreeDragMimeType}')
				|| dataTransfer.getData('text/plain');
			if (!raw) {
				return undefined;
			}

			try {
				return JSON.parse(raw);
			} catch {
				return undefined;
			}
		}

		function showStatus(message) {
			status.textContent = message;
			status.classList.add('visible');
			setTimeout(() => {
				status.classList.remove('visible');
			}, 3500);
		}
	</script>
</body>
</html>`;
}

async function createNodeFromDrop(
	document: vscode.TextDocument,
	payload: ModelTreeItemDraggedEvent,
	position: CanvasPoint,
): Promise<void> {
	if (!isNodeCapableOntologyItem(payload.ontologyItemType)) {
		vscode.window.showInformationMessage('Only classes, individuals, and datatypes can create nodes for now.');
		return;
	}

	const diagram = parseOntologyDiagramTextDocument(document);
	const existingNode = diagram.nodes.find((node) => node.ontologyRef.value === payload.ontologyItemReference);
	if (existingNode !== undefined) {
		vscode.window.showInformationMessage(`"${payload.displayLabel}" already has a node in this diagram.`);
		return;
	}

	const node = new DiagramNode(
		nextNodeId(diagram),
		payload.ontologyItemReference,
		new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultNodeWidth, defaultNodeHeight),
	);
	const nextDiagram = new OntologyDiagramDocument(
		diagram.metadata,
		diagram.ontologies,
		diagram.namespaces,
		[...diagram.nodes, node],
		diagram.edges,
		diagram.notes,
		diagram.images,
		diagram.labels,
		diagram.extra,
	);

	const edit = new vscode.WorkspaceEdit();
	const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
	edit.replace(document.uri, fullRange, stringifyOntologyDiagramYaml(nextDiagram));
	const applied = await vscode.workspace.applyEdit(edit);
	if (!applied) {
		throw new Error('Could not update diagram document.');
	}

	await document.save();
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

interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

type WebviewMessage = CreateNodeMessage;

interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDraggedEvent;
	readonly position: CanvasPoint;
}

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}

function nextNodeId(diagram: OntologyDiagramDocument): string {
	const existingIds = new Set(diagram.nodes.map((node) => node.id.value));
	let index = diagram.nodes.length + 1;

	while (existingIds.has(`node_item${index}`)) {
		index += 1;
	}

	return `node_item${index}`;
}

function roundCoordinate(value: number): number {
	return Math.max(0, Math.round(value));
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
