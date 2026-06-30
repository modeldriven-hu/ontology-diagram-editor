import * as vscode from 'vscode';

import { createOntologyDiagram, createOntologyDiagramCommand } from './commands/create-ontology-diagram-command';
import { OntologyDiagramEditorProvider, ontologyDiagramEditorViewType } from './editors/ontology-diagram-editor-provider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const createDiagramDisposable = vscode.commands.registerCommand(createOntologyDiagramCommand, async (resource?: vscode.Uri) => {
		await createOntologyDiagram(resource);
	});
	const ontologyDiagramEditorDisposable = vscode.window.registerCustomEditorProvider(
		ontologyDiagramEditorViewType,
		new OntologyDiagramEditorProvider(),
		{
			supportsMultipleEditorsPerDocument: false,
		},
	);

	context.subscriptions.push(createDiagramDisposable, ontologyDiagramEditorDisposable);
}

export function deactivate() {}
