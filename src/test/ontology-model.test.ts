import * as assert from 'assert';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { DiagramMetadata, OntologyDiagramDocument, OntologyFileReference } from '../documents/odiagram';
import { loadReferencedOntologies } from '../ui/model-tree/ontology-model';

suite('Ontology model', () => {
	test('loads rdfs comments into ontology item metadata', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-comments-'));
		try {
			const ontologyPath = path.join(directory, 'model.ttl');
			await writeFile(ontologyPath, `
@prefix ex: <https://example.com/ontology#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Requirement a owl:Class ;
  rdfs:label "Requirement" ;
  rdfs:comment "A requirement captured from a stakeholder." .

ex:identifier a owl:DatatypeProperty ;
  rdfs:domain ex:Requirement ;
  rdfs:range rdfs:Literal ;
  rdfs:comment "Stable requirement identifier." .
`);
			const diagram = new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Example'),
				[new OntologyFileReference('model.ttl')],
				new Map([
					['ex', 'https://example.com/ontology#'],
					['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
				]),
				[],
				[],
			);

			const [ontology] = await loadReferencedOntologies(path.join(directory, 'diagram.odiagram'), diagram);

			const requirement = ontology?.items.find((item) => item.reference === 'ex:Requirement');
			const identifier = ontology?.items.find((item) => item.reference === 'ex:identifier');
			assert.deepStrictEqual(requirement?.metadata.comments, ['A requirement captured from a stakeholder.']);
			assert.deepStrictEqual(identifier?.metadata.comments, ['Stable requirement identifier.']);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('uses local names for unlabeled class IRI display labels', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-class-labels-'));
		try {
			const ontologyPath = path.join(directory, 'model.ttl');
			await writeFile(ontologyPath, `
@prefix owl: <http://www.w3.org/2002/07/owl#> .

<https://example.com/ontology#Requirement> a owl:Class .
`);
			const diagram = new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Example'),
				[new OntologyFileReference('model.ttl')],
				new Map(),
				[],
				[],
			);

			const [ontology] = await loadReferencedOntologies(path.join(directory, 'diagram.odiagram'), diagram);

			const requirement = ontology?.items.find((item) => item.type === 'class');
			assert.strictEqual(requirement?.displayLabel, 'Requirement');
			assert.strictEqual(requirement?.reference, 'https://example.com/ontology#Requirement');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('labels subclass relationships with endpoint names and subclass glyph', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-subclass-labels-'));
		try {
			const ontologyPath = path.join(directory, 'model.ttl');
			await writeFile(ontologyPath, `
@prefix ex: <https://example.com/ontology#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:Requirement rdfs:subClassOf ex:Domain .

ex:Requirement a owl:Class ;
  rdfs:label "Requirement" .

ex:Domain a owl:Class ;
  rdfs:label "Domain" .
`);
			const diagram = new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Example'),
				[new OntologyFileReference('model.ttl')],
				new Map([
					['ex', 'https://example.com/ontology#'],
					['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
				]),
				[],
				[],
			);

			const [ontology] = await loadReferencedOntologies(path.join(directory, 'diagram.odiagram'), diagram);

			const relationship = ontology?.items.find((item) => item.type === 'subclassRelationship');
			assert.strictEqual(relationship?.displayLabel, 'Requirement ⊑ Domain');
			assert.strictEqual(relationship?.reference, 'rdfs:subClassOf');
			assert.strictEqual(relationship?.metadata.subclassReference, 'ex:Requirement');
			assert.strictEqual(relationship?.metadata.superclassReference, 'ex:Domain');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
