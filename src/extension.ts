import * as vscode from 'vscode';

import { OntologyDiagramEditorProvider, ontologyDiagramEditorViewType } from './editors/ontology-diagram-editor-provider';
import { ModelTree } from './model-tree/model-tree';
import { CreateOntologyDiagramCommand } from './vscode-commands/create-ontology-diagram';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const modelTree = new ModelTree();
	modelTree.register(context);

	new CreateOntologyDiagramCommand().register(context);
	const ontologyDiagramEditorDisposable = vscode.window.registerCustomEditorProvider(
		ontologyDiagramEditorViewType,
		new OntologyDiagramEditorProvider(async (document) => {
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

	context.subscriptions.push(ontologyDiagramEditorDisposable, activeEditorDisposable);
}

export function deactivate() {}
