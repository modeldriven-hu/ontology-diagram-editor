import type { OntologyDiagramDocument } from '../../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';
import { isAddableOntologyItem, isOntologyItemMaterialized } from '../../diagram-editor/ontology-item-materialization';
import type { OntologyItem } from './ontology-model';

export function unmaterializedOntologyItemPayloads(
	items: readonly OntologyItem[],
	diagram: OntologyDiagramDocument,
): readonly ModelTreeItemDropPayload[] {
	return items
		.filter((item) => isAddableOntologyItem(item) && !isOntologyItemMaterialized(item, diagram))
		.map((item) => ({
			sourceOntologyFilePath: item.sourceOntologyPath,
			ontologyItemType: item.type,
			ontologyItemReference: item.reference,
			displayLabel: item.displayLabel,
			ontologyItemMetadata: item.metadata,
		}));
}
