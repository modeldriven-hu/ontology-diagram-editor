import * as path from 'path';
import * as vscode from 'vscode';

import { OntologyDiagramDocument, stringifyOntologyDiagramYaml } from './odiagram';

const helloWorldCommand = 'ontology-diagram-editor.helloWorld';
const createDiagramCommand = 'ontology-diagram-editor.createOntologyDiagram';
const defaultDiagramFileName = 'new-diagram.odiagram';

export function activate(context: vscode.ExtensionContext) {
	console.log('Congratulations, your extension "ontology-diagram-editor" is now active!');

	const disposable = vscode.commands.registerCommand(helloWorldCommand, () => {
		vscode.window.showInformationMessage('Hello World from Ontology Diagram Editor!');
	});

	const createDiagramDisposable = vscode.commands.registerCommand(createDiagramCommand, async (resource?: vscode.Uri) => {
		await createOntologyDiagram(resource);
	});

	context.subscriptions.push(disposable, createDiagramDisposable);
}

export function deactivate() {}

async function createOntologyDiagram(resource?: vscode.Uri): Promise<void> {
	const targetFolder = await resolveTargetFolder(resource);
	if (targetFolder === undefined) {
		return;
	}

	const fileName = await vscode.window.showInputBox({
		title: 'New Ontology Diagram',
		prompt: 'Enter a name for the new ontology diagram file.',
		value: defaultDiagramFileName,
		validateInput: validateDiagramFileName,
	});

	if (fileName === undefined) {
		return;
	}

	const targetFile = vscode.Uri.joinPath(targetFolder, ensureOntologyDiagramExtension(fileName.trim()));
	if (await fileExists(targetFile)) {
		vscode.window.showErrorMessage(`A file named "${path.basename(targetFile.fsPath)}" already exists.`);
		return;
	}

	const title = titleFromFileName(targetFile);
	const document = OntologyDiagramDocument.createEmpty(title);
	const content = stringifyOntologyDiagramYaml(document);

	await vscode.workspace.fs.writeFile(targetFile, new TextEncoder().encode(content));
	const textDocument = await vscode.workspace.openTextDocument(targetFile);
	await vscode.window.showTextDocument(textDocument);
}

async function resolveTargetFolder(resource?: vscode.Uri): Promise<vscode.Uri | undefined> {
	if (resource !== undefined) {
		return resource;
	}

	const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
	if (workspaceFolders.length === 1) {
		return workspaceFolders[0].uri;
	}

	if (workspaceFolders.length > 1) {
		const selected = await vscode.window.showWorkspaceFolderPick({
			placeHolder: 'Choose where to create the ontology diagram.',
		});

		return selected?.uri;
	}

	const selected = await vscode.window.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: 'Create Here',
		title: 'Choose Folder for New Ontology Diagram',
	});

	return selected?.[0];
}

function validateDiagramFileName(value: string): string | undefined {
	const trimmed = value.trim();
	if (trimmed.length === 0) {
		return 'Enter a file name.';
	}

	if (trimmed.includes('/') || trimmed.includes('\\')) {
		return 'Enter a file name without folders.';
	}

	if (path.basename(trimmed) !== trimmed) {
		return 'Enter a file name without folders.';
	}

	return undefined;
}

function ensureOntologyDiagramExtension(fileName: string): string {
	return path.extname(fileName) === '.odiagram' ? fileName : `${fileName}.odiagram`;
}

async function fileExists(uri: vscode.Uri): Promise<boolean> {
	try {
		await vscode.workspace.fs.stat(uri);
		return true;
	} catch (error) {
		if (error instanceof vscode.FileSystemError) {
			return false;
		}

		throw error;
	}
}

function titleFromFileName(uri: vscode.Uri): string {
	return path.basename(uri.fsPath, '.odiagram');
}
