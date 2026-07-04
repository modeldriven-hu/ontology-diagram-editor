import * as vscode from 'vscode';

import { parseOntologyDiagramTextDocument, stringifyOntologyDiagramYaml } from '../documents/odiagram';
import type { OntologyDiagramDocument } from '../documents/odiagram';

export class DiagramDocumentRepository {
	public constructor(private readonly document: vscode.TextDocument) {}

	public get uri(): vscode.Uri {
		return this.document.uri;
	}

	public load(): OntologyDiagramDocument {
		return parseOntologyDiagramTextDocument(this.document);
	}

	public async save(diagram: OntologyDiagramDocument): Promise<void> {
		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(this.document.positionAt(0), this.document.positionAt(this.document.getText().length));
		edit.replace(this.document.uri, fullRange, stringifyOntologyDiagramYaml(diagram));
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			throw new Error('Could not update diagram document.');
		}

		await this.document.save();
	}

	public async saveCurrentDocument(): Promise<void> {
		if (this.document.isDirty) {
			await this.document.save();
		}
	}
}
