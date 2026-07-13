import type { DiagramAnnotationValue, DiagramPayload } from '../ontology-diagram-types';

export interface OntologyAnnotationField {
	readonly label: string;
	readonly value: string;
}

export function ontologyAnnotationFieldsForReference(ontologyRef: string, payload: DiagramPayload): readonly OntologyAnnotationField[] {
	const namespaces = payload.diagram?.namespaces ?? {};

	return (payload.ontology?.annotations ?? [])
		.filter((entry) => ontologyReferencesEqual(entry.reference, ontologyRef, namespaces))
		.flatMap((entry) => entry.annotations)
		.filter((annotation) => annotation.value.trim().length > 0)
		.map((annotation) => ({
			label: annotationLabel(annotation, payload, namespaces),
			value: annotation.value,
		}));
}

function annotationLabel(
	annotation: DiagramAnnotationValue,
	payload: DiagramPayload,
	namespaces: Readonly<Record<string, string>>,
): string {
	const property = ontologyItemDisplayName(annotation.propertyReference, payload, namespaces)
		?? wellKnownAnnotationName(annotation.propertyReference)
		?? compactOntologyReference(annotation.propertyReference, namespaces);
	return annotation.language === undefined ? property : `${property} (${annotation.language})`;
}

function ontologyItemDisplayName(
	reference: string,
	payload: DiagramPayload,
	namespaces: Readonly<Record<string, string>>,
): string | undefined {
	return payload.ontology?.items?.find((item) =>
		ontologyReferencesEqual(item.reference, reference, namespaces),
	)?.displayLabel;
}

function wellKnownAnnotationName(reference: string): string | undefined {
	if (reference === 'http://www.w3.org/2000/01/rdf-schema#label') {
		return 'rdfs:label';
	}
	if (reference === 'http://www.w3.org/2000/01/rdf-schema#comment') {
		return 'rdfs:comment';
	}

	return undefined;
}

function compactOntologyReference(reference: string, namespaces: Readonly<Record<string, string>>): string {
	const namespace = Object.entries(namespaces)
		.find(([, iri]) => reference.startsWith(iri));
	return namespace === undefined ? reference : `${namespace[0]}:${reference.slice(namespace[1].length)}`;
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
