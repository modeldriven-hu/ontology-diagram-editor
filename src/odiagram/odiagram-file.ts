import * as path from 'path';
import { readFile, writeFile } from 'fs/promises';

import { OntologyDiagramDocument, OntologyDiagramValidationError } from './odiagram-document';
import { parseOntologyDiagramYaml, stringifyOntologyDiagramYaml } from './odiagram-yaml';

export interface OntologyDiagramTextDocument {
	readonly fileName?: string;
	readonly uri?: {
		readonly fsPath?: string;
	};
	getText(): string;
}

export async function readOntologyDiagramFile(filePath: string): Promise<OntologyDiagramDocument> {
	assertOntologyDiagramFilePath(filePath);
	const content = await readFile(filePath, 'utf8');
	return parseOntologyDiagramYaml(content);
}

export async function writeOntologyDiagramFile(filePath: string, document: OntologyDiagramDocument): Promise<void> {
	assertOntologyDiagramFilePath(filePath);
	await writeFile(filePath, stringifyOntologyDiagramYaml(document), 'utf8');
}

export function parseOntologyDiagramTextDocument(document: OntologyDiagramTextDocument): OntologyDiagramDocument {
	const filePath = document.uri?.fsPath ?? document.fileName;
	if (filePath !== undefined) {
		assertOntologyDiagramFilePath(filePath);
	}

	return parseOntologyDiagramYaml(document.getText());
}

export function assertOntologyDiagramFilePath(filePath: string): void {
	if (path.extname(filePath) !== '.odiagram') {
		throw new OntologyDiagramValidationError(`Expected a .odiagram file path, got "${filePath}".`);
	}
}
