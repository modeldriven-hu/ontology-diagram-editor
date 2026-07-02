import * as path from 'path';
import * as vscode from 'vscode';

import { ontologyDiagramEditorViewType } from './ontology-diagram-editor-provider';
import { OntologyDiagramDocument, ontologyDiagramFileExtension, stringifyOntologyDiagramYaml } from '../documents/odiagram';

const defaultDiagramFileName = `new-diagram${ontologyDiagramFileExtension}`;

export class CreateOntologyDiagramCommand {
	public static readonly id = 'ontology-diagram-editor.createOntologyDiagram';

	public register(context: vscode.ExtensionContext): void {
		context.subscriptions.push(vscode.commands.registerCommand(CreateOntologyDiagramCommand.id, async (resource?: vscode.Uri) => {
			await this.execute(resource);
		}));
	}

	public async execute(resource?: vscode.Uri): Promise<void> {
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
		await vscode.commands.executeCommand('vscode.openWith', targetFile, ontologyDiagramEditorViewType);
	}
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
	return path.extname(fileName) === ontologyDiagramFileExtension ? fileName : `${fileName}${ontologyDiagramFileExtension}`;
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
	return path.basename(uri.fsPath, ontologyDiagramFileExtension);
}
