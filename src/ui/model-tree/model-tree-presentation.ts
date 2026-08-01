import { getOntologyItemTypeLabel, type LoadedOntology, type OntologyItem } from './ontology-model';
import type { OntologyItemTreeNode } from './model-tree-types';
import { ontologyReferencesEqual } from './ontology-reference';

export function ontologyItemDescription(
	item: OntologyItem,
	label: string,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string | undefined {
	if (item.type === 'subclassRelationship') {
		return undefined;
	}

	if (item.type === 'class') {
		return undefined;
	}

	if (item.type === 'objectProperty' || item.type === 'dataProperty') {
		return endpointTupleDescription(item, ontology, namespaces);
	}

	if (item.type === 'objectPropertyAssertion') {
		return assertionTupleDescription(item, ontology, namespaces);
	}

	if (item.type === 'individual') {
		return endpointDisplayNames(item.metadata.assertedClassReferences, ontology, namespaces);
	}

	return item.reference === label ? undefined : item.reference;
}

export function ontologyItemTooltip(node: OntologyItemTreeNode, namespaces: ReadonlyMap<string, string>): string {
	return [
		node.item.displayLabel,
		`Reference: ${node.item.reference}`,
		`Source file: ${node.ontology.relativePath}`,
		`Type: ${getOntologyItemTypeLabel(node.item.type)}`,
		...ontologyItemEndpointTooltipLines(node.item, node.ontology, namespaces),
	].join('\n');
}

export function endpointTupleDescription(item: OntologyItem, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string | undefined {
	const domain = endpointDisplayNames(item.metadata.domainReferences, ontology, namespaces);
	const range = endpointDisplayNames(item.metadata.rangeReferences, ontology, namespaces);
	if (domain === undefined && range === undefined) {
		return undefined;
	}

	return `(${domain ?? '?'}, ${range ?? '?'})`;
}

export function ontologyItemEndpointTooltipLines(
	item: OntologyItem,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	if (item.type === 'class') {
		return endpointTooltipLines('Superclass', item.metadata.superclassReferences, ontology, namespaces);
	}

	if (item.type === 'objectProperty' || item.type === 'dataProperty' || item.type === 'annotationProperty') {
		return [
			...endpointTooltipLines('Domain', item.metadata.domainReferences, ontology, namespaces),
			...endpointTooltipLines('Range', item.metadata.rangeReferences, ontology, namespaces),
		];
	}

	if (item.type === 'subclassRelationship') {
		return [
			...endpointTooltipLines('Subclass', optionalReference(item.metadata.subclassReference), ontology, namespaces),
			...endpointTooltipLines('Superclass', optionalReference(item.metadata.superclassReference), ontology, namespaces),
		];
	}

	if (item.type === 'objectPropertyAssertion') {
		return [
			...endpointTooltipLines('Source', optionalReference(item.metadata.sourceOntologyRef), ontology, namespaces),
			...endpointTooltipLines('Target', optionalReference(item.metadata.targetOntologyRef), ontology, namespaces),
		];
	}

	return [];
}

export function assertionTupleDescription(item: OntologyItem, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string | undefined {
	const source = endpointDisplayNames(optionalReference(item.metadata.sourceOntologyRef), ontology, namespaces);
	const target = endpointDisplayNames(optionalReference(item.metadata.targetOntologyRef), ontology, namespaces);
	if (source === undefined && target === undefined) {
		return undefined;
	}

	return `(${source ?? '?'}, ${target ?? '?'})`;
}

export function endpointTooltipLines(
	label: string,
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	const values = endpointReferenceTexts(references, ontology, namespaces);
	return values.length === 0 ? [] : [`${label}: ${values.join(', ')}`];
}

export function endpointDisplayNames(
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string | undefined {
	const values = uniqueStrings((references ?? []).map((reference) => ontologyReferenceDisplayName(reference, ontology, namespaces)));
	return values.length === 0 ? undefined : values.join(' | ');
}

export function endpointReferenceTexts(
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	return uniqueStrings((references ?? []).map((reference) => {
		const displayName = ontologyReferenceDisplayName(reference, ontology, namespaces);
		return displayName === reference ? reference : `${displayName} (${reference})`;
	}));
}

export function ontologyReferenceDisplayName(reference: string, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string {
	const item = ontology.items.find((candidate) => ontologyReferencesEqual(candidate.reference, reference, namespaces));
	return item?.displayLabel ?? localOntologyReferenceName(reference);
}

export function localOntologyReferenceName(reference: string): string {
	const separatorIndex = Math.max(reference.lastIndexOf('#'), reference.lastIndexOf('/'), reference.lastIndexOf(':'));
	const name = separatorIndex >= 0 ? reference.slice(separatorIndex + 1) : reference;
	return name.length === 0 ? reference : name;
}

export function optionalReference(reference: string | undefined): readonly string[] | undefined {
	return reference === undefined ? undefined : [reference];
}

export function uniqueStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
}


