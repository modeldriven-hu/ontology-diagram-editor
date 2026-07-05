import * as assert from 'assert';

import type { OntologyItem } from '../ui/model-tree/ontology-model';
import { findOntologySourceRange } from '../ui/model-tree/ontology-source-navigation';

suite('Ontology source navigation', () => {
	test('finds a compact IRI subject before a matching display label', () => {
		const text = `
@prefix ex: <https://example.com/ontology#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Requirement a owl:Class ;
  rdfs:label "Requirement" .
`;

		const range = findOntologySourceRange(text, ontologyItem({
			reference: 'ex:Requirement',
			displayLabel: 'Requirement',
			iri: 'https://example.com/ontology#Requirement',
		}));

		assert.ok(range);
		assert.strictEqual(text.slice(range.startOffset, range.endOffset), 'ex:Requirement');
	});

	test('finds a full IRI in RDF/XML-style attributes', () => {
		const text = `
<rdf:RDF>
  <owl:Class rdf:about="https://example.com/ontology#Requirement">
    <rdfs:label>Requirement</rdfs:label>
  </owl:Class>
</rdf:RDF>
`;

		const range = findOntologySourceRange(text, ontologyItem({
			reference: 'ex:Requirement',
			displayLabel: 'Requirement',
			iri: 'https://example.com/ontology#Requirement',
		}));

		assert.ok(range);
		assert.strictEqual(text.slice(range.startOffset, range.endOffset), 'https://example.com/ontology#Requirement');
	});

	test('falls back to a bounded local name', () => {
		const text = `
<rdf:RDF>
  <owl:Class rdf:ID="Requirement">
    <rdfs:label>Requirement</rdfs:label>
  </owl:Class>
</rdf:RDF>
`;

		const range = findOntologySourceRange(text, ontologyItem({
			reference: 'ex:Requirement',
			displayLabel: 'Requirement',
			iri: 'https://example.com/ontology#Requirement',
		}));

		assert.ok(range);
		assert.strictEqual(text.slice(range.startOffset, range.endOffset), 'Requirement');
	});

	test('uses the subclass endpoint for subclass relationship source lookup', () => {
		const text = `
@prefix ex: <https://example.com/ontology#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Child rdfs:subClassOf ex:Parent .
`;

		const range = findOntologySourceRange(text, {
			type: 'subclassRelationship',
			reference: 'rdfs:subClassOf',
			displayLabel: 'Child -> Parent',
			sourceOntologyPath: 'model.ttl',
			metadata: {
				displayLabels: [],
				relationshipReference: 'rdfs:subClassOf',
				subclassReference: 'ex:Child',
				superclassReference: 'ex:Parent',
			},
		});

		assert.ok(range);
		assert.strictEqual(text.slice(range.startOffset, range.endOffset), 'ex:Child');
	});
});

function ontologyItem(options: {
	readonly reference: string;
	readonly displayLabel: string;
	readonly iri: string;
}): OntologyItem {
	return {
		type: 'class',
		reference: options.reference,
		displayLabel: options.displayLabel,
		sourceOntologyPath: 'model.ttl',
		metadata: {
			iri: options.iri,
			displayLabels: [options.displayLabel],
		},
	};
}
