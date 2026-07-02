import * as vscode from 'vscode';

import { OntologyDiagramEditorProvider, ontologyDiagramEditorViewType } from './editors/ontology-diagram-editor-provider';
import { ModelTreeController } from './model-tree/model-tree-controller';
import { CreateOntologyDiagramCommand } from './vscode-commands/create-ontology-diagram';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const modelTreeController = new ModelTreeController();
	modelTreeController.register(context);

	new CreateOntologyDiagramCommand().register(context);
	const ontologyDiagramEditorDisposable = vscode.window.registerCustomEditorProvider(
		ontologyDiagramEditorViewType,
		new OntologyDiagramEditorProvider(async (document) => {
			await modelTreeController.setDiagramDocument(document);
		}, () => modelTreeController.getLastDraggedItem()),
		{
			supportsMultipleEditorsPerDocument: false,
		},
	);
	const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor(async (editor) => {
		if (editor !== undefined) {
			await modelTreeController.setDiagramDocument(editor.document);
		}
	});

	context.subscriptions.push(ontologyDiagramEditorDisposable, activeEditorDisposable);
}

export function deactivate() {}
