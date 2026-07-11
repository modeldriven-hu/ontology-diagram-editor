import * as assert from 'assert';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import * as os from 'os';
import * as path from 'path';

import {
	DiagramEdge,
	DiagramMetadata,
	DiagramMetadataElement,
	DiagramNode,
	DiagramNote,
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
		assert.strictEqual(document.metadataElements.length, 0);
		assert.strictEqual(document.nodes[0].ontologyRef.value, 'ex:Person');
	});

	test('parses and serializes diagram metadata elements with common styling', () => {
		const document = parseOntologyDiagramYaml(`${validDiagramYaml}\nmetadata_elements:\n  - id: metadata_info\n    x: 25\n    y: 35\n    width: 280\n    height: 108\n    style:\n      bg_color: \"#ffffff\"\n`);
		assert.strictEqual(document.metadataElements.length, 1);
		assert.ok(document.metadataElements[0] instanceof DiagramMetadataElement);
		assert.strictEqual(document.metadataElements[0].style?.bgColor, '#ffffff');
		const serialized = stringifyOntologyDiagramYaml(document);
		assert.match(serialized, /metadata_elements:/);
		assert.match(serialized, /id: metadata_info/);
	});

	test('parses and serializes node data property visibility', () => {
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
    show_data_properties: true
    show_type: false
    show_property_values: true
    property_value_text_overflow: wrap
edges: []
`);
		assert.strictEqual(document.nodes[0].showDataProperties, true);
		assert.strictEqual(document.nodes[0].showType, false);
		assert.strictEqual(document.nodes[0].showPropertyValues, true);
		assert.strictEqual(document.nodes[0].propertyValueTextOverflow, 'wrap');
		assert.match(stringifyOntologyDiagramYaml(document), /show_data_properties: true/);
		assert.match(stringifyOntologyDiagramYaml(document), /show_type: false/);
		assert.match(stringifyOntologyDiagramYaml(document), /show_property_values: true/);
		assert.match(stringifyOntologyDiagramYaml(document), /property_value_text_overflow: wrap/);
	});

	test('preserves persisted edge cardinality-label positions', () => {
		const document = parseOntologyDiagramYaml(validDiagramYaml.replace('edges: []', `edges:
  - id: edge_knows
    source: node_person
    target: node_person
    ontology_ref: ex:knows
    label: { x: 90, y: 80 }
    source_cardinality_label: { x: 35, y: 55 }
    target_cardinality_label: { x: 145, y: 55 }
    points: [{ x: 40, y: 60 }, { x: 140, y: 60 }]
`));

		assert.deepStrictEqual(document.edges[0].sourceCardinalityLabel?.toPersistenceObject(), { x: 35, y: 55 });
		assert.deepStrictEqual(document.edges[0].targetCardinalityLabel?.toPersistenceObject(), { x: 145, y: 55 });
		assert.match(stringifyOntologyDiagramYaml(document), /source_cardinality_label:/);
		assert.match(stringifyOntologyDiagramYaml(document), /target_cardinality_label:/);
	});

	test('parses and serializes note export visibility', () => {
		const document = parseOntologyDiagramYaml(`
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
notes:
  - id: "note_context"
    x: 10
    y: 20
    width: 160
    height: 80
    text: "Draft note"
    export: false
`);

		assert.strictEqual(document.notes[0].exported, false);
		assert.match(stringifyOntologyDiagramYaml(document), /export: false/);
	});

	test('parses and serializes note and image edge endpoints with route layout', () => {
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
    x: 200
    y: 20
    width: 160
    height: 80
notes:
  - id: "note_context"
    x: 10
    y: 20
    width: 160
    height: 80
    text: "Context"
images:
  - id: "image_logo"
    x: 400
    y: 20
    width: 64
    height: 64
    source: "data:image/png;base64,aW1hZ2U="
edges:
  - id: "edge_noteNode"
    source: "note_context"
    target: "node_person"
    ontology_ref: "https://ontology-diagram-editor.local/note-connection"
    label:
      x: 180
      y: 60
    points:
      - x: 170
        y: 60
      - x: 200
        y: 60
    style:
      line_style: dotted
    route_layout: orthogonal
  - id: "edge_noteImage"
    source: "note_context"
    target: "image_logo"
    ontology_ref: "https://ontology-diagram-editor.local/note-connection"
    label:
      x: 250
      y: 60
    points:
      - x: 170
        y: 60
      - x: 400
        y: 52
    route_layout: direct
`);

		assert.strictEqual(document.edges[0].source.value, 'note_context');
		assert.strictEqual(document.edges[0].target.value, 'node_person');
		assert.strictEqual(document.edges[0].style?.lineStyle, 'dotted');
		assert.strictEqual(document.edges[0].routeLayout, 'orthogonal');
		assert.strictEqual(document.edges[1].target.value, 'image_logo');
		assert.strictEqual(document.edges[1].routeLayout, 'direct');
		const serialized = stringifyOntologyDiagramYaml(document);
		assert.match(serialized, /source: note_context/);
		assert.match(serialized, /target: image_logo/);
		assert.match(serialized, /route_layout: direct/);
	});

	test('parses and serializes persisted theme mode metadata', () => {
		const document = parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Dark diagram"
  authors: []
  diagram_version: "0.1.0"
  theme_mode: dark
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes: []
edges: []
`);

		assert.strictEqual(document.metadata.themeMode, 'dark');
		const metadata = document.metadata.toPersistenceObject() as { readonly theme_mode?: unknown };
		assert.strictEqual(metadata.theme_mode, 'dark');
	});

	test('parses common style corner radius and shadow overrides', () => {
		const document = parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Styled"
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
    style:
      corner_radius: 12
      shadow: false
edges: []
`);

		assert.strictEqual(document.nodes[0].style?.cornerRadius, 12);
		assert.strictEqual(document.nodes[0].style?.shadow, false);
		assert.deepStrictEqual(document.nodes[0].style?.toPersistenceObject(), {
			corner_radius: 12,
			shadow: false,
		});
	});

	test('parses and serializes image border and shadow style overrides', () => {
		const document = parseOntologyDiagramYaml(`
metadata:
  schema_version: "1.0"
  title: "Styled image"
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces:
  ex: "https://example.com/ontology#"
nodes: []
edges: []
images:
  - id: "image_logo"
    x: 10
    y: 20
    width: 160
    height: 80
    source: "data:image/png;base64,aW1hZ2U="
    style:
      border:
        type: dashed
        weight: 2
        color: "#336699"
      shadow: true
`);

		assert.strictEqual(document.images[0].style?.border?.type, 'dashed');
		assert.strictEqual(document.images[0].style?.shadow, true);
		assert.deepStrictEqual(document.images[0].style?.toPersistenceObject(), {
			border: {
				type: 'dashed',
				weight: 2,
				color: '#336699',
			},
			shadow: true,
		});
		const serialized = stringifyOntologyDiagramYaml(document);
		assert.match(serialized, /style:/);
		assert.match(serialized, /border:/);
		assert.match(serialized, /type: dashed/);
		assert.match(serialized, /shadow: true/);
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

	test('rejects edges that reference missing elements', () => {
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
				[new DiagramNote('note_context', new Bounds(0, 0, 120, 64), 'Context')],
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

	test('accepts embedded data URI image sources', () => {
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
    source: "data:image/png;base64,aW1hZ2U="
`);

		assert.strictEqual(document.nodes[0].image, 'data:image/png;base64,iVBORw0KGgo=');
		assert.strictEqual(document.images[0].source, 'data:image/png;base64,aW1hZ2U=');
	});

	test('rejects relative and remote image sources', () => {
		for (const source of ['images/logo.png', 'https://example.com/logo.png']) {
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
    source: "${source}"
`),
				OntologyDiagramValidationError,
			);
		}
	});
});
