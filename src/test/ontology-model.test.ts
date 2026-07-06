import * as assert from 'assert';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import { DiagramMetadata, OntologyDiagramDocument, OntologyFileReference } from '../documents/odiagram';
import { findOntologyImportPaths, loadReferencedOntologies } from '../ui/model-tree/ontology-model';

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

	test('loads named subjects with shorthand and explicit class assertions as individuals', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-class-assertions-'));
		try {
			const schemaPath = path.join(directory, 'requirements.ttl');
			const instancesPath = path.join(directory, 'requirements-instances.ttl');
			await writeFile(schemaPath, `
@prefix req: <https://example.com/requirements#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

req:Requirement a owl:Class .

req:FunctionalRequirement a owl:Class ;
  rdfs:subClassOf req:Requirement .

req:id a owl:DatatypeProperty ;
  rdfs:label "id" .

req:title a owl:DatatypeProperty ;
  rdfs:label "title" .

req:relatedTo a owl:ObjectProperty ;
  rdfs:label "related to" .

req:conflictsWith a owl:ObjectProperty, owl:SymmetricProperty .
`);
			await writeFile(instancesPath, `
@prefix ex: <https://example.com/requirements/instances#> .
@prefix req: <https://example.com/requirements#> .
@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:REQ-001 a req:FunctionalRequirement ;
  req:id "REQ-001" ;
  req:title "User Authentication" ;
  req:relatedTo ex:REQ-002 ;
  rdfs:label "User Authentication" .

ex:REQ-002 rdf:type req:FunctionalRequirement ;
  rdfs:label "Password Reset" .
`);
			const diagram = new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Example'),
				[
					new OntologyFileReference('requirements.ttl'),
					new OntologyFileReference('requirements-instances.ttl'),
				],
				new Map([
					['ex', 'https://example.com/requirements/instances#'],
					['req', 'https://example.com/requirements#'],
				]),
				[],
				[],
			);

			const [schemaOntology, instancesOntology] = await loadReferencedOntologies(path.join(directory, 'diagram.odiagram'), diagram);

			const schemaIndividuals = schemaOntology?.items.filter((item) => item.type === 'individual') ?? [];
			const requirements = new Map((instancesOntology?.items.filter((item) => item.type === 'individual') ?? [])
				.map((item) => [item.reference, item]));
			const objectPropertyAssertions = instancesOntology?.items.filter((item) => item.type === 'objectPropertyAssertion') ?? [];
			const shorthandRequirement = requirements.get('ex:REQ-001');
			const explicitTypeRequirement = requirements.get('ex:REQ-002');
			assert.deepStrictEqual(schemaIndividuals, []);
			assert.strictEqual(requirements.size, 2);
			assert.strictEqual(shorthandRequirement?.displayLabel, 'User Authentication');
			assert.deepStrictEqual(shorthandRequirement?.metadata.assertedClassReferences, ['https://example.com/requirements#FunctionalRequirement']);
			assert.deepStrictEqual(shorthandRequirement?.metadata.propertyAssertions?.map((assertion) => ({
				propertyReference: assertion.propertyReference,
				value: assertion.value,
				valueType: assertion.valueType,
			})), [
				{
					propertyReference: 'https://example.com/requirements#id',
					value: 'REQ-001',
					valueType: 'literal',
				},
				{
					propertyReference: 'https://example.com/requirements#title',
					value: 'User Authentication',
					valueType: 'literal',
				},
				{
					propertyReference: 'https://example.com/requirements#relatedTo',
					value: 'https://example.com/requirements/instances#REQ-002',
					valueType: 'resource',
				},
			]);
			assert.strictEqual(explicitTypeRequirement?.displayLabel, 'Password Reset');
			assert.deepStrictEqual(explicitTypeRequirement?.metadata.assertedClassReferences, ['https://example.com/requirements#FunctionalRequirement']);
			assert.strictEqual(objectPropertyAssertions.length, 1);
			assert.strictEqual(objectPropertyAssertions[0].reference, 'req:relatedTo');
			assert.strictEqual(objectPropertyAssertions[0].displayLabel, 'User Authentication relatedTo Password Reset');
			assert.deepStrictEqual(objectPropertyAssertions[0].metadata, {
				relationshipReference: 'req:relatedTo',
				displayLabels: [],
				edgeOntologyRef: 'req:relatedTo',
				sourceOntologyRef: 'ex:REQ-001',
				targetOntologyRef: 'ex:REQ-002',
				targetNodeType: 'individual',
			});
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

	test('loads untyped resource assertion subjects as object property assertions', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-untyped-assertions-'));
		try {
			const ontologyPath = path.join(directory, 'model.ttl');
			await writeFile(ontologyPath, `
@prefix ex: <https://fressnapf.de/ontology/example/requirements#> .
@prefix req: <https://fressnapf.de/ontology/requirements#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .

ex:AuthenticationService a owl:Class ;
  rdfs:label "Authentication Service" .

ex:REQ-002 req:appliesTo ex:AuthenticationService .
`);
			const diagram = new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Example'),
				[new OntologyFileReference('model.ttl')],
				new Map([
					['ex', 'https://fressnapf.de/ontology/example/requirements#'],
					['req', 'https://fressnapf.de/ontology/requirements#'],
				]),
				[],
				[],
			);

			const [ontology] = await loadReferencedOntologies(path.join(directory, 'diagram.odiagram'), diagram);

			const requirement = ontology?.items.find((item) => item.type === 'individual' && item.reference === 'ex:REQ-002');
			const assertion = ontology?.items.find((item) => item.type === 'objectPropertyAssertion');
			assert.strictEqual(requirement?.displayLabel, 'ex:REQ-002');
			assert.strictEqual(assertion?.reference, 'req:appliesTo');
			assert.strictEqual(assertion?.displayLabel, 'ex:REQ-002 appliesTo Authentication Service');
			assert.deepStrictEqual(assertion?.metadata, {
				relationshipReference: 'req:appliesTo',
				displayLabels: [],
				edgeOntologyRef: 'req:appliesTo',
				sourceOntologyRef: 'ex:REQ-002',
				targetOntologyRef: 'ex:AuthenticationService',
				targetNodeType: 'class',
			});
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('finds ontology imports from selected prefixes and candidate bases', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-import-bases-'));
		try {
			const foundationPath = path.join(directory, 'foundation.ttl');
			const domainPath = path.join(directory, 'domain.ttl');
			const selectedPath = path.join(directory, 'selected.ttl');
			const unrelatedPath = path.join(directory, 'unrelated.ttl');
			await writeFile(foundationPath, `
@base <https://example.com/foundation> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);
			await writeFile(domainPath, `
@base <https://example.com/domain> .
@prefix foundation: <https://example.com/foundation#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);
			await writeFile(selectedPath, `
@base <https://example.com/selected> .
@prefix domain: <https://example.com/domain#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);
			await writeFile(unrelatedPath, `
@base <https://example.com/unrelated> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);

			const imports = await findOntologyImportPaths(selectedPath, [
				selectedPath,
				unrelatedPath,
				domainPath,
				foundationPath,
			]);

			assert.deepStrictEqual(imports.map((ontologyPath) => path.basename(ontologyPath)), ['foundation.ttl', 'domain.ttl']);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('uses candidate prefixes as import identity when no base is declared', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-import-prefixes-'));
		try {
			const dependencyPath = path.join(directory, 'dependency.ttl');
			const selectedPath = path.join(directory, 'selected.ttl');
			await writeFile(dependencyPath, `
@prefix dep: <https://example.com/dependency#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);
			await writeFile(selectedPath, `
@base <https://example.com/selected> .
@prefix dep: <https://example.com/dependency#> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
`);

			const imports = await findOntologyImportPaths(selectedPath, [selectedPath, dependencyPath]);

			assert.deepStrictEqual(imports.map((ontologyPath) => path.basename(ontologyPath)), ['dependency.ttl']);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('ignores built-in namespace prefixes when finding ontology imports', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'ontology-import-builtins-'));
		try {
			const selectedPath = path.join(directory, 'selected.ttl');
			const builtInOnlyPath = path.join(directory, 'builtins.ttl');
			await writeFile(selectedPath, `
@base <https://example.com/selected> .
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`);
			await writeFile(builtInOnlyPath, `
@prefix owl: <http://www.w3.org/2002/07/owl#> .
@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> .
`);

			const imports = await findOntologyImportPaths(selectedPath, [selectedPath, builtInOnlyPath]);

			assert.deepStrictEqual(imports, []);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});
});
