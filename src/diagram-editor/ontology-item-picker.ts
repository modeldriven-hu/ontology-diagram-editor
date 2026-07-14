import type { OntologyDiagramDocument } from '../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../shared/webview-commands';
import { getOntologyItemTypeLabel, type LoadedOntology, type OntologyItem, type OntologyItemType } from '../ui/model-tree/ontology-model';
import { isAddableOntologyItem, isOntologyItemMaterialized } from './ontology-item-materialization';

export interface OntologyItemPickerEntry {
	readonly label: string;
	readonly description: string;
	readonly detail: string;
	readonly payload: ModelTreeItemDropPayload;
}

export interface OntologyItemPickerGroup {
	readonly label: string;
	readonly entries: readonly OntologyItemPickerEntry[];
}

const ontologyItemPickerTypeOrder: readonly OntologyItemType[] = [
	'class',
	'individual',
	'datatype',
	'objectProperty',
	'dataProperty',
	'subclassRelationship',
	'objectPropertyAssertion',
];

export function ontologyItemPickerEntries(loadedOntologies: readonly LoadedOntology[]): readonly OntologyItemPickerEntry[] {
	return loadedOntologies
		.flatMap((ontology) => ontology.items
			.filter(isAddableOntologyItem)
			.map((item) => pickerEntry(ontology, item)))
		.sort((left, right) => left.label.localeCompare(right.label)
			|| left.description.localeCompare(right.description)
			|| left.detail.localeCompare(right.detail));
}

export function availableOntologyItemPickerEntries(
	loadedOntologies: readonly LoadedOntology[],
	diagram: OntologyDiagramDocument,
): readonly OntologyItemPickerEntry[] {
	return loadedOntologies
		.flatMap((ontology) => ontology.items
			.filter((item) => isAddableOntologyItem(item) && !isOntologyItemMaterialized(item, diagram))
			.map((item) => pickerEntry(ontology, item)))
		.sort((left, right) => left.label.localeCompare(right.label)
			|| left.description.localeCompare(right.description)
			|| left.detail.localeCompare(right.detail));
}

export function ontologyItemPickerGroups(entries: readonly OntologyItemPickerEntry[]): readonly OntologyItemPickerGroup[] {
	return ontologyItemPickerTypeOrder.flatMap((type) => {
		const groupedEntries = entries.filter((entry) => entry.payload.ontologyItemType === type);
		return groupedEntries.length === 0 ? [] : [{
			label: getOntologyItemTypeLabel(type),
			entries: groupedEntries,
		}];
	});
}

function pickerEntry(ontology: LoadedOntology, item: OntologyItem): OntologyItemPickerEntry {
	return {
		label: item.displayLabel,
		description: getOntologyItemTypeLabel(item.type),
		detail: `${searchableReference(item)} — ${ontology.relativePath}`,
		payload: {
			sourceOntologyFilePath: ontology.relativePath,
			ontologyItemType: item.type,
			ontologyItemReference: item.reference,
			displayLabel: item.displayLabel,
			ontologyItemMetadata: item.metadata,
		},
	};
}

function searchableReference(item: OntologyItem): string {
	const fullIri = item.metadata.iri;
	return fullIri === undefined || fullIri === item.reference
		? item.reference
		: `${item.reference} · ${fullIri}`;
}
