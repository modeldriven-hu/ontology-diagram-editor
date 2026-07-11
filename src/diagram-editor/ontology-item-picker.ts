import type { OntologyDiagramDocument } from '../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../shared/webview-commands';
import { getOntologyItemTypeLabel, type LoadedOntology, type OntologyItem } from '../ui/model-tree/ontology-model';
import { isConnectionCapableOntologyItem, ontologyReferencesEqual, resolveEdgeEndpoints } from './use-cases/ontology-edge-endpoints';

export interface OntologyItemPickerEntry {
	readonly label: string;
	readonly description: string;
	readonly detail: string;
	readonly payload: ModelTreeItemDropPayload;
}

export function ontologyItemPickerEntries(loadedOntologies: readonly LoadedOntology[]): readonly OntologyItemPickerEntry[] {
	return loadedOntologies
		.flatMap((ontology) => ontology.items
			.filter((item) => isNodeCapableOntologyItem(item.type) || isConnectionCapableOntologyItem(item.type))
			.map((item) => pickerEntry(ontology, item)))
		.sort((left, right) => left.label.localeCompare(right.label)
			|| left.description.localeCompare(right.description)
			|| left.detail.localeCompare(right.detail));
}

export function availableOntologyItemPickerEntries(
	loadedOntologies: readonly LoadedOntology[],
	diagram: OntologyDiagramDocument,
): readonly OntologyItemPickerEntry[] {
	return ontologyItemPickerEntries(loadedOntologies).filter((entry) => !isMaterialized(entry.payload, diagram));
}

function isMaterialized(payload: ModelTreeItemDropPayload, diagram: OntologyDiagramDocument): boolean {
	if (!isConnectionCapableOntologyItem(payload.ontologyItemType)) {
		return diagram.nodes.some((node) => ontologyReferencesEqual(
			node.ontologyRef.value,
			payload.ontologyItemReference,
			diagram.namespaces,
		));
	}

	const endpoints = resolveEdgeEndpoints(payload);
	if (endpoints === undefined || endpoints === 'ambiguous') {
		return false;
	}

	const sourceNodes = diagram.nodes.filter((node) => ontologyReferencesEqual(node.ontologyRef.value, endpoints.sourceOntologyRef, diagram.namespaces));
	const targetNodes = diagram.nodes.filter((node) => ontologyReferencesEqual(node.ontologyRef.value, endpoints.targetOntologyRef, diagram.namespaces));
	if (sourceNodes.length !== 1 || targetNodes.length !== 1) {
		return false;
	}

	return diagram.edges.some((edge) => edge.source.value === sourceNodes[0].id.value
		&& edge.target.value === targetNodes[0].id.value
		&& ontologyReferencesEqual(edge.ontologyRef.value, endpoints.edgeOntologyRef, diagram.namespaces));
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

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}
