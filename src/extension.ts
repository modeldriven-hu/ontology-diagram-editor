import * as vscode from 'vscode';

import { DiagramEditorProvider, diagramEditorViewType } from './diagram-editor/editor-provider';
import { ModelTree } from './ui/model-tree/model-tree';
import { CreateDiagramCommand } from './diagram-editor/create-diagram-command';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const modelTree = new ModelTree();
	modelTree.register(context);

	new CreateDiagramCommand().register(context);
	const diagramEditorDisposable = vscode.window.registerCustomEditorProvider(
		diagramEditorViewType,
		new DiagramEditorProvider(async (document) => {
			await modelTree.setDiagramDocument(document);
		}, () => modelTree.getLastDraggedItem()),
		{
			supportsMultipleEditorsPerDocument: false,
		},
	);
	const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		if (editor !== undefined) {
			await modelTree.setDiagramDocument(editor.document);
		}
	});

	context.subscriptions.push(diagramEditorDisposable, activeEditorDisposable);
}

export function deactivate() {}
