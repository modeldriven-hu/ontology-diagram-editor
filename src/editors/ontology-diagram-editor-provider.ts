import * as vscode from 'vscode';

import { Bounds, DiagramNode, JsonObject, OntologyDiagramDocument, parseOntologyDiagramTextDocument, stringifyOntologyDiagramYaml } from '../odiagram';
import { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import { CanvasPoint, WebviewMessage, buildOntologyDiagramWebviewHtml } from './ontology-diagram-webview';

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
			webviewPanel.webview.html = buildOntologyDiagramWebviewHtml(document, webviewPanel.webview);
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
		undefined,
		undefined,
		nodeExtraFields(payload),
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

function nodeExtraFields(payload: ModelTreeItemDraggedEvent): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}
