import * as assert from 'assert';

import { Bounds, DiagramMetadata, DiagramNode, OntologyDiagramDocument } from '../documents/odiagram';
import { unmaterializedOntologyItemPayloads } from '../ui/model-tree/model-tree-add-to-diagram';
import type { OntologyItem } from '../ui/model-tree/ontology-model';

suite('Model tree add all to diagram', () => {
	test('returns only addable ontology items not already materialized', () => {
		const person = ontologyItem('class', 'ex:Person', 'Person');
		const organization = ontologyItem('class', 'ex:Organization', 'Organization');
		const memberOf = ontologyItem('objectProperty', 'ex:memberOf', 'member of', {
			domainReferences: ['ex:Person'],
			rangeReferences: ['ex:Organization'],
		});
		const note = ontologyItem('annotationProperty', 'ex:note', 'note');
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', person.reference, new Bounds(0, 0, 160, 80))],
			[],
		);

		const payloads = unmaterializedOntologyItemPayloads([person, organization, memberOf, note], diagram);

		assert.deepStrictEqual(payloads.map((payload) => payload.ontologyItemReference), ['ex:Organization', 'ex:memberOf']);
		assert.strictEqual(payloads[0].sourceOntologyFilePath, 'model.ttl');
		assert.deepStrictEqual(payloads[1].ontologyItemMetadata, memberOf.metadata);
	});
});

function ontologyItem(
	type: OntologyItem['type'],
	reference: string,
	displayLabel: string,
	metadata: Partial<OntologyItem['metadata']> = {},
): OntologyItem {
	return {
		type,
		reference,
		displayLabel,
		sourceOntologyPath: 'model.ttl',
		metadata: {
			displayLabels: [displayLabel],
			...metadata,
		},
	};
}
