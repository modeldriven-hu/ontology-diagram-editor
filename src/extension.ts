import * as vscode from 'vscode';

import { DiagramEditorProvider, diagramEditorViewType } from './diagram-editor/editor-provider';
import { ModelTree } from './ui/model-tree/model-tree';
import { CreateDiagramCommand } from './diagram-editor/create-diagram-command';
import { PropertiesViewProvider } from './ui/properties/properties-view-provider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const modelTree = new ModelTree();
	modelTree.register(context);
	const propertiesView = new PropertiesViewProvider(
		() => modelTree.getLastDraggedItems(),
		async (diagramElementId) => modelTree.revealDiagramElement(diagramElementId),
	);
	propertiesView.register(context);

	new CreateDiagramCommand().register(context);
	const diagramEditorDisposable = vscode.window.registerCustomEditorProvider(
		diagramEditorViewType,
		new DiagramEditorProvider(async (document) => {
			await Promise.all([
				modelTree.setDiagramDocument(document),
				propertiesView.setDiagramDocument(document),
			]);
		}, async (document) => {
			await Promise.all([
				modelTree.clearDiagramDocument(document),
				propertiesView.clearDiagramDocument(document),
			]);
		}, async (document, event) => {
			if (event.kind === 'ontology') {
				await Promise.all([
					modelTree.refreshDiagramDependency(document),
					propertiesView.refreshDiagramDependency(document),
				]);
			}
		}, async (document, event) => {
			await propertiesView.updateCanvasSelection(document, event);
		}, propertiesView.onDidRequestImageGallery, () => modelTree.getLastDraggedItems(), async (diagramElementId) => {
			return modelTree.revealDiagramElement(diagramElementId);
		}, modelTree.onDidRequestDiagramRefresh, modelTree.onDidRequestItemsAdd, context.workspaceState),
		{
			supportsMultipleEditorsPerDocument: false,
		},
	);
	const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		if (editor !== undefined) {
			await Promise.all([
				modelTree.setDiagramDocument(editor.document),
				propertiesView.setDiagramDocument(editor.document),
			]);
		}
	});

	context.subscriptions.push(diagramEditorDisposable, activeEditorDisposable);
}

export function deactivate() {}
