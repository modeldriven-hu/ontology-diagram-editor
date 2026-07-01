import * as vscode from 'vscode';

import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import type { WebviewMessage } from '../shared/ontology-diagram-events';
import { OntologyDiagramDocumentRepository } from './ontology-diagram-document-repository';
import { OntologyDiagramMessageDispatcher } from './ontology-diagram-message-dispatcher';
import { buildOntologyDiagramWebviewHtml } from './ontology-diagram-webview-html';

export const ontologyDiagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

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
		const repository = new OntologyDiagramDocumentRepository(document);
		const dispatcher = new OntologyDiagramMessageDispatcher(repository, this.getLastDraggedModelTreeItem);
		const messageDisposable = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			await dispatcher.dispatch(message);
		});

		webviewPanel.onDidDispose(() => {
			documentChangeDisposable.dispose();
			messageDisposable.dispose();
		});

		updateWebview();
	}
}
