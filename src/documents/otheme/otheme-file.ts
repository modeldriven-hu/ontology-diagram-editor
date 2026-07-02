import * as path from 'path';
import { readFile, writeFile } from 'fs/promises';

import { OntologyDiagramTheme, OntologyDiagramThemeValidationError } from './otheme-document';
import { parseOntologyDiagramThemeYaml, stringifyOntologyDiagramThemeYaml } from './otheme-yaml';

export interface OntologyDiagramThemeTextDocument {
	readonly fileName?: string;
	readonly uri?: {
		readonly fsPath?: string;
	};
	getText(): string;
}

export async function readOntologyDiagramThemeFile(filePath: string): Promise<OntologyDiagramTheme> {
	assertOntologyDiagramThemeFilePath(filePath);
	const content = await readFile(filePath, 'utf8');
	return parseOntologyDiagramThemeYaml(content);
}

export async function writeOntologyDiagramThemeFile(filePath: string, theme: OntologyDiagramTheme): Promise<void> {
	assertOntologyDiagramThemeFilePath(filePath);
	await writeFile(filePath, stringifyOntologyDiagramThemeYaml(theme), 'utf8');
}

export function parseOntologyDiagramThemeTextDocument(document: OntologyDiagramThemeTextDocument): OntologyDiagramTheme {
	const filePath = document.uri?.fsPath ?? document.fileName;
	if (filePath !== undefined) {
		assertOntologyDiagramThemeFilePath(filePath);
	}

	return parseOntologyDiagramThemeYaml(document.getText());
}

export function assertOntologyDiagramThemeFilePath(filePath: string): void {
	const extension = path.extname(filePath);
	if (extension !== '.yml' && extension !== '.yaml') {
		throw new OntologyDiagramThemeValidationError(`Expected a .yml or .yaml theme file path, got "${filePath}".`);
	}
}
