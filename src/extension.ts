import * as vscode from 'vscode';

import { createOntologyDiagram, createOntologyDiagramCommand } from './commands/create-ontology-diagram-command';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const createDiagramDisposable = vscode.commands.registerCommand(createOntologyDiagramCommand, async (resource?: vscode.Uri) => {
		await createOntologyDiagram(resource);
	});

	context.subscriptions.push(createDiagramDisposable);
}

export function deactivate() {}
