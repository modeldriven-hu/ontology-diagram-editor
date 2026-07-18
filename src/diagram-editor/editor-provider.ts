import * as path from 'path';
import * as vscode from 'vscode';

import type { DiagramRefreshRequestedEvent, ModelTreeItemDraggedEvent, ModelTreeItemsAddRequestedEvent } from '../ui/model-tree/model-tree';
import type { WebviewCommand } from '../shared/webview-commands';
import type { CanvasSelectionChangedEvent } from '../shared/canvas-editor-events';
import { DiagramDocumentRepository } from './document-repository';
import { DiagramCommandDispatcher } from './command-dispatcher';
import { buildDiagramWebviewHtml } from './webview-html';
import { CanvasViewportPersistence } from './canvas-viewport-persistence';
import { ActiveDiagramEditorRegistry } from './active-diagram-editor-registry';
import { DiagramDependencyWatcher, type DiagramDependencyChangedEvent } from './diagram-dependency-watcher';
import type { PropertiesImageGalleryRequest } from '../ui/properties/properties-view-provider';
import type { OpenImageGalleryMessage } from '../shared/icon-gallery';

export const diagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

export class DiagramEditorProvider implements vscode.CustomTextEditorProvider {
	private readonly editorRegistry = new ActiveDiagramEditorRegistry<vscode.WebviewPanel, vscode.TextDocument>();
	private diagramStateQueue = Promise.resolve();

	public constructor(
		private readonly onDidActivateDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly onDidCloseDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly onDidChangeDiagramDependency: (document: vscode.TextDocument, event: DiagramDependencyChangedEvent) => void | Promise<void>,
		private readonly onDidChangeCanvasSelection: (document: vscode.TextDocument, event: CanvasSelectionChangedEvent) => void | Promise<void>,
		private readonly onDidRequestImageGallery: vscode.Event<PropertiesImageGalleryRequest>,
		private readonly getLastDraggedModelTreeItems: () => readonly ModelTreeItemDraggedEvent[],
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean>,
		private readonly onDidRequestDiagramRefresh: vscode.Event<DiagramRefreshRequestedEvent>,
		private readonly onDidRequestItemsAdd: vscode.Event<ModelTreeItemsAddRequestedEvent>,
		private readonly workspaceState: vscode.Memento,
	) {}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		const initiallyActiveDocument = this.editorRegistry.open(webviewPanel, document);
		if (initiallyActiveDocument !== undefined) {
			await this.queueDiagramStateUpdate(() => this.onDidActivateDiagram(initiallyActiveDocument));
		}

		webviewPanel.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				vscode.Uri.file(__dirname),
				vscode.Uri.file(path.dirname(document.uri.fsPath)),
			],
		};
		const viewportPersistence = new CanvasViewportPersistence(document.uri.toString(), this.workspaceState);

		const buildAndApplyWebview = async (): Promise<void> => {
			webviewPanel.webview.html = await buildDiagramWebviewHtml(document, webviewPanel.webview, viewportPersistence.current());
		};
		let webviewUpdateQueue = Promise.resolve();
		const updateWebview = (): Promise<void> => {
			webviewUpdateQueue = webviewUpdateQueue.then(buildAndApplyWebview, buildAndApplyWebview);
			return webviewUpdateQueue;
		};
		const dependencyWatcher = new DiagramDependencyWatcher(document, (event) => {
			void Promise.all([
				updateWebview(),
				this.onDidChangeDiagramDependency(document, event),
			]).catch(async (error: unknown) => {
				await vscode.window.showErrorMessage(`Could not refresh diagram dependencies: ${error instanceof Error ? error.message : String(error)}`);
			});
		});

		let nextSuppressedRefreshId = 0;
		const suppressedLocalDocumentRefreshes = new Set<number>();
		const repository = new DiagramDocumentRepository(document);
		const dispatcher = new DiagramCommandDispatcher(repository, this.getLastDraggedModelTreeItems, this.revealModelTreeItem);
		let dispatchQueue = Promise.resolve();
		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				dependencyWatcher.refresh();
				const suppressedRefreshId = suppressedLocalDocumentRefreshes.values().next().value;
				if (suppressedRefreshId !== undefined) {
					suppressedLocalDocumentRefreshes.delete(suppressedRefreshId);
					return;
				}
				void updateWebview();
			}
		});
		const diagramRefreshDisposable = this.onDidRequestDiagramRefresh((event) => {
			if (event.diagramUri.toString() === document.uri.toString()) {
				void updateWebview();
			}
		});
		const imageGalleryRequestDisposable = this.onDidRequestImageGallery((event) => {
			if (event.diagramUri.toString() !== document.uri.toString()) {
				return;
			}
			const message: OpenImageGalleryMessage = {
				type: 'openImageGallery',
				targetType: event.targetType,
				targetId: event.targetId,
			};
			void webviewPanel.webview.postMessage(message);
		});
		const addItemsDisposable = this.onDidRequestItemsAdd((event) => {
			if (event.diagramUri.toString() !== document.uri.toString()) {
				return;
			}

			dispatchQueue = dispatchQueue.then(
				() => dispatcher.addModelTreeItems(event.items),
				() => dispatcher.addModelTreeItems(event.items),
			).catch(async (error: unknown) => {
				await vscode.window.showErrorMessage(`Could not add ontology elements to diagram: ${error instanceof Error ? error.message : String(error)}`);
			});
		});
		const viewStateDisposable = webviewPanel.onDidChangeViewState((event) => {
			const activeDocument = this.editorRegistry.activate(event.webviewPanel);
			if (activeDocument !== undefined) {
				void this.queueDiagramStateUpdate(() => this.onDidActivateDiagram(activeDocument));
			}
		});
		const commandDisposable = webviewPanel.webview.onDidReceiveMessage(async (command: DiagramWebviewMessage) => {
			if (command.type === 'canvasSelectionChanged') {
				await this.onDidChangeCanvasSelection(document, command);
				return;
			}
			if (command.type === 'updateCanvasViewport') {
				viewportPersistence.capture(command.viewport);
				return;
			}
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
			diagramRefreshDisposable.dispose();
			addItemsDisposable.dispose();
			viewStateDisposable.dispose();
			imageGalleryRequestDisposable.dispose();
			commandDisposable.dispose();
			dependencyWatcher.dispose();
			void viewportPersistence.save();
			const closedEditor = this.editorRegistry.close(webviewPanel);
			if (closedEditor !== undefined) {
				void this.queueDiagramStateUpdate(async () => {
					await this.onDidCloseDiagram(closedEditor.closedDocument);
					if (closedEditor.replacementDocument !== undefined) {
						await this.onDidActivateDiagram(closedEditor.replacementDocument);
					}
				});
			}
		});

		void updateWebview();
	}

	private queueDiagramStateUpdate(update: () => void | Promise<void>): Promise<void> {
		this.diagramStateQueue = this.diagramStateQueue.then(update, update);
		return this.diagramStateQueue;
	}
}

type DiagramWebviewMessage = WebviewCommand | CanvasSelectionChangedEvent;

function isInPlaceBoundsUpdate(command: WebviewCommand): boolean {
	return command.type === 'updateElementBounds'
		|| command.type === 'updateNodeBounds'
		|| command.type === 'updateNoteBounds'
		|| command.type === 'updateImageBounds'
		|| command.type === 'updateLabelBounds';
}
