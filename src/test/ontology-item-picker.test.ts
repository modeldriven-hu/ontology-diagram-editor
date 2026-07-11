import * as assert from 'assert';

import { Bounds, DiagramEdge, DiagramMetadata, DiagramNode, OntologyDiagramDocument, Point } from '../documents/odiagram';
import { availableOntologyItemPickerEntries, ontologyItemPickerEntries } from '../diagram-editor/ontology-item-picker';
import type { LoadedOntology, OntologyItem } from '../ui/model-tree/ontology-model';

suite('Ontology item picker', () => {
	test('creates searchable entries for node and relationship items', () => {
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [
				ontologyItem('objectProperty', 'ex:memberOf', 'member of', {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				}),
				ontologyItem('annotationProperty', 'ex:reviewNote', 'review note'),
				ontologyItem('class', 'ex:Person', 'Person', {
					iri: 'https://example.com/ontology#Person',
				}),
				ontologyItem('datatype', 'xsd:string', 'string'),
			],
		};

		const entries = ontologyItemPickerEntries([ontology]);

		assert.deepStrictEqual(entries.map((entry) => entry.label), ['member of', 'Person', 'string']);
		assert.strictEqual(entries[0].description, 'Object properties');
		assert.strictEqual(entries[0].detail, 'ex:memberOf — model.ttl');
		assert.deepStrictEqual(entries[0].payload.ontologyItemMetadata, {
			displayLabels: [],
			domainReferences: ['ex:Person'],
			rangeReferences: ['ex:Organization'],
		});
		assert.strictEqual(entries[1].detail, 'ex:Person · https://example.com/ontology#Person — model.ttl');
	});

	test('distinguishes equal labels by reference and ontology file', () => {
		const entries = ontologyItemPickerEntries([
			{
				relativePath: 'first.ttl',
				absolutePath: '/workspace/first.ttl',
				items: [ontologyItem('class', 'first:Thing', 'Thing')],
			},
			{
				relativePath: 'second.ttl',
				absolutePath: '/workspace/second.ttl',
				items: [ontologyItem('class', 'second:Thing', 'Thing')],
			},
		]);

		assert.deepStrictEqual(entries.map((entry) => entry.detail), [
			'first:Thing — first.ttl',
			'second:Thing — second.ttl',
		]);
	});

	test('omits nodes and concrete relationships already on the diagram', () => {
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [
				ontologyItem('class', 'ex:Person', 'Person'),
				ontologyItem('class', 'ex:Role', 'Role'),
				ontologyItem('objectProperty', 'ex:memberOf', 'member of', {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				}),
				ontologyItem('objectProperty', 'ex:worksWith', 'works with', {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				}),
			],
		};
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_person', 'https://example.com/ontology#Person', new Bounds(0, 0, 160, 80)),
				new DiagramNode('node_organization', 'ex:Organization', new Bounds(300, 0, 160, 80)),
			],
			[
				new DiagramEdge(
					'edge_memberOf',
					'node_person',
					'node_organization',
					'ex:memberOf',
					new Point(230, 40),
					[new Point(160, 40), new Point(300, 40)],
				),
			],
		);

		const entries = availableOntologyItemPickerEntries([ontology], diagram);

		assert.deepStrictEqual(entries.map((entry) => entry.label), ['Role', 'works with']);
	});
});

function ontologyItem(
	type: OntologyItem['type'],
	reference: string,
	displayLabel: string,
	metadata: Omit<OntologyItem['metadata'], 'displayLabels'> = {},
): OntologyItem {
	return { type, reference, displayLabel, sourceOntologyPath: 'model.ttl', metadata: { displayLabels: [], ...metadata } };
}
