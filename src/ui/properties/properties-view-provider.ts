import * as path from 'path';
import * as vscode from 'vscode';

import type { CanvasSelectionChangedEvent } from '../../shared/canvas-editor-events';
import type { WebviewCommand } from '../../shared/webview-commands';
import { ontologyDiagramFileExtension } from '../../documents/odiagram';
import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree';
import { DiagramCommandDispatcher } from '../../diagram-editor/command-dispatcher';
import { DiagramDocumentRepository } from '../../diagram-editor/document-repository';
import { getDiagramPayload } from '../../diagram-editor/webview-html';
import type { DiagramPayload } from '../webview/ontology-diagram-types';
import { buildPropertiesViewHtml } from './properties-view-html';
import type { PropertiesViewStateMessage, PropertiesViewToExtensionMessage } from './properties-view-messages';
import type { ImageGalleryTargetType } from '../../shared/icon-gallery';

export const propertiesViewId = 'ontology-diagram-editor.properties';

export interface PropertiesImageGalleryRequest {
	readonly diagramUri: vscode.Uri;
	readonly targetType: ImageGalleryTargetType;
	readonly targetId: string;
}

export class PropertiesViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
	private readonly disposables: vscode.Disposable[] = [];
	private readonly imageGalleryRequestEmitter = new vscode.EventEmitter<PropertiesImageGalleryRequest>();
	public readonly onDidRequestImageGallery = this.imageGalleryRequestEmitter.event;
	private view?: vscode.WebviewView;
	private activeDocument?: vscode.TextDocument;
	private selectedElementIdentifier?: string;
	private selectedElementType?: CanvasSelectionChangedEvent['selectedElementType'];
	private selectedElementIdentifiers: readonly string[] = [];
	private payload?: DiagramPayload;
	private stateRevision = 0;
	private dispatchQueue = Promise.resolve();

	public constructor(
		private readonly getLastDraggedModelTreeItems: () => readonly ModelTreeItemDraggedEvent[],
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean>,
	) {}

	public register(context: vscode.ExtensionContext): void {
		this.disposables.push(
			vscode.window.registerWebviewViewProvider(propertiesViewId, this),
			vscode.workspace.onDidChangeTextDocument((event) => {
				if (this.activeDocument?.uri.toString() !== event.document.uri.toString()) {
					return;
				}
				this.activeDocument = event.document;
				void this.refresh();
			}),
		);
		context.subscriptions.push(this);
	}

	public resolveWebviewView(view: vscode.WebviewView): void {
		this.view = view;
		view.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(__dirname)],
		};
		view.webview.html = buildPropertiesViewHtml(view.webview);
		this.disposables.push(
			view.webview.onDidReceiveMessage((message: PropertiesViewToExtensionMessage) => {
				if (message.type === 'propertiesViewReady') {
					if (this.payload === undefined && this.activeDocument !== undefined) {
						void this.refresh();
					} else {
						void this.postState();
					}
					return;
				}
				if (message.type === 'propertiesViewFocusCanvas') {
					void vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
					return;
				}
				if (message.type === 'propertiesViewOpenImageGallery') {
					if (this.activeDocument !== undefined) {
						this.imageGalleryRequestEmitter.fire({
							diagramUri: this.activeDocument.uri,
							targetType: message.targetType,
							targetId: message.targetId,
						});
						void vscode.commands.executeCommand('workbench.action.focusActiveEditorGroup');
					}
					return;
				}
				this.dispatch(message.command);
			}),
			view.onDidDispose(() => {
				if (this.view === view) {
					this.view = undefined;
				}
			}),
		);
	}

	public async setDiagramDocument(document: vscode.TextDocument): Promise<void> {
		if (path.extname(document.uri.fsPath) !== ontologyDiagramFileExtension) {
			return;
		}
		if (this.activeDocument?.uri.toString() !== document.uri.toString()) {
			this.clearSelection();
			this.payload = undefined;
		}
		this.activeDocument = document;
		await this.refresh();
	}

	public async clearDiagramDocument(document: vscode.TextDocument): Promise<void> {
		if (this.activeDocument?.uri.toString() !== document.uri.toString()) {
			return;
		}
		this.activeDocument = undefined;
		this.payload = undefined;
		this.clearSelection();
		await this.refresh();
	}

	public async refreshDiagramDependency(document: vscode.TextDocument): Promise<void> {
		if (this.activeDocument?.uri.toString() === document.uri.toString()) {
			await this.refresh();
		}
	}

	public async updateCanvasSelection(document: vscode.TextDocument, event: CanvasSelectionChangedEvent): Promise<void> {
		if (this.activeDocument?.uri.toString() !== document.uri.toString()) {
			return;
		}
		this.selectedElementIdentifier = event.selectedElementIdentifier;
		this.selectedElementType = event.selectedElementType;
		this.selectedElementIdentifiers = event.selectedElementIdentifiers;
		await this.postState();
	}

	public dispose(): void {
		this.imageGalleryRequestEmitter.dispose();
		for (const disposable of this.disposables.splice(0)) {
			disposable.dispose();
		}
	}

	private clearSelection(): void {
		this.selectedElementIdentifier = undefined;
		this.selectedElementType = undefined;
		this.selectedElementIdentifiers = [];
	}

	private async refresh(): Promise<void> {
		const revision = ++this.stateRevision;
		const document = this.activeDocument;
		const payload = document === undefined ? undefined : await getDiagramPayload(document);
		if (revision !== this.stateRevision || document?.uri.toString() !== this.activeDocument?.uri.toString()) {
			return;
		}
		this.payload = payload;
		await this.postState();
	}

	private async postState(): Promise<void> {
		const message: PropertiesViewStateMessage = {
			type: 'setPropertiesState',
			payload: this.payload,
			selectedElementIdentifier: this.selectedElementIdentifier,
			selectedElementType: this.selectedElementType,
			selectedElementIdentifiers: this.selectedElementIdentifiers,
		};
		await this.view?.webview.postMessage(message);
	}

	private dispatch(command: WebviewCommand): void {
		const document = this.activeDocument;
		if (document === undefined) {
			return;
		}
		const dispatcher = new DiagramCommandDispatcher(
			new DiagramDocumentRepository(document),
			this.getLastDraggedModelTreeItems,
			this.revealModelTreeItem,
		);
		this.dispatchQueue = this.dispatchQueue.then(
			() => dispatcher.dispatch(command),
			() => dispatcher.dispatch(command),
		).catch(async (error: unknown) => {
			await vscode.window.showErrorMessage(`Could not update diagram properties: ${error instanceof Error ? error.message : String(error)}`);
		});
	}
}
