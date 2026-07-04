import type { DiagramPayload } from '../ontology-diagram-types';

export function ontologyCommentsForReference(ontologyRef: string, payload: DiagramPayload): readonly string[] {
	const namespaces = payload.diagram?.namespaces ?? {};

	return (payload.ontology?.comments ?? [])
		.filter((entry) => ontologyReferencesEqual(entry.reference, ontologyRef, namespaces))
		.flatMap((entry) => entry.comments)
		.filter((comment) => comment.trim().length > 0);
}

function ontologyReferencesEqual(left: string, right: string, namespaces: Readonly<Record<string, string>>): boolean {
	if (left === right) {
		return true;
	}

	return expandedOntologyReference(left, namespaces) === expandedOntologyReference(right, namespaces);
}

function expandedOntologyReference(value: string, namespaces: Readonly<Record<string, string>>): string {
	if (value.includes('://')) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0) {
		return value;
	}

	const namespace = namespaces[value.slice(0, separatorIndex)];
	return namespace === undefined ? value : `${namespace}${value.slice(separatorIndex + 1)}`;
}
