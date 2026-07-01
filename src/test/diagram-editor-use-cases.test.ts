import * as assert from 'assert';

import {
	Bounds,
	DiagramEdge,
	DiagramImage,
	DiagramLabel,
	DiagramMetadata,
	DiagramNode,
	DiagramNote,
	OntologyDiagramDocument,
	Point,
} from '../odiagram';
import { CreateEdgeUseCase, CreateImageUseCase, CreateLabelUseCase, CreateNodeUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteNodeUseCase, DeleteNoteUseCase, SaveDiagramExportUseCase, UpdateImageBoundsUseCase, UpdateImageSourceUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateNodeBoundsUseCase, UpdateNodeImageUseCase, UpdateNoteBoundsUseCase } from '../application/diagram-editor';
import type { DiagramExportSavePort } from '../application/diagram-editor';

suite('Diagram editor use cases', () => {
	test('creates a diagram node from a supported model-tree item', () => {
		const result = new CreateNodeUseCase().execute(
			emptyDiagram(),
			{
				ontologyItemType: 'class',
				ontologyItemReference: 'ex:Person',
				displayLabel: 'Person',
			},
			{ x: 10.4, y: 20.6 },
		);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 1);
		assert.strictEqual(result.diagram.nodes[0].id.value, 'node_item1');
		assert.strictEqual(result.diagram.nodes[0].ontologyRef.value, 'ex:Person');
		assert.deepStrictEqual(result.diagram.nodes[0].bounds.toPersistenceObject(), {
			x: 10,
			y: 21,
			width: 180,
			height: 72,
		});
		assert.deepStrictEqual(result.diagram.nodes[0].extra, {
			ontology_item_type: 'class',
		});
	});

	test('reports duplicate model-tree nodes without changing the diagram', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
		]);

		const result = new CreateNodeUseCase().execute(
			diagram,
			{
				ontologyItemType: 'class',
				ontologyItemReference: 'ex:Person',
				displayLabel: 'Person',
			},
			{ x: 0, y: 0 },
		);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, '"Person" already has a node in this diagram.');
	});

	test('deletes a node and its connected edges from the diagram', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_group', 'ex:Group', new Bounds(200, 0, 100, 50)),
				new DiagramNode('node_role', 'ex:Role', new Bounds(400, 0, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_memberOf',
					'node_person',
					'node_group',
					'ex:memberOf',
					new Point(150, 25),
					[new Point(100, 25), new Point(200, 25)],
				),
				new DiagramEdge(
					'edge_hasRole',
					'node_group',
					'node_role',
					'ex:hasRole',
					new Point(350, 25),
					[new Point(300, 25), new Point(400, 25)],
				),
			],
		);

		const result = new DeleteNodeUseCase().execute(diagram, 'node_group');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.id.value), ['node_person', 'node_role']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.id.value), []);
	});

	test('does not change the diagram when deleting a missing node', () => {
		const result = new DeleteNodeUseCase().execute(emptyDiagram(), 'node_missing');

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, undefined);
	});

	test('updates node bounds and keeps connected edge endpoints on node boundaries', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 0, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(150, 25),
					[new Point(100, 25), new Point(200, 25)],
				),
			],
		);

		const result = new UpdateNodeBoundsUseCase().execute(diagram, [
			{ id: 'node_source', x: 50, y: 0, width: 100, height: 50 },
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes[0].bounds.toPersistenceObject(), {
			x: 50,
			y: 0,
			width: 100,
			height: 50,
		});
		assert.deepStrictEqual(result.diagram.edges[0].points[0].toPersistenceObject(), {
			x: 150,
			y: 25,
		});
	});

	test('reports invalid note sizes without changing the diagram', () => {
		const result = new UpdateNoteBoundsUseCase().execute(emptyDiagram(), [
			{ id: 'note_item1', x: 0, y: 0, width: 100, height: 64 },
		]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Notes must be at least 120 x 64.');
	});

	test('materializes object property edges with missing endpoint nodes', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:memberOf',
			displayLabel: 'memberOf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Organization'],
			},
		}, { x: 400, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Person', 'ex:Organization']);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_item1');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_item2');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'ex:memberOf');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 320, y: 156 },
			{ x: 480, y: 156 },
		]);
	});

	test('materializes same-source-target property edges as self loops', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:knowsSelf',
			displayLabel: 'knowsSelf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Person'],
			},
		}, { x: 400, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 1);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_item1');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_item1');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 490, y: 145 },
			{ x: 571, y: 145 },
			{ x: 571, y: 248 },
			{ x: 427, y: 192 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 579,
			y: 185,
		});
	});

	test('materializes subclass edges between existing nodes', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(360, 20, 180, 72)),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person -> Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_agent');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'rdfs:subClassOf');
	});

	test('reports duplicate materialized edges without changing the diagram', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(360, 20, 180, 72)),
			],
			[
				new DiagramEdge(
					'edge_item1',
					'node_person',
					'node_agent',
					'rdfs:subClassOf',
					new Point(275, 56),
					[new Point(190, 56), new Point(360, 56)],
				),
			],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person -> Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, '"Person -> Agent" already has an edge in this diagram.');
	});

	test('reports ambiguous edge endpoint metadata without changing the diagram', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:ambiguous',
			displayLabel: 'ambiguous',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person', 'ex:Organization'],
				rangeReferences: ['ex:Role'],
			},
		}, { x: 200, y: 20 });

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Edge creation needs exactly one source and one target ontology item.');
	});

	test('updates and removes node image sources', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
		]);

		const updated = new UpdateNodeImageUseCase().execute(diagram, 'node_person', 'data:image/png;base64,aW1hZ2U=');
		assert.ok(updated.diagram);
		assert.strictEqual(updated.diagram.nodes[0].image, 'data:image/png;base64,aW1hZ2U=');

		const removed = new UpdateNodeImageUseCase().execute(updated.diagram, 'node_person', '');
		assert.ok(removed.diagram);
		assert.strictEqual(removed.diagram.nodes[0].image, undefined);
	});

	test('creates a diagram image with persisted source and default bounds', () => {
		const result = new CreateImageUseCase().execute(
			emptyDiagram(),
			'data:image/png;base64,aW1hZ2U=',
			{ x: 25.4, y: 40.6 },
		);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.images.length, 1);
		assert.strictEqual(result.diagram.images[0].id.value, 'image_item1');
		assert.strictEqual(result.diagram.images[0].source, 'data:image/png;base64,aW1hZ2U=');
		assert.deepStrictEqual(result.diagram.images[0].bounds.toPersistenceObject(), {
			x: 25,
			y: 41,
			width: 240,
			height: 160,
		});
	});

	test('updates image bounds', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'images/logo.png'),
		]);

		const result = new UpdateImageBoundsUseCase().execute(diagram, [
			{ id: 'image_logo', x: 30.4, y: 50.6, width: 180.2, height: 120.8 },
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.images[0].bounds.toPersistenceObject(), {
			x: 30,
			y: 51,
			width: 180,
			height: 121,
		});
	});

	test('updates image source from property edits', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'images/logo.png'),
		]);

		const result = new UpdateImageSourceUseCase().execute(diagram, 'image_logo', 'data:image/png;base64,aW1hZ2U=');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.images[0].source, 'data:image/png;base64,aW1hZ2U=');
	});

	test('reports invalid image source property edits without changing the diagram', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'images/logo.png'),
		]);

		const result = new UpdateImageSourceUseCase().execute(diagram, 'image_logo', 'https://example.com/logo.png');

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Image source must be a relative file path or data image URI.');
	});

	test('reports invalid image sizes without changing the diagram', () => {
		const result = new UpdateImageBoundsUseCase().execute(emptyDiagram(), [
			{ id: 'image_logo', x: 0, y: 0, width: 31, height: 32 },
		]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Images must be at least 32 x 32.');
	});

	test('deletes an image from the diagram', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'images/logo.png'),
			new DiagramImage('image_banner', new Bounds(40, 50, 120, 90), 'images/banner.png'),
		]);

		const result = new DeleteImageUseCase().execute(diagram, 'image_logo');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.images.map((image) => image.id.value), ['image_banner']);
	});

	test('deletes a note from the diagram', () => {
		const diagram = diagramWithNotes([
			new DiagramNote('note_first', new Bounds(10, 20, 100, 80), 'First'),
			new DiagramNote('note_second', new Bounds(40, 50, 120, 90), 'Second'),
		]);

		const result = new DeleteNoteUseCase().execute(diagram, 'note_first');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.notes.map((note) => note.id.value), ['note_second']);
	});

	test('creates a diagram label with persisted text and default bounds', () => {
		const result = new CreateLabelUseCase().execute(
			emptyDiagram(),
			'Core model',
			{ x: 12.4, y: 24.6 },
		);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.labels.length, 1);
		assert.strictEqual(result.diagram.labels[0].id.value, 'label_item1');
		assert.strictEqual(result.diagram.labels[0].text, 'Core model');
		assert.deepStrictEqual(result.diagram.labels[0].bounds.toPersistenceObject(), {
			x: 12,
			y: 25,
			width: 180,
			height: 40,
		});
	});

	test('updates label bounds', () => {
		const diagram = diagramWithLabels([
			new DiagramLabel('label_title', new Bounds(10, 20, 100, 40), 'Title'),
		]);

		const result = new UpdateLabelBoundsUseCase().execute(diagram, [
			{ id: 'label_title', x: 30.4, y: 50.6, width: 180.2, height: 42.8 },
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.labels[0].bounds.toPersistenceObject(), {
			x: 30,
			y: 51,
			width: 180,
			height: 43,
		});
	});

	test('reports invalid label sizes without changing the diagram', () => {
		const result = new UpdateLabelBoundsUseCase().execute(emptyDiagram(), [
			{ id: 'label_title', x: 0, y: 0, width: 47, height: 24 },
		]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Labels must be at least 48 x 24.');
	});

	test('updates label text', () => {
		const diagram = diagramWithLabels([
			new DiagramLabel('label_title', new Bounds(10, 20, 100, 40), 'Old'),
		]);

		const result = new UpdateLabelTextUseCase().execute(diagram, 'label_title', 'New');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.labels[0].text, 'New');
	});

	test('deletes a label from the diagram', () => {
		const diagram = diagramWithLabels([
			new DiagramLabel('label_first', new Bounds(10, 20, 100, 40), 'First'),
			new DiagramLabel('label_second', new Bounds(40, 50, 120, 40), 'Second'),
		]);

		const result = new DeleteLabelUseCase().execute(diagram, 'label_first');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.labels.map((label) => label.id.value), ['label_second']);
	});

	test('saves UTF-8 diagram exports through the export save port', async () => {
		const savePort = new RecordingDiagramExportSavePort('/workspace/example.svg');

		const result = await new SaveDiagramExportUseCase(savePort).execute({
			format: 'svg',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			content: '<svg></svg>',
			encoding: 'utf8',
		});

		assert.deepStrictEqual(savePort.targetRequests, [{
			format: 'svg',
			extension: 'svg',
			formatLabel: 'SVG image',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			saveLabel: 'Save SVG',
			title: 'Save diagram as SVG',
		}]);
		assert.strictEqual(savePort.writes.length, 1);
		assert.strictEqual(savePort.writes[0].targetPath, '/workspace/example.svg');
		assert.strictEqual(Buffer.from(savePort.writes[0].content).toString('utf8'), '<svg></svg>');
		assert.strictEqual(result.notification, 'Saved diagram export to /workspace/example.svg.');
	});

	test('does not write diagram exports when the save target is cancelled', async () => {
		const savePort = new RecordingDiagramExportSavePort(undefined);

		const result = await new SaveDiagramExportUseCase(savePort).execute({
			format: 'svg',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.svg',
			content: '<svg></svg>',
			encoding: 'utf8',
		});

		assert.strictEqual(savePort.writes.length, 0);
		assert.strictEqual(result.notification, undefined);
	});

	test('decodes base64 diagram exports before writing', async () => {
		const savePort = new RecordingDiagramExportSavePort('/workspace/example.png');

		await new SaveDiagramExportUseCase(savePort).execute({
			format: 'png',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.png',
			content: 'AAECAw==',
			encoding: 'base64',
		});

		assert.deepStrictEqual([...savePort.writes[0].content], [0, 1, 2, 3]);
		assert.deepStrictEqual(savePort.targetRequests[0], {
			format: 'png',
			extension: 'png',
			formatLabel: 'PNG image',
			defaultDirectory: '/workspace',
			defaultFileName: 'example.png',
			saveLabel: 'Save PNG',
			title: 'Save diagram as PNG',
		});
	});
});

class RecordingDiagramExportSavePort implements DiagramExportSavePort {
	public readonly targetRequests: Parameters<DiagramExportSavePort['chooseTarget']>[0][] = [];
	public readonly writes: { readonly targetPath: string; readonly content: Uint8Array }[] = [];

	public constructor(private readonly targetPath: string | undefined) {}

	public chooseTarget(request: Parameters<DiagramExportSavePort['chooseTarget']>[0]): Promise<string | undefined> {
		this.targetRequests.push(request);
		return Promise.resolve(this.targetPath);
	}

	public writeFile(targetPath: string, content: Uint8Array): Promise<void> {
		this.writes.push({ targetPath, content });
		return Promise.resolve();
	}
}

function emptyDiagram(): OntologyDiagramDocument {
	return diagramWithNodes([]);
}

function diagramWithNodes(nodes: readonly DiagramNode[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		nodes,
		[],
	);
}

function diagramWithImages(images: readonly DiagramImage[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		[],
		images,
	);
}

function diagramWithNotes(notes: readonly DiagramNote[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		notes,
	);
}

function diagramWithLabels(labels: readonly DiagramLabel[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		[],
		[],
		labels,
	);
}
