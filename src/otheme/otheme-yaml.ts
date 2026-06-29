import YAML from 'yaml';

import { JsonObject } from '../odiagram';
import { OntologyDiagramTheme, OntologyDiagramThemeValidationError, parseOntologyDiagramThemeObject } from './otheme-document';

export function parseOntologyDiagramThemeYaml(content: string): OntologyDiagramTheme {
	const parsed = YAML.parse(content);
	if (!isRecord(parsed)) {
		throw new OntologyDiagramThemeValidationError('.otheme YAML root must be a mapping.');
	}

	return parseOntologyDiagramThemeObject(parsed);
}

export function stringifyOntologyDiagramThemeYaml(theme: OntologyDiagramTheme): string {
	return YAML.stringify(theme.toPersistenceObject());
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
