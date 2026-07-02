import * as path from 'path';
import * as vscode from 'vscode';

import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import type { WebviewCommand } from '../shared/ontology-diagram-commands';
import { OntologyDiagramDocumentRepository } from './ontology-diagram-document-repository';
import { OntologyDiagramCommandDispatcher } from './ontology-diagram-command-dispatcher';
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
			localResourceRoots: [
				vscode.Uri.file(__dirname),
				vscode.Uri.file(path.dirname(document.uri.fsPath)),
			],
		};

		const updateWebview = (): void => {
			webviewPanel.webview.html = buildOntologyDiagramWebviewHtml(document, webviewPanel.webview);
		};

		let nextSuppressedRefreshId = 0;
		const suppressedLocalDocumentRefreshes = new Set<number>();
		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				const suppressedRefreshId = suppressedLocalDocumentRefreshes.values().next().value;
				if (suppressedRefreshId !== undefined) {
					suppressedLocalDocumentRefreshes.delete(suppressedRefreshId);
					return;
				}
				updateWebview();
			}
		});
		const repository = new OntologyDiagramDocumentRepository(document);
		const dispatcher = new OntologyDiagramCommandDispatcher(repository, this.getLastDraggedModelTreeItem);
		let dispatchQueue = Promise.resolve();
		const commandDisposable = webviewPanel.webview.onDidReceiveMessage(async (command: WebviewCommand) => {
			const suppressedRefreshId = isInPlaceBoundsUpdate(command)
				? nextSuppressedRefreshId++
				: undefined;
			if (suppressedRefreshId !== undefined) {
				suppressedLocalDocumentRefreshes.add(suppressedRefreshId);
			}
			dispatchQueue = dispatchQueue.then(
				() => dispatcher.dispatch(command),
				() => dispatcher.dispatch(command),
			).finally(() => {
				if (suppressedRefreshId !== undefined) {
					setTimeout(() => {
						suppressedLocalDocumentRefreshes.delete(suppressedRefreshId);
					}, 2000);
				}
			});
			await dispatchQueue;
		});

		webviewPanel.onDidDispose(() => {
			documentChangeDisposable.dispose();
			commandDisposable.dispose();
		});

		updateWebview();
	}
}

function isInPlaceBoundsUpdate(command: WebviewCommand): boolean {
	return command.type === 'updateNodeBounds'
		|| command.type === 'updateNoteBounds'
		|| command.type === 'updateImageBounds'
		|| command.type === 'updateLabelBounds';
}
