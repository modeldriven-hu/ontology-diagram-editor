import type { DiagramPayload } from '../ontology-diagram-types';
import { ontologyDisplayName, ontologyReferencesEqual } from './node-data-properties';

export function edgeDisplayName(ontologyRef: string, payload?: DiagramPayload): string {
	if (payload !== undefined) {
		const namespaces = payload.diagram?.namespaces ?? {};
		const item = (payload.ontology?.items ?? []).find((candidate) =>
			candidate.type !== 'subclassRelationship'
			&& candidate.type !== 'objectPropertyAssertion'
			&& ontologyReferencesEqual(candidate.reference, ontologyRef, namespaces)
			&& candidate.displayLabel.trim().length > 0
			&& candidate.displayLabel !== candidate.reference);
		if (item !== undefined) {
			return item.displayLabel;
		}
	}

	return ontologyDisplayName(ontologyRef);
}
