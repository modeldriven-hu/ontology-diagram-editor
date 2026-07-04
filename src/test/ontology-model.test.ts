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
});
