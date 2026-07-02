import YAML from 'yaml';

import { JsonObject, OntologyDiagramDocument, OntologyDiagramValidationError, parseOntologyDiagramObject } from './odiagram-document';

export function parseOntologyDiagramYaml(content: string): OntologyDiagramDocument {
	const parsed = YAML.parse(content);
	if (!isRecord(parsed)) {
		throw new OntologyDiagramValidationError('.odiagram YAML root must be a mapping.');
	}

	return parseOntologyDiagramObject(parsed);
}

export function stringifyOntologyDiagramYaml(document: OntologyDiagramDocument): string {
	return YAML.stringify(document.toPersistenceObject());
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}
