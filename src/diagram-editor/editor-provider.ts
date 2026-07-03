import * as path from 'path';
import * as vscode from 'vscode';

import type { ModelTreeItemDraggedEvent } from '../ui/model-tree/model-tree';
import type { WebviewCommand } from '../shared/webview-commands';
import { DiagramDocumentRepository } from './document-repository';
import { DiagramCommandDispatcher } from './command-dispatcher';
import { buildDiagramWebviewHtml } from './webview-html';

export const diagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
	public constructor(
		private readonly onDidOpenDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly onDidCloseDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean>,
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

		const updateWebview = async (): Promise<void> => {
			webviewPanel.webview.html = await buildDiagramWebviewHtml(document, webviewPanel.webview);
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
				void updateWebview();
			}
		});
		const repository = new DiagramDocumentRepository(document);
		const dispatcher = new DiagramCommandDispatcher(repository, this.getLastDraggedModelTreeItem, this.revealModelTreeItem);
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
			).catch(async (error: unknown) => {
				await vscode.window.showErrorMessage(`Could not update diagram: ${error instanceof Error ? error.message : String(error)}`);
			}).finally(() => {
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
			void this.onDidCloseDiagram(document);
		});

		void updateWebview();
	}
}

function isInPlaceBoundsUpdate(command: WebviewCommand): boolean {
	return command.type === 'updateNodeBounds'
		|| command.type === 'updateNoteBounds'
		|| command.type === 'updateImageBounds'
		|| command.type === 'updateLabelBounds';
}
