import * as assert from 'assert';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
	DiagramEdge,
	DiagramMetadata,
	DiagramNode,
	Bounds,
	OntologyDiagramDocument,
	OntologyDiagramValidationError,
	OntologyFileReference,
	parseOntologyDiagramTextDocument,
	parseOntologyDiagramYaml,
	Point,
	readOntologyDiagramFile,
	stringifyOntologyDiagramYaml,
	writeOntologyDiagramFile,
} from '../documents/odiagram';

suite('OntologyDiagram model', () => {
	const validDiagramYaml = `
metadata:
  schema_version: "1.0"
  title: "Example"
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes:
  - id: "node_person"
    ontology_ref: "ex:Person"
    x: 10
    y: 20
    width: 160
    height: 80
edges: []
`;

	test('creates an empty diagram document with required sections', () => {
		const document = OntologyDiagramDocument.createEmpty('New diagram');
		const serialized = document.toPersistenceObject();

		assert.deepStrictEqual(serialized, {
			metadata: {
				schema_version: '1.0',
				title: 'New diagram',
				authors: [],
				diagram_version: '0.1.0',
			},
			ontologies: [],
			namespaces: {
				rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
			},
			nodes: [],
			edges: [],
		});
	});

	test('parses YAML and treats omitted optional element sections as empty lists', () => {
		const document = parseOntologyDiagramYaml(validDiagramYaml);

		assert.strictEqual(document.nodes.length, 1);
		assert.strictEqual(document.notes.length, 0);
		assert.strictEqual(document.images.length, 0);
		assert.strictEqual(document.labels.length, 0);
		assert.strictEqual(document.nodes[0].ontologyRef.value, 'ex:Person');
	});

	test('preserves unknown fields when serializing parsed YAML', () => {
		const document = parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Example"
  authors: []
  diagram_version: "0.1.0"
  owner: "team-a"
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes: []
edges: []
custom_section:
  enabled: true
`);

		const serialized = stringifyOntologyDiagramYaml(document);

		assert.match(serialized, /owner: team-a/);
		assert.match(serialized, /custom_section:/);
		assert.match(serialized, /enabled: true/);
	});

	test('rejects duplicate element identifiers', () => {
		assert.throws(
			() => new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Invalid'),
				[],
				new Map([['ex', 'https://example.com/ontology#']]),
				[
					new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
					new DiagramNode('node_person', 'ex:Person', new Bounds(120, 0, 100, 50)),
				],
				[],
			),
			OntologyDiagramValidationError,
		);
	});

	test('rejects edges that reference missing nodes', () => {
		assert.throws(
			() => new OntologyDiagramDocument(
				DiagramMetadata.createEmpty('Invalid'),
				[new OntologyFileReference('ontology.ttl')],
				new Map([['ex', 'https://example.com/ontology#']]),
				[new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50))],
				[
					new DiagramEdge(
						'edge_memberOf',
						'node_person',
						'node_org',
						'ex:memberOf',
						new Point(50, 20),
						[new Point(100, 25), new Point(200, 25)],
					),
				],
			),
			OntologyDiagramValidationError,
		);
	});

	test('reads a diagram document from a .odiagram file', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'odiagram-test-'));
		try {
			const filePath = path.join(directory, 'example.odiagram');
			await writeFile(filePath, validDiagramYaml, 'utf8');

			const document = await readOntologyDiagramFile(filePath);

			assert.strictEqual(document.metadata.title, 'Example');
			assert.strictEqual(document.nodes[0].id.value, 'node_person');
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('writes a diagram document to a .odiagram file', async () => {
		const directory = await mkdtemp(path.join(os.tmpdir(), 'odiagram-test-'));
		try {
			const filePath = path.join(directory, 'created.odiagram');
			await writeOntologyDiagramFile(filePath, OntologyDiagramDocument.createEmpty('Created diagram'));

			const content = await readFile(filePath, 'utf8');

			assert.match(content, /title: Created diagram/);
			assert.match(content, /rdfs: http:\/\/www\.w3\.org\/2000\/01\/rdf-schema#/);
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	});

	test('parses a VS Code-like text document', () => {
		const document = parseOntologyDiagramTextDocument({
			uri: {
				fsPath: '/workspace/example.odiagram',
			},
			getText: () => validDiagramYaml,
		});

		assert.strictEqual(document.metadata.title, 'Example');
	});

	test('rejects non-.odiagram file paths', async () => {
		await assert.rejects(
			() => readOntologyDiagramFile('/workspace/example.yml'),
			OntologyDiagramValidationError,
		);
	});

	test('accepts relative and data URI image sources', () => {
		const document = parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Example"
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes:
  - id: "node_person"
    ontology_ref: "ex:Person"
    x: 10
    y: 20
    width: 160
    height: 80
    image: "data:image/png;base64,iVBORw0KGgo="
edges: []
images:
  - id: "image_logo"
    x: 0
    y: 0
    width: 100
    height: 80
    source: "images/logo.png"
`);

		assert.strictEqual(document.nodes[0].image, 'data:image/png;base64,iVBORw0KGgo=');
		assert.strictEqual(document.images[0].source, 'images/logo.png');
	});

	test('rejects remote image sources', () => {
		assert.throws(
			() => parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Example"
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes: []
edges: []
images:
  - id: "image_logo"
    x: 0
    y: 0
    width: 100
    height: 80
    source: "https://example.com/logo.png"
`),
			OntologyDiagramValidationError,
		);
	});
});
