import * as vscode from 'vscode';

import { createOntologyDiagram, createOntologyDiagramCommand } from './commands/create-ontology-diagram-command';
import { OntologyDiagramEditorProvider, ontologyDiagramEditorViewType } from './editors/ontology-diagram-editor-provider';
import { ModelTreeController } from './model-tree/model-tree-controller';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const modelTreeController = new ModelTreeController();
	modelTreeController.register(context);

	const createDiagramDisposable = vscode.commands.registerCommand(createOntologyDiagramCommand, async (resource?: vscode.Uri) => {
		await createOntologyDiagram(resource);
	});
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

	context.subscriptions.push(createDiagramDisposable, ontologyDiagramEditorDisposable, activeEditorDisposable);
}

export function deactivate() {}
