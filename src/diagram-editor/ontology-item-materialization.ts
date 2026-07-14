import type { OntologyDiagramDocument } from '../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../shared/webview-commands';
import type { OntologyItem } from '../ui/model-tree/ontology-model';
import { isConnectionCapableOntologyItem, ontologyReferencesEqual, resolveEdgeEndpoints } from './use-cases/ontology-edge-endpoints';

export function isAddableOntologyItem(item: OntologyItem): boolean {
	return isNodeCapableOntologyItem(item.type) || isConnectionCapableOntologyItem(item.type);
}

export function isOntologyItemMaterialized(item: OntologyItem, diagram: OntologyDiagramDocument): boolean {
	if (!isConnectionCapableOntologyItem(item.type)) {
		return diagram.nodes.some((node) => ontologyReferencesEqual(
			node.ontologyRef.value,
			item.reference,
			diagram.namespaces,
		));
	}

	const endpoints = resolveEdgeEndpoints(itemPayload(item));
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

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}

function itemPayload(item: OntologyItem): ModelTreeItemDropPayload {
	return {
		sourceOntologyFilePath: item.sourceOntologyPath,
		ontologyItemType: item.type,
		ontologyItemReference: item.reference,
		displayLabel: item.displayLabel,
		ontologyItemMetadata: item.metadata,
	};
}
