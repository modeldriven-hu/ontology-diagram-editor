import * as assert from 'assert';

import {
	Bounds,
	DiagramEdge,
	DiagramImage,
	DiagramLabel,
	DiagramMetadata,
	DiagramNode,
	DiagramNote,
	FontStyle,
	LabelStyle,
	OntologyDiagramDocument,
	Point,
} from '../documents/odiagram';
import { AlignSubclassEndpointsUseCase, ArrangeDiagramUseCase, CreateCommentNoteUseCase, CreateEdgeUseCase, CreateImageUseCase, CreateLabelUseCase, CreateNodeUseCase, CreateNoteConnectionUseCase, DeleteEdgeUseCase, DeleteElementsUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteNodeUseCase, DeleteNoteUseCase, OptimizeEdgeRouteUseCase, SaveDiagramExportUseCase, ShowRelatedElementsUseCase, UpdateEdgeRouteUseCase, UpdateEdgeRouteLayoutUseCase, UpdateElementBoundsUseCase, UpdateElementStyleUseCase, UpdateImageBoundsUseCase, UpdateImageSourceUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateNodeBoundsUseCase, UpdateNodeDataPropertiesVisibilityUseCase, UpdateNodeImageUseCase, UpdateNoteBoundsUseCase, UpdateNoteExportVisibilityUseCase, UpdateThemeModeUseCase } from '../diagram-editor/use-cases';
import type { DiagramExportSavePort } from '../diagram-editor/use-cases';

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

	test('creates a dotted note connection to a node', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', 'ex:Person', new Bounds(240, 0, 100, 50))],
			[],
			[new DiagramNote('note_context', new Bounds(0, 0, 140, 80), 'Context')],
		);

		const result = new CreateNoteConnectionUseCase().execute(diagram, 'note_context', 'node_person');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.notes.length, 1);
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'note_context');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].style?.lineStyle, 'dotted');
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'orthogonal');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'noteConnection');
	});

	test('creates a connected note from a node comment', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(100, 100, 160, 80)),
		]);

		const result = new CreateCommentNoteUseCase().execute(
			diagram,
			'node_person',
			'A person represented in the ontology.',
		);

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.notes.length, 1);
		assert.strictEqual(result.diagram.notes[0].text, 'A person represented in the ontology.');
		assert.strictEqual(result.diagram.notes[0].id.value, 'note_item1');
		assert.deepStrictEqual(result.diagram.notes[0].bounds.toPersistenceObject(), {
			x: 288,
			y: 100,
			width: 294,
			height: 64,
		});
		assert.strictEqual(result.diagram.edges.length, 1);
		assert.strictEqual(result.diagram.edges[0].source.value, 'note_item1');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].style?.lineStyle, 'dotted');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'noteConnection');
	});

	test('places node comment notes without overlapping occupied elements', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', 'ex:Person', new Bounds(100, 100, 160, 80))],
			[],
			[
				new DiagramNote('note_item1', new Bounds(288, 100, 220, 120), 'Existing right note'),
				new DiagramNote('note_item2', new Bounds(0, 100, 72, 120), 'Existing left note'),
			],
		);

		const result = new CreateCommentNoteUseCase().execute(diagram, 'node_person', 'Ontology comment.');

		assert.ok(result.diagram);
		const createdNote = result.diagram.notes.find((note) => note.id.value === 'note_item3');
		assert.ok(createdNote);
		assert.deepStrictEqual(createdNote.bounds.toPersistenceObject(), {
			x: 100,
			y: 208,
			width: 148,
			height: 64,
		});
		assert.strictEqual(overlaps(createdNote.bounds, diagram.nodes[0].bounds), false);
		assert.strictEqual(overlaps(createdNote.bounds, diagram.notes[0].bounds), false);
		assert.strictEqual(overlaps(createdNote.bounds, diagram.notes[1].bounds), false);
	});

	test('deleting an opposing node removes only the note connection edge', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', 'ex:Person', new Bounds(240, 0, 100, 50))],
			[
				new DiagramEdge(
					'edge_noteConnection',
					'note_context',
					'node_person',
					'https://ontology-diagram-editor.local/note-connection',
					new Point(190, 40),
					[new Point(140, 40), new Point(240, 25)],
				),
			],
			[new DiagramNote('note_context', new Bounds(0, 0, 140, 80), 'Context')],
		);

		const result = new DeleteNodeUseCase().execute(diagram, 'node_person');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes, []);
		assert.deepStrictEqual(result.diagram.edges, []);
		assert.deepStrictEqual(result.diagram.notes.map((note) => note.id.value), ['note_context']);
	});

	test('deletes an edge from the diagram', () => {
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

		const result = new DeleteEdgeUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.id.value), ['node_source', 'node_target']);
		assert.deepStrictEqual(result.diagram.edges, []);
	});

	test('deletes multiple elements and their connected edges from the diagram', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_selected', 'ex:Selected', new Bounds(200, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(400, 0, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_selected',
					'node_source',
					'node_target',
					'ex:selected',
					new Point(250, 25),
					[new Point(100, 25), new Point(400, 25)],
				),
				new DiagramEdge(
					'edge_connected',
					'node_selected',
					'node_target',
					'ex:connected',
					new Point(350, 25),
					[new Point(300, 25), new Point(400, 25)],
				),
				new DiagramEdge(
					'edge_keep',
					'node_source',
					'node_target',
					'ex:keep',
					new Point(250, 40),
					[new Point(100, 40), new Point(400, 40)],
				),
			],
			[
				new DiagramNote('note_selected', new Bounds(10, 80, 120, 80), 'Selected'),
				new DiagramNote('note_keep', new Bounds(150, 80, 120, 80), 'Keep'),
			],
			[
				new DiagramImage('image_selected', new Bounds(10, 180, 100, 80), 'images/logo.png'),
			],
			[
				new DiagramLabel('label_selected', new Bounds(10, 280, 100, 40), 'Selected'),
				new DiagramLabel('label_keep', new Bounds(150, 280, 100, 40), 'Keep'),
			],
		);

		const result = new DeleteElementsUseCase().execute(diagram, [
			'node_selected',
			'edge_selected',
			'note_selected',
			'image_selected',
			'label_selected',
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.id.value), ['node_source', 'node_target']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.id.value), ['edge_keep']);
		assert.deepStrictEqual(result.diagram.notes.map((note) => note.id.value), ['note_keep']);
		assert.deepStrictEqual(result.diagram.images, []);
		assert.deepStrictEqual(result.diagram.labels.map((label) => label.id.value), ['label_keep']);
	});

	test('deletes a note connection edge without deleting either endpoint', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', 'ex:Person', new Bounds(240, 0, 100, 50))],
			[
				new DiagramEdge(
					'edge_noteConnection',
					'note_context',
					'node_person',
					'https://ontology-diagram-editor.local/note-connection',
					new Point(190, 40),
					[new Point(140, 40), new Point(240, 25)],
					undefined,
					{ ontology_item_type: 'noteConnection' },
				),
			],
			[new DiagramNote('note_context', new Bounds(0, 0, 140, 80), 'Context')],
		);

		const result = new DeleteEdgeUseCase().execute(diagram, 'edge_noteConnection');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges, []);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.id.value), ['node_person']);
		assert.deepStrictEqual(result.diagram.notes.map((note) => note.id.value), ['note_context']);
	});

	test('does not change the diagram when deleting a missing edge', () => {
		const result = new DeleteEdgeUseCase().execute(emptyDiagram(), 'edge_missing');

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

	test('updates note bounds and keeps connected edge endpoints on note boundaries', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_target', 'ex:Target', new Bounds(240, 0, 100, 50))],
			[
				new DiagramEdge(
					'edge_noteConnection',
					'note_context',
					'node_target',
					'https://ontology-diagram-editor.local/note-connection',
					new Point(190, 40),
					[new Point(140, 40), new Point(240, 25)],
				),
			],
			[new DiagramNote('note_context', new Bounds(0, 0, 140, 80), 'Context')],
		);

		const result = new UpdateNoteBoundsUseCase().execute(diagram, [
			{ id: 'note_context', x: 40, y: 0, width: 140, height: 80 },
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.notes[0].bounds.toPersistenceObject(), {
			x: 40,
			y: 0,
			width: 140,
			height: 80,
		});
		assert.deepStrictEqual(result.diagram.edges[0].points[0].toPersistenceObject(), {
			x: 180,
			y: 25,
		});
	});

	test('updates mixed element bounds as one diagram mutation', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50))],
			[
				new DiagramEdge(
					'edge_noteConnection',
					'node_source',
					'note_context',
					'https://ontology-diagram-editor.local/note-connection',
					new Point(150, 25),
					[new Point(100, 25), new Point(200, 25)],
				),
			],
			[new DiagramNote('note_context', new Bounds(200, 0, 120, 64), 'Context')],
			[new DiagramImage('image_logo', new Bounds(400, 0, 80, 40), 'images/logo.png')],
			[new DiagramLabel('label_caption', new Bounds(500, 0, 120, 30), 'Caption')],
		);

		const result = new UpdateElementBoundsUseCase().execute(diagram, {
			nodeUpdates: [{ id: 'node_source', x: 10, y: 20, width: 100, height: 50 }],
			noteUpdates: [{ id: 'note_context', x: 210, y: 20, width: 120, height: 64 }],
			imageUpdates: [{ id: 'image_logo', x: 410, y: 20, width: 80, height: 40 }],
			labelUpdates: [{ id: 'label_caption', x: 510, y: 20, width: 120, height: 30 }],
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes[0].bounds.toPersistenceObject(), {
			x: 10,
			y: 20,
			width: 100,
			height: 50,
		});
		assert.deepStrictEqual(result.diagram.notes[0].bounds.toPersistenceObject(), {
			x: 210,
			y: 20,
			width: 120,
			height: 64,
		});
		assert.deepStrictEqual(result.diagram.images[0].bounds.toPersistenceObject(), {
			x: 410,
			y: 20,
			width: 80,
			height: 40,
		});
		assert.deepStrictEqual(result.diagram.labels[0].bounds.toPersistenceObject(), {
			x: 510,
			y: 20,
			width: 120,
			height: 30,
		});
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 110, y: 45 },
			{ x: 210, y: 45 },
		]);
	});

	test('moves edge routes with endpoints during grouped element movement', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 0, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_relatedTo',
					'node_source',
					'node_target',
					'ex:relatedTo',
					new Point(180, 105),
					[
						new Point(100, 25),
						new Point(180, 120),
						new Point(300, 25),
					],
				),
			],
		);

		const result = new UpdateElementBoundsUseCase().execute(diagram, {
			nodeUpdates: [
				{ id: 'node_source', x: 20, y: 10, width: 100, height: 50 },
				{ id: 'node_target', x: 320, y: 10, width: 100, height: 50 },
			],
			noteUpdates: [],
			imageUpdates: [],
			labelUpdates: [],
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 120, y: 35 },
			{ x: 200, y: 130 },
			{ x: 320, y: 35 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 200,
			y: 115,
		});
	});

	test('creates note connections between vertically separated notes using the nearest sides', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[],
			[],
			[
				new DiagramNote('note_lower', new Bounds(125, 474, 340, 220), 'Lower note'),
				new DiagramNote('note_upper', new Bounds(25, 74, 440, 240), 'Upper note'),
			],
		);

		const result = new CreateNoteConnectionUseCase().execute(diagram, 'note_lower', 'note_upper');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 295, y: 474 },
			{ x: 295, y: 314 },
		]);
	});

	test('updates edge route layout without changing route points', () => {
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

		const result = new UpdateEdgeRouteLayoutUseCase().execute(diagram, 'edge_relates', 'direct');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 25 },
			{ x: 200, y: 25 },
		]);
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
			displayLabel: 'Person ⊑ Agent',
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

	test('aligns subclass edge endpoints on the shared superclass', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(180, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 0, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(80, 80),
					[new Point(50, 100), new Point(80, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_customerPerson',
					'node_customer',
					'node_person',
					'rdfs:subClassOf',
					new Point(200, 90),
					[new Point(230, 140), new Point(200, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_employee', 'node_customer']);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const employeeEdge = updatedEdges.get('edge_employeePerson');
		const customerEdge = updatedEdges.get('edge_customerPerson');
		assert.ok(employeeEdge);
		assert.ok(customerEdge);
		assert.deepStrictEqual(employeeEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 125 },
			{ x: 140, y: 100 },
			{ x: 140, y: 60 },
		]);
		assert.deepStrictEqual(customerEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 180, y: 165 },
			{ x: 140, y: 100 },
			{ x: 140, y: 60 },
		]);
	});

	test('aligns subclass endpoint to the middle of the nearest superclass side', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_constraint', 'ex:Constraint', new Bounds(64, 178, 360, 144)),
				new DiagramNode('node_rule', 'ex:Rule', new Bounds(536, 746, 120, 80)),
				new DiagramNode('node_requirement', 'ex:Requirement', new Bounds(780, 160, 360, 144)),
			],
			[
				new DiagramEdge(
					'edge_constraintRequirement',
					'node_constraint',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(540, 220),
					[new Point(424, 322), new Point(780, 250)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_ruleRequirement',
					'node_rule',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(540, 620),
					[new Point(656, 786), new Point(780, 250)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_constraint', 'node_rule']);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const constraintEdge = updatedEdges.get('edge_constraintRequirement');
		assert.ok(constraintEdge);
		const constraintPoints = constraintEdge.points.map((point) => point.toPersistenceObject());
		assert.deepStrictEqual(constraintPoints, [
			{ x: 424, y: 250 },
			{ x: 740, y: 232 },
			{ x: 780, y: 232 },
		]);
	});

	test('aligns each subclass source to the side facing the shared superclass endpoint', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_constraint', 'ex:Constraint', new Bounds(153, 511, 238, 95)),
				new DiagramNode('node_functionalRequirement', 'ex:FunctionalRequirement', new Bounds(483, 511, 237, 95)),
				new DiagramNode('node_qualityRequirement', 'ex:QualityRequirement', new Bounds(812, 511, 238, 95)),
				new DiagramNode('node_requirement', 'ex:Requirement', new Bounds(575, 103, 238, 95)),
			],
			[
				new DiagramEdge(
					'edge_constraintRequirement',
					'node_constraint',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(430, 340),
					[new Point(391, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_functionalRequirementRequirement',
					'node_functionalRequirement',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(520, 340),
					[new Point(720, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_qualityRequirementRequirement',
					'node_qualityRequirement',
					'node_requirement',
					'rdfs:subClassOf',
					new Point(820, 340),
					[new Point(812, 558), new Point(694, 198)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, [
			'node_constraint',
			'node_functionalRequirement',
			'node_qualityRequirement',
		]);

		assert.strictEqual(result.notification, undefined);
		assert.ok(result.diagram);
		const updatedEdges = new Map(result.diagram.edges.map((edge) => [edge.id.value, edge] as const));
		const constraintEdge = updatedEdges.get('edge_constraintRequirement');
		const functionalRequirementEdge = updatedEdges.get('edge_functionalRequirementRequirement');
		const qualityRequirementEdge = updatedEdges.get('edge_qualityRequirementRequirement');
		assert.ok(constraintEdge);
		assert.ok(functionalRequirementEdge);
		assert.ok(qualityRequirementEdge);
		assert.deepStrictEqual(constraintEdge.points[0].toPersistenceObject(), { x: 391, y: 559 });
		assert.deepStrictEqual(functionalRequirementEdge.points[0].toPersistenceObject(), { x: 602, y: 511 });
		assert.deepStrictEqual(qualityRequirementEdge.points[0].toPersistenceObject(), { x: 812, y: 559 });
		assert.deepStrictEqual(functionalRequirementEdge.points[functionalRequirementEdge.points.length - 1].toPersistenceObject(), { x: 694, y: 198 });
	});

	test('does not align subclass endpoints without one shared superclass', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(180, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 0, 120, 60)),
				new DiagramNode('node_agent', 'ex:Agent', new Bounds(260, 0, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(80, 80),
					[new Point(50, 100), new Point(80, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
				new DiagramEdge(
					'edge_customerAgent',
					'node_customer',
					'node_agent',
					'rdfs:subClassOf',
					new Point(260, 90),
					[new Point(230, 140), new Point(260, 30)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
				),
			],
		);

		const result = new AlignSubclassEndpointsUseCase().execute(diagram, ['node_employee', 'node_customer']);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Selected nodes do not share the same superclass edge.');
	});

	test('adds the rdfs namespace when materializing subclass edges', () => {
		const result = new CreateEdgeUseCase().execute(emptyDiagram(), {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.namespaces.get('rdfs'), 'http://www.w3.org/2000/01/rdf-schema#');
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'rdfs:subClassOf');
	});

	test('matches subclass endpoints by equivalent compact and full ontology references', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_person', 'https://example.com/ontology#Person', new Bounds(10, 20, 180, 72)),
				new DiagramNode('node_agent', 'https://example.com/ontology#Agent', new Bounds(360, 20, 180, 72)),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'subclassRelationship',
			ontologyItemReference: 'rdfs:subClassOf',
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_person');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_agent');
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
			displayLabel: 'Person ⊑ Agent',
			ontologyItemMetadata: {
				subclassReference: 'ex:Person',
				superclassReference: 'ex:Agent',
			},
		}, { x: 200, y: 20 });

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, '"Person ⊑ Agent" already has an edge in this diagram.');
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

	test('shows directly related ontology elements for a selected node', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(300, 200, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 1, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'subclassRelationship',
				ontologyItemReference: 'rdfs:subClassOf',
				displayLabel: 'Employee ⊑ Person',
				ontologyItemMetadata: {
					subclassReference: 'ex:Employee',
					superclassReference: 'ex:Person',
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, 'Added 2 related nodes and 2 edges.');
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value).sort(), ['ex:Employee', 'ex:Organization', 'ex:Person']);
		const employeeNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Employee');
		const organizationNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Organization');
		assert.ok(employeeNode);
		assert.ok(organizationNode);
		const subclassEdge = result.diagram.edges.find((edge) => edge.ontologyRef.value === 'rdfs:subClassOf');
		const propertyEdge = result.diagram.edges.find((edge) => edge.ontologyRef.value === 'ex:memberOf');
		assert.ok(subclassEdge);
		assert.ok(propertyEdge);
		assert.strictEqual(subclassEdge.source.value, employeeNode.id.value);
		assert.strictEqual(subclassEdge.target.value, 'node_person');
		assert.strictEqual(propertyEdge.source.value, 'node_person');
		assert.strictEqual(propertyEdge.target.value, organizationNode.id.value);
		assert.strictEqual(result.diagram.namespaces.get('rdfs'), 'http://www.w3.org/2000/01/rdf-schema#');
	});

	test('skips data properties when showing related ontology elements', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(300, 200, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 1, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'dataProperty',
				ontologyItemReference: 'ex:identifier',
				displayLabel: 'identifier',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['rdfs:Literal'],
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, 'Added 1 related node and 1 edge.');
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value).sort(), ['ex:Organization', 'ex:Person']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.ontologyRef.value), ['ex:memberOf']);
	});

	test('shows related ontology elements to the selected depth', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(100, 100, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_person', 2, [
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:memberOf',
				displayLabel: 'memberOf',
				ontologyItemMetadata: {
					domainReferences: ['ex:Person'],
					rangeReferences: ['ex:Organization'],
				},
			},
			{
				ontologyItemType: 'objectProperty',
				ontologyItemReference: 'ex:hasRole',
				displayLabel: 'hasRole',
				ontologyItemMetadata: {
					domainReferences: ['ex:Organization'],
					rangeReferences: ['ex:Role'],
				},
			},
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Person', 'ex:Organization', 'ex:Role']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.ontologyRef.value).sort(), ['ex:hasRole', 'ex:memberOf']);
		const roleNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:Role');
		assert.ok(roleNode);
		assert.strictEqual(roleNode.bounds.x > diagram.nodes[0].bounds.x, true);
	});

	test('updates edge source and target anchor points', () => {
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

		const result = new UpdateEdgeRouteUseCase().execute(diagram, [{
			id: 'edge_relates',
			points: [
				{ x: 30, y: 49 },
				{ x: 240, y: 2 },
			],
			label: { x: 130, y: 12 },
		}]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 30, y: 50 },
			{ x: 240, y: 0 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 130,
			y: 12,
		});
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_source');
		assert.strictEqual(result.diagram.edges[0].target.value, 'node_target');
	});

	test('optimizes stale edge routes from current endpoint bounds', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 100, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 50 },
			{ x: 150, y: 50 },
			{ x: 150, y: 100 },
			{ x: 200, y: 100 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 150,
			y: 75,
		});
	});

	test('optimizes router-backed edge layouts by clearing intermediate points', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 100, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(0, 0), new Point(125, 300), new Point(1, 1)],
					undefined,
					{},
					'manhattan',
				),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 50 },
			{ x: 200, y: 100 },
		]);
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'manhattan');
	});

	test('reports invalid edge routes without changing the diagram', () => {
		const result = new UpdateEdgeRouteUseCase().execute(emptyDiagram(), [{
			id: 'edge_missing',
			points: [{ x: 0, y: 0 }],
			label: { x: 0, y: 0 },
		}]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Edges must have at least a source and target point.');
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

	test('updates node data property visibility', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
		]);

		const enabled = new UpdateNodeDataPropertiesVisibilityUseCase().execute(diagram, 'node_person', true);
		assert.ok(enabled.diagram);
		assert.strictEqual(enabled.diagram.nodes[0].showDataProperties, true);
		assert.deepStrictEqual(enabled.diagram.nodes[0].toPersistenceObject().show_data_properties, true);

		const disabled = new UpdateNodeDataPropertiesVisibilityUseCase().execute(enabled.diagram, 'node_person', false);
		assert.ok(disabled.diagram);
		assert.strictEqual(disabled.diagram.nodes[0].showDataProperties, undefined);
		assert.strictEqual(disabled.diagram.nodes[0].toPersistenceObject().show_data_properties, undefined);
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
		assert.strictEqual(result.diagram.images[0].style, undefined);
		assert.strictEqual(result.diagram.images[0].toPersistenceObject().style, undefined);
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

	test('updates note export visibility', () => {
		const diagram = diagramWithNotes([
			new DiagramNote('note_context', new Bounds(10, 20, 120, 80), 'Context'),
		]);

		const hidden = new UpdateNoteExportVisibilityUseCase().execute(diagram, 'note_context', false);
		assert.ok(hidden.diagram);
		assert.strictEqual(hidden.diagram.notes[0].exported, false);
		assert.deepStrictEqual(hidden.diagram.notes[0].toPersistenceObject().export, false);

		const shown = new UpdateNoteExportVisibilityUseCase().execute(hidden.diagram, 'note_context', true);
		assert.ok(shown.diagram);
		assert.strictEqual(shown.diagram.notes[0].exported, undefined);
		assert.strictEqual(shown.diagram.notes[0].toPersistenceObject().export, undefined);
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

	test('updates node style overrides', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50)),
		]);

		const result = new UpdateElementStyleUseCase().execute(diagram, 'node', 'node_person', {
			bg_color: '#FFFFFF',
			text_color: 'black',
			font: {
				family: 'Arial',
				bold: true,
				size: 14,
			},
			border: {
				type: 'dashed',
				weight: 2,
				color: '#336699',
			},
			corner_radius: 14,
			shadow: false,
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes[0].style?.toPersistenceObject(), {
			bg_color: '#FFFFFF',
			text_color: 'black',
			font: {
				family: 'Arial',
				bold: true,
				size: 14,
			},
			border: {
				type: 'dashed',
				weight: 2,
				color: '#336699',
			},
			corner_radius: 14,
			shadow: false,
		});
	});

	test('updates edge style overrides', () => {
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

		const result = new UpdateElementStyleUseCase().execute(diagram, 'edge', 'edge_relates', {
			color: '#111111',
			line_style: 'dotted',
			weight: 3,
			text_color: '#222222',
			font: {
				italic: true,
			},
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].style?.toPersistenceObject(), {
			color: '#111111',
			line_style: 'dotted',
			weight: 3,
			text_color: '#222222',
			font: {
				italic: true,
			},
		});
	});

	test('updates image border and shadow style overrides', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'images/logo.png'),
		]);

		const result = new UpdateElementStyleUseCase().execute(diagram, 'image', 'image_logo', {
			border: {
				type: 'dotted',
				weight: 3,
				color: '#CC5500',
			},
			shadow: true,
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.images[0].style?.toPersistenceObject(), {
			border: {
				type: 'dotted',
				weight: 3,
				color: '#CC5500',
			},
			shadow: true,
		});
	});

	test('clears element style overrides', () => {
		const diagram = diagramWithLabels([
			new DiagramLabel(
				'label_title',
				new Bounds(10, 20, 100, 40),
				'Title',
				new LabelStyle('#111827', new FontStyle(undefined, true)),
			),
		]);

		const result = new UpdateElementStyleUseCase().execute(diagram, 'label', 'label_title', undefined);

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.labels[0].style, undefined);
	});

	test('updates persisted theme mode metadata', () => {
		const result = new UpdateThemeModeUseCase().execute(emptyDiagram(), 'dark');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.metadata.themeMode, 'dark');
		const metadata = result.diagram.metadata.toPersistenceObject() as { readonly theme_mode?: unknown };
		assert.strictEqual(metadata.theme_mode, 'dark');
	});

	test('arranges ontology nodes in directed layers and reroutes edges', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_person', 'ex:Person', new Bounds(500, 300, 100, 50)),
				new DiagramNode('node_org', 'ex:Organization', new Bounds(20, 20, 120, 60)),
				new DiagramNode('node_role', 'ex:Role', new Bounds(20, 220, 80, 50)),
			],
			[
				new DiagramEdge(
					'edge_memberOf',
					'node_person',
					'node_org',
					'ex:memberOf',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
				new DiagramEdge(
					'edge_hasRole',
					'node_org',
					'node_role',
					'ex:hasRole',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
				new DiagramEdge(
					'edge_noteConnection',
					'note_context',
					'node_person',
					'https://ontology-diagram-editor.local/note-connection',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
					undefined,
					{ ontology_item_type: 'noteConnection' },
				),
			],
			[new DiagramNote('note_context', new Bounds(0, 200, 100, 80), 'Context')],
		);

		const result = new ArrangeDiagramUseCase().execute(diagram);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 80, y: 80, width: 100, height: 50 },
			{ x: 360, y: 80, width: 120, height: 60 },
			{ x: 660, y: 80, width: 80, height: 50 },
		]);
		assert.deepStrictEqual(result.diagram.notes[0].bounds.toPersistenceObject(), {
			x: 0,
			y: 200,
			width: 100,
			height: 80,
		});
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 180, y: 106 },
			{ x: 270, y: 106 },
			{ x: 270, y: 109 },
			{ x: 360, y: 109 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 270,
			y: 108,
		});
		assert.deepStrictEqual(result.diagram.edges[2].points.map((point) => point.toPersistenceObject()), [
			{ x: 90, y: 200 },
			{ x: 90, y: 130 },
		]);
	});

	test('reports empty diagrams when arranging', () => {
		const result = new ArrangeDiagramUseCase().execute(emptyDiagram());

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'There are no ontology nodes to arrange.');
	});

	test('reroutes stale edges when arranging already placed nodes', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(80, 80, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(360, 80, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
			],
		);

		const result = new ArrangeDiagramUseCase().execute(diagram);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 80, y: 80, width: 100, height: 50 },
			{ x: 360, y: 80, width: 120, height: 60 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 180, y: 106 },
			{ x: 270, y: 106 },
			{ x: 270, y: 109 },
			{ x: 360, y: 109 },
		]);
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

function overlaps(left: Bounds, right: Bounds): boolean {
	return left.x < right.x + right.width
		&& left.x + left.width > right.x
		&& left.y < right.y + right.height
		&& left.y + left.height > right.y;
}
