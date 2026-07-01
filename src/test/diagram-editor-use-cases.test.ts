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
import { CreateImageUseCase, CreateLabelUseCase, CreateNodeUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteNoteUseCase, UpdateImageBoundsUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateNodeBoundsUseCase, UpdateNoteBoundsUseCase } from '../application/diagram-editor';

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
});

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
