import { isConnectionCapableOntologyItem } from './use-cases/ontology-edge-endpoints';
import type { ModelTreeItemDropPayload } from '../shared/webview-commands';
import type { LoadedOntology, OntologyItem } from '../ui/model-tree/ontology-model';

export function relationshipPayloads(loadedOntologies: readonly LoadedOntology[]): readonly ModelTreeItemDropPayload[] {
	return loadedOntologies.flatMap((ontology) =>
		ontology.items
			.filter((item) => isConnectionCapableOntologyItem(item.type))
			.map((item) => relationshipPayload(ontology, item)),
	);
}

function relationshipPayload(ontology: LoadedOntology, item: OntologyItem): ModelTreeItemDropPayload {
	return {
		sourceOntologyFilePath: ontology.relativePath,
		ontologyItemType: item.type,
		ontologyItemReference: item.reference,
		displayLabel: item.displayLabel,
		ontologyItemMetadata: item.metadata,
	};
}

