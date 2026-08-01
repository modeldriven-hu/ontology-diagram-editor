import type { ModelTreeItemDraggedEvent, ModelTreeNode, ModelTreeSelectionEvent, OntologyItemTreeNode } from './model-tree-types';

export function selectionPayloadForNode(node: ModelTreeNode): ModelTreeSelectionEvent {
	if (node.kind === 'ontologyFile') {
		return {
			nodeKind: node.kind,
			displayLabel: node.label,
			ontologyFilePath: node.ontology.relativePath,
		};
	}

	if (node.kind === 'ontologyGroup') {
		return {
			nodeKind: node.kind,
			displayLabel: node.label,
			ontologyFilePath: node.ontology.relativePath,
			ontologyItemType: node.itemType,
		};
	}

	if (node.kind === 'ontologyItem') {
		return {
			nodeKind: node.kind,
			displayLabel: node.item.displayLabel,
			ontologyFilePath: node.ontology.relativePath,
			ontologyItemType: node.item.type,
			ontologyItemReference: node.item.reference,
			ontologyItemMetadata: node.item.metadata,
		};
	}

	return {
		nodeKind: node.kind,
		displayLabel: node.label,
	};
}

export function dragPayloadForItemNode(node: OntologyItemTreeNode): ModelTreeItemDraggedEvent {
	return {
		sourceOntologyFilePath: node.ontology.relativePath,
		ontologyItemType: node.item.type,
		ontologyItemReference: node.item.reference,
		displayLabel: node.item.displayLabel,
		ontologyItemMetadata: node.item.metadata,
	};
}


