import * as assert from 'assert';
import * as path from 'path';

import {
	Bounds,
	CommonStyle,
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
	parseOntologyDiagramYaml,
	readOntologyDiagramFile,
	stringifyOntologyDiagramYaml,
} from '../documents/odiagram';
import { AlignEdgeEndPointsUseCase, AlignEdgeStartPointsUseCase, AlignSubclassEndpointsUseCase, ArrangeDiagramUseCase, CreateCommentNoteUseCase, CreateEdgeUseCase, CreateImageUseCase, CreateLabelUseCase, CreateMetadataElementUseCase, CreateNodeUseCase, CreateNoteConnectionUseCase, DeleteEdgeUseCase, DeleteElementsUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteMetadataElementUseCase, DeleteNodeUseCase, DeleteNoteUseCase, OptimizeEdgeRouteUseCase, SaveDiagramExportUseCase, ShowRelatedElementsUseCase, StraightenEdgeRouteUseCase, UpdateDiagramMetadataUseCase, UpdateEdgePresentationUseCase, UpdateEdgeRouteUseCase, UpdateEdgeRouteLayoutUseCase, UpdateElementBoundsUseCase, UpdateElementStyleUseCase, UpdateImageBoundsUseCase, UpdateImageSourceUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateMetadataBoundsUseCase, UpdateNodeBoundsUseCase, UpdateNodeDataPropertiesVisibilityUseCase, UpdateNodeImageUseCase, UpdateNodeLabelTextOverflowUseCase, UpdateNodePropertyValueTextOverflowUseCase, UpdateNodePropertyValuesVisibilityUseCase, UpdateNodeTypeVisibilityUseCase, UpdateNoteBoundsUseCase, UpdateNoteExportVisibilityUseCase, UpdateThemeModeUseCase } from '../diagram-editor/use-cases';
import type { DiagramExportSavePort } from '../diagram-editor/use-cases';
import type { DiagramLayoutAlgorithm } from '../diagram-editor/layout';
import { isConnectionCapableOntologyItem } from '../diagram-editor/use-cases/ontology-edge-endpoints';
import { loadReferencedOntologies } from '../ui/model-tree/ontology-model';

suite('Diagram editor use cases', () => {
	test('expands the supplied domain diagram to depth two without creating OWL restriction nodes', async () => {
		const diagramPath = path.resolve(__dirname, '../../src/test/resources/related-elements-depth-2-error/domain.odiagram');
		const diagram = await readOntologyDiagramFile(diagramPath);
		const ontologies = await loadReferencedOntologies(diagramPath, diagram);
		const relationships = ontologies.flatMap((ontology) => ontology.items
			.filter((item) => isConnectionCapableOntologyItem(item.type))
			.map((item) => ({
				sourceOntologyFilePath: ontology.relativePath,
				ontologyItemType: item.type,
				ontologyItemReference: item.reference,
				displayLabel: item.displayLabel,
				ontologyItemMetadata: item.metadata,
			})));

	const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_item1', 2, relationships);

		assert.ok(result.diagram);
		const expandedDiagram = result.diagram;
		if (expandedDiagram === undefined) {
			throw new Error('Expected related-element expansion to create a diagram.');
		}
		assert.strictEqual(expandedDiagram.nodes.some((node) => node.ontologyRef.value.startsWith('_:')), false);
		assert.doesNotThrow(() => parseOntologyDiagramYaml(stringifyOntologyDiagramYaml(expandedDiagram)));
	});

	test('persists independently moved edge cardinality labels', () => {
		const edge = new DiagramEdge(
			'edge_relates',
			'node_source',
			'node_target',
			'ex:relates',
			new Point(150, 25),
			[new Point(100, 25), new Point(200, 25)],
		).withCardinalityLabelPositions(new Point(108, 12), new Point(192, 12));
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 0, 100, 50)),
			],
			[edge],
		);

		const result = new UpdateEdgeRouteUseCase().execute(diagram, [{
			id: 'edge_relates',
			points: [{ x: 100, y: 25 }, { x: 200, y: 25 }],
			label: { x: 150, y: 25 },
			sourceCardinalityLabel: { x: 110.4, y: 10.6 },
			targetCardinalityLabel: { x: 190.6, y: 10.4 },
		}]);

		assert.deepStrictEqual(result.diagram?.edges[0].sourceCardinalityLabel?.toPersistenceObject(), { x: 110, y: 11 });
		assert.deepStrictEqual(result.diagram?.edges[0].targetCardinalityLabel?.toPersistenceObject(), { x: 191, y: 10 });
	});

	test('creates, moves, styles, and deletes a diagram information element', () => {
		const created = new CreateMetadataElementUseCase().execute(emptyDiagram(), { x: 10.4, y: 20.6 }).diagram;
		assert.ok(created);
		assert.strictEqual(created.metadataElements[0].id.value, 'metadata_item1');
		assert.deepStrictEqual(created.metadataElements[0].bounds.toPersistenceObject(), { x: 10, y: 21, width: 280, height: 108 });

		const moved = new UpdateMetadataBoundsUseCase().execute(created, [{ id: 'metadata_item1', x: 40, y: 50, width: 300, height: 120 }]).diagram;
		assert.ok(moved);
		assert.deepStrictEqual(moved.metadataElements[0].bounds.toPersistenceObject(), { x: 40, y: 50, width: 300, height: 120 });

		const styled = new UpdateElementStyleUseCase().execute(moved, 'metadata', 'metadata_item1', { bg_color: '#ffffff', font: { bold: true } }).diagram;
		assert.ok(styled);
		assert.strictEqual(styled.metadataElements[0].style?.bgColor, '#ffffff');
		assert.strictEqual(styled.metadataElements[0].style?.font?.bold, true);

		const deleted = new DeleteMetadataElementUseCase().execute(styled, 'metadata_item1').diagram;
		assert.ok(deleted);
		assert.strictEqual(deleted.metadataElements.length, 0);
	});
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

	test('creates individual nodes with visible type and property values', () => {
		const result = new CreateNodeUseCase().execute(
			emptyDiagram(),
			{
				ontologyItemType: 'individual',
				ontologyItemReference: 'ex:REQ-001',
				displayLabel: 'REQ-001',
				ontologyItemMetadata: {
					assertedClassReferences: ['https://example.com/requirements#FunctionalRequirement'],
					propertyAssertions: [
						{
							propertyReference: 'https://example.com/requirements#title',
							value: 'User Authentication',
							valueType: 'literal',
						},
						{
							propertyReference: 'https://example.com/requirements#dependsOn',
							value: 'https://example.com/requirements#REQ-002',
							valueType: 'resource',
						},
					],
				},
			},
			{ x: 10, y: 20 },
			{ width: 520, height: 140 },
		);

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes[0].showType, true);
		assert.strictEqual(result.diagram.nodes[0].showPropertyValues, true);
		assert.strictEqual(result.diagram.nodes[0].bounds.width, 520);
		assert.strictEqual(result.diagram.nodes[0].bounds.height, 140);
		assert.deepStrictEqual(result.diagram.nodes[0].toPersistenceObject().show_type, true);
		assert.deepStrictEqual(result.diagram.nodes[0].toPersistenceObject().show_property_values, true);
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
				new DiagramImage('image_selected', new Bounds(10, 180, 100, 80), 'data:image/png;base64,aW1hZ2U='),
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
			[new DiagramImage('image_logo', new Bounds(400, 0, 80, 40), 'data:image/png;base64,aW1hZ2U=')],
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

	test('updates route layout for multiple selected edges only', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 0, 100, 50)),
			],
			[
				new DiagramEdge('edge_first', 'node_source', 'node_target', 'ex:first', new Point(150, 20), [new Point(100, 20), new Point(200, 20)]),
				new DiagramEdge('edge_second', 'node_source', 'node_target', 'ex:second', new Point(150, 25), [new Point(100, 25), new Point(200, 25)], undefined, {}, 'orthogonal'),
				new DiagramEdge('edge_unselected', 'node_source', 'node_target', 'ex:third', new Point(150, 30), [new Point(100, 30), new Point(200, 30)]),
			],
		);

		const result = new UpdateEdgeRouteLayoutUseCase().executeMany(
			diagram,
			['edge_first', 'edge_second'],
			'direct',
		);

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
		assert.strictEqual(result.diagram.edges[1].routeLayout, 'direct');
		assert.strictEqual(result.diagram.edges[2].routeLayout, undefined);
		assert.deepStrictEqual(result.diagram.edges[1].points.map((point) => point.toPersistenceObject()), [
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

	test('materializes an ambiguous object property edge with user-selected endpoints', () => {
		const payload = {
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:contributesTo',
			displayLabel: 'contributes to',
			ontologyItemMetadata: {
				domainReferences: ['ex:Author', 'ex:Editor'],
				rangeReferences: ['ex:Book', 'ex:Website'],
			},
		};
		const rejected = new CreateEdgeUseCase().execute(emptyDiagram(), payload, { x: 400, y: 120 });
		assert.strictEqual(rejected.diagram, undefined);
		assert.strictEqual(rejected.notification, 'Select one source and one target ontology item to create this edge.');

		const result = new CreateEdgeUseCase().execute(emptyDiagram(), payload, { x: 400, y: 120 }, {
			sourceOntologyRef: 'ex:Editor',
			targetOntologyRef: 'ex:Website',
		});

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value), ['ex:Editor', 'ex:Website']);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'ex:contributesTo');
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

	test('materializes object property assertion edges from individuals', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([
				['ex', 'https://example.com/requirements/instances#'],
				['req', 'https://example.com/requirements#'],
			]),
			[
				new DiagramNode(
					'node_requirement',
					'ex:REQ-001',
					new Bounds(40, 120, 360, 144),
					undefined,
					undefined,
					{ ontology_item_type: 'individual' },
					undefined,
					true,
					true,
				),
			],
			[],
		);

		const result = new CreateEdgeUseCase().execute(diagram, {
			ontologyItemType: 'objectPropertyAssertion',
			ontologyItemReference: 'req:appliesTo',
			displayLabel: 'REQ-001 appliesTo AuthenticationService',
			ontologyItemMetadata: {
				edgeOntologyRef: 'req:appliesTo',
				sourceOntologyRef: 'ex:REQ-001',
				targetOntologyRef: 'ex:AuthenticationService',
				targetNodeType: 'individual',
			},
		}, { x: 460, y: 120 });

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes.length, 2);
		assert.strictEqual(result.diagram.edges.length, 1);
		const targetNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:AuthenticationService');
		assert.ok(targetNode);
		assert.strictEqual(targetNode.extra.ontology_item_type, 'individual');
		assert.strictEqual(targetNode.showType, true);
		assert.strictEqual(targetNode.showPropertyValues, true);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_requirement');
		assert.strictEqual(result.diagram.edges[0].target.value, targetNode.id.value);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'req:appliesTo');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'objectPropertyAssertion');
	});

	test('routes bottom-side subclass edges through a shared generalization trunk', () => {
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
			{ x: 50, y: 100 },
			{ x: 50, y: 80 },
			{ x: 140, y: 80 },
			{ x: 140, y: 60 },
		]);
		assert.deepStrictEqual(customerEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 230, y: 140 },
			{ x: 230, y: 80 },
			{ x: 140, y: 80 },
			{ x: 140, y: 60 },
		]);
	});

	test('routes left-side subclass edges through a shared generalization trunk', () => {
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
			{ x: 718, y: 250 },
			{ x: 718, y: 232 },
			{ x: 780, y: 232 },
		]);
	});

	test('uses the selected subclass box to route every bottom-side source from its top edge', () => {
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
		assert.deepStrictEqual(constraintEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 272, y: 511 },
			{ x: 272, y: 355 },
			{ x: 694, y: 355 },
			{ x: 694, y: 198 },
		]);
		assert.deepStrictEqual(functionalRequirementEdge.points[0].toPersistenceObject(), { x: 602, y: 511 });
		assert.deepStrictEqual(qualityRequirementEdge.points[0].toPersistenceObject(), { x: 931, y: 511 });
		assert.deepStrictEqual(functionalRequirementEdge.points[functionalRequirementEdge.points.length - 1].toPersistenceObject(), { x: 694, y: 198 });
	});

	test('routes right-side subclass edges through a shared generalization trunk', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_employee', 'ex:Employee', new Bounds(360, 80, 100, 50)),
				new DiagramNode('node_customer', 'ex:Customer', new Bounds(520, 140, 100, 50)),
				new DiagramNode('node_person', 'ex:Person', new Bounds(80, 100, 120, 60)),
			],
			[
				new DiagramEdge(
					'edge_employeePerson',
					'node_employee',
					'node_person',
					'rdfs:subClassOf',
					new Point(0, 0),
					[new Point(360, 105), new Point(200, 130)],
					undefined,
					{ ontology_item_type: 'subclassRelationship' },
					'direct',
				),
				new DiagramEdge(
					'edge_customerPerson',
					'node_customer',
					'node_person',
					'rdfs:subClassOf',
					new Point(0, 0),
					[new Point(520, 165), new Point(200, 130)],
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
			{ x: 360, y: 105 },
			{ x: 280, y: 105 },
			{ x: 280, y: 130 },
			{ x: 200, y: 130 },
		]);
		assert.deepStrictEqual(customerEdge.points.map((point) => point.toPersistenceObject()), [
			{ x: 520, y: 165 },
			{ x: 280, y: 165 },
			{ x: 280, y: 130 },
			{ x: 200, y: 130 },
		]);
		assert.strictEqual(employeeEdge.routeLayout, 'orthogonal');
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
		assert.strictEqual(result.notification, 'Select one source and one target ontology item to create this edge.');
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
		assert.strictEqual(result.notification, undefined);
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

	test('shows only missing ontology edges between selected nodes', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 180, 72)),
			new DiagramNode('node_organization', 'ex:Organization', new Bounds(300, 0, 180, 72)),
			new DiagramNode('node_role', 'ex:Role', new Bounds(600, 0, 180, 72)),
		]);

		const useCase = new ShowRelatedElementsUseCase();
		const relationships = [{
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:memberOf',
			displayLabel: 'memberOf',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person', 'ex:Role'],
				rangeReferences: ['ex:Organization'],
			},
		}];

		const result = useCase.showEdgesBetweenNodes(
			diagram,
			['node_person', 'node_organization'],
			relationships,
		);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => ({
			ontologyRef: edge.ontologyRef.value,
			source: edge.source.value,
			target: edge.target.value,
		})), [{
			ontologyRef: 'ex:memberOf',
			source: 'node_person',
			target: 'node_organization',
		}]);

		const duplicate = useCase.showEdgesBetweenNodes(
			result.diagram,
			['node_person', 'node_organization'],
			relationships,
		);
		assert.strictEqual(duplicate.diagram, undefined);
		assert.strictEqual(duplicate.notification, 'Ontology relationships between the selected nodes are already shown.');
	});

	test('reports when selected nodes have no ontology relationship', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 180, 72)),
			new DiagramNode('node_organization', 'ex:Organization', new Bounds(300, 0, 180, 72)),
		]);

		const result = new ShowRelatedElementsUseCase().showEdgesBetweenNodes(diagram, [
			'node_person',
			'node_organization',
		], [{
			ontologyItemType: 'objectProperty',
			ontologyItemReference: 'ex:hasRole',
			displayLabel: 'hasRole',
			ontologyItemMetadata: {
				domainReferences: ['ex:Person'],
				rangeReferences: ['ex:Role'],
			},
		}]);

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'No ontology relationships were found between the selected nodes.');
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
		assert.strictEqual(result.notification, undefined);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.ontologyRef.value).sort(), ['ex:Organization', 'ex:Person']);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.ontologyRef.value), ['ex:memberOf']);
	});

	test('shows object property assertion targets for selected individuals', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([
				['ex', 'https://example.com/requirements/instances#'],
				['req', 'https://example.com/requirements#'],
			]),
			[
				new DiagramNode(
					'node_requirement',
					'ex:REQ-001',
					new Bounds(300, 200, 360, 144),
					undefined,
					undefined,
					{ ontology_item_type: 'individual' },
					undefined,
					true,
					true,
				),
			],
			[],
		);

		const result = new ShowRelatedElementsUseCase().execute(diagram, 'node_requirement', 1, [
			{
				ontologyItemType: 'objectPropertyAssertion',
				ontologyItemReference: 'req:appliesTo',
				displayLabel: 'REQ-001 appliesTo AuthenticationService',
				ontologyItemMetadata: {
					edgeOntologyRef: 'req:appliesTo',
					sourceOntologyRef: 'ex:REQ-001',
					targetOntologyRef: 'ex:AuthenticationService',
					targetNodeType: 'individual',
				},
			},
		]);

		assert.ok(result.diagram);
		assert.strictEqual(result.notification, undefined);
		const targetNode = result.diagram.nodes.find((node) => node.ontologyRef.value === 'ex:AuthenticationService');
		assert.ok(targetNode);
		assert.strictEqual(targetNode.extra.ontology_item_type, 'individual');
		assert.strictEqual(targetNode.showType, true);
		assert.strictEqual(targetNode.showPropertyValues, true);
		assert.strictEqual(result.diagram.edges[0].source.value, 'node_requirement');
		assert.strictEqual(result.diagram.edges[0].target.value, targetNode.id.value);
		assert.strictEqual(result.diagram.edges[0].ontologyRef.value, 'req:appliesTo');
		assert.strictEqual(result.diagram.edges[0].extra.ontology_item_type, 'objectPropertyAssertion');
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

	test('aligns selected edge start points for edges from the first selected source', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_otherSource', 'ex:OtherSource', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_targetA', 'ex:TargetA', new Bounds(200, 0, 100, 50)),
				new DiagramNode('node_targetB', 'ex:TargetB', new Bounds(200, 100, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_first',
					'node_source',
					'node_targetA',
					'ex:first',
					new Point(150, 25),
					[new Point(100, 10), new Point(200, 10)],
				),
				new DiagramEdge(
					'edge_sameSource',
					'node_source',
					'node_targetB',
					'ex:sameSource',
					new Point(150, 80),
					[new Point(100, 45), new Point(200, 125)],
				),
				new DiagramEdge(
					'edge_otherSource',
					'node_otherSource',
					'node_targetB',
					'ex:otherSource',
					new Point(150, 125),
					[new Point(100, 145), new Point(200, 125)],
				),
			],
		);

		const result = new AlignEdgeStartPointsUseCase().execute(diagram, [
			'edge_first',
			'edge_sameSource',
			'edge_otherSource',
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.points[0].toPersistenceObject()), [
			{ x: 100, y: 10 },
			{ x: 100, y: 10 },
			{ x: 100, y: 145 },
		]);
		assert.deepStrictEqual(result.diagram.edges[1].points[1].toPersistenceObject(), {
			x: 200,
			y: 125,
		});
		assert.deepStrictEqual(result.diagram.edges[1].label.toPersistenceObject(), {
			x: 150,
			y: 80,
		});
	});

	test('aligns selected edge end points for edges to the first selected target', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_sourceA', 'ex:SourceA', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_sourceB', 'ex:SourceB', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_sourceC', 'ex:SourceC', new Bounds(0, 200, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 0, 100, 50)),
				new DiagramNode('node_otherTarget', 'ex:OtherTarget', new Bounds(200, 100, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_first',
					'node_sourceA',
					'node_target',
					'ex:first',
					new Point(150, 25),
					[new Point(100, 10), new Point(200, 10)],
				),
				new DiagramEdge(
					'edge_sameTarget',
					'node_sourceB',
					'node_target',
					'ex:sameTarget',
					new Point(150, 80),
					[new Point(100, 125), new Point(200, 45)],
				),
				new DiagramEdge(
					'edge_otherTarget',
					'node_sourceC',
					'node_otherTarget',
					'ex:otherTarget',
					new Point(150, 125),
					[new Point(100, 225), new Point(200, 125)],
				),
			],
		);

		const result = new AlignEdgeEndPointsUseCase().execute(diagram, [
			'edge_first',
			'edge_sameTarget',
			'edge_otherTarget',
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges.map((edge) => edge.points[edge.points.length - 1].toPersistenceObject()), [
			{ x: 200, y: 10 },
			{ x: 200, y: 10 },
			{ x: 200, y: 125 },
		]);
		assert.deepStrictEqual(result.diagram.edges[1].points[0].toPersistenceObject(), {
			x: 100,
			y: 125,
		});
		assert.deepStrictEqual(result.diagram.edges[1].label.toPersistenceObject(), {
			x: 150,
			y: 80,
		});
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
			{ x: 100, y: 38 },
			{ x: 212, y: 38 },
			{ x: 212, y: 100 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 187,
			y: 38,
		});
	});

	test('optimizes multiple selected edge routes only', () => {
		const stalePoints = [new Point(0, 0), new Point(1, 1)];
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 100, 100, 50)),
			],
			[
				new DiagramEdge('edge_first', 'node_source', 'node_target', 'ex:first', new Point(0, 0), stalePoints),
				new DiagramEdge('edge_second', 'node_source', 'node_target', 'ex:second', new Point(0, 0), stalePoints),
				new DiagramEdge('edge_unselected', 'node_source', 'node_target', 'ex:third', new Point(0, 0), stalePoints),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().executeMany(diagram, ['edge_first', 'edge_second']);

		assert.ok(result.diagram);
		for (const edge of result.diagram.edges.slice(0, 2)) {
			assert.notDeepStrictEqual(edge.points.map((point) => point.toPersistenceObject()), [
				{ x: 0, y: 0 },
				{ x: 1, y: 1 },
			]);
		}
		assert.notDeepStrictEqual(
			result.diagram.edges[0].points.map((point) => point.toPersistenceObject()),
			result.diagram.edges[1].points.map((point) => point.toPersistenceObject()),
		);
		assert.deepStrictEqual(result.diagram.edges[2].points.map((point) => point.toPersistenceObject()), [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		]);
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
			{ x: 100, y: 38 },
			{ x: 212, y: 100 },
		]);
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'manhattan');
	});

	test('uses aligned side anchors when connecting to a much larger node', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_cat', 'ex:Cat', new Bounds(44, 638, 226, 91)),
				new DiagramNode('node_thing', 'ex:Thing', new Bounds(436, 87, 581, 704)),
			],
			[
				new DiagramEdge('edge_cat_thing', 'node_cat', 'node_thing', 'ex:subClassOf', new Point(500, 803), [new Point(270, 684), new Point(290, 803), new Point(727, 803), new Point(727, 791)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_cat_thing');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 270, y: 684 },
			{ x: 436, y: 684 },
		]);
	});

	test('moves a stale Website to Thing label onto its vertical route', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_website', 'ex:Website', new Bounds(306, 0, 225, 84)),
				new DiagramNode('node_thing', 'ex:Thing', new Bounds(444, 161, 581, 670)),
			],
			[
				new DiagramEdge('edge_website_thing', 'node_website', 'node_thing', 'ex:subClassOf', new Point(866, 127), [new Point(488, 84), new Point(488, 161)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_website_thing');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 488, y: 84 },
			{ x: 488, y: 161 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), { x: 488, y: 123 });
	});

	test('routes orthogonal edges around intervening nodes', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_blocker', 'ex:Blocker', new Bounds(150, 75, 100, 100)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 100, 100, 50)),
			],
			[
				new DiagramEdge('edge_relates', 'node_source', 'node_target', 'ex:relates', new Point(200, 125), [new Point(100, 125), new Point(300, 125)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		const points = result.diagram.edges[0].points;
		assert.ok(points.some((point) => point.y < 75 || point.y > 175));
		for (let index = 1; index < points.length; index += 1) {
			const start = points[index - 1];
			const end = points[index];
			if (start.y === end.y && start.y > 75 && start.y < 175) {
				assert.ok(Math.max(start.x, end.x) <= 150 || Math.min(start.x, end.x) >= 250);
			}
			if (start.x === end.x && start.x > 150 && start.x < 250) {
				assert.ok(Math.max(start.y, end.y) <= 75 || Math.min(start.y, end.y) >= 175);
			}
		}
	});

	test('chooses the shorter collision-free side of an obstacle', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 125, 100, 50)),
				new DiagramNode('node_blocker', 'ex:Blocker', new Bounds(150, 60, 100, 120)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 125, 100, 50)),
			],
			[
				new DiagramEdge('edge_relates', 'node_source', 'node_target', 'ex:relates', new Point(200, 150), [new Point(100, 150), new Point(300, 150)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		const points = result.diagram.edges[0].points;
		assert.ok(points.some((point) => point.y >= 196));
		assert.ok(points.every((point) => point.y > 44));
	});

	test('preserves manually moved edge and cardinality labels while optimizing', () => {
		const edge = new DiagramEdge(
			'edge_relates',
			'node_source',
			'node_target',
			'ex:relates',
			new Point(150, 220),
			[new Point(100, 25), new Point(200, 125)],
		).withCardinalityLabelPositions(new Point(112, 38), new Point(188, 112));
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(200, 100, 100, 50)),
			],
			[edge],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), { x: 150, y: 220 });
		assert.deepStrictEqual(result.diagram.edges[0].sourceCardinalityLabel?.toPersistenceObject(), { x: 112, y: 38 });
		assert.deepStrictEqual(result.diagram.edges[0].targetCardinalityLabel?.toPersistenceObject(), { x: 188, y: 112 });
	});

	test('routes around a persisted edge label', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 100, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 100, 100, 50)),
				new DiagramNode('node_aux_source', 'ex:AuxSource', new Bounds(0, 0, 100, 50)),
				new DiagramNode('node_aux_target', 'ex:AuxTarget', new Bounds(300, 0, 100, 50)),
			],
			[
				new DiagramEdge('edge_label_obstacle', 'node_aux_source', 'node_aux_target', 'ex:aux', new Point(200, 125), [new Point(100, 25), new Point(300, 25)]),
				new DiagramEdge('edge_selected', 'node_source', 'node_target', 'ex:selected', new Point(200, 125), [new Point(100, 125), new Point(300, 125)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_selected');

		assert.ok(result.diagram);
		const points = result.diagram.edges[1].points;
		const crossesLabel = points.slice(1).some((point, index) => {
			const previous = points[index];
			return previous.y === point.y
				&& previous.y > 111
				&& previous.y < 139
				&& Math.min(previous.x, point.x) < 244
				&& Math.max(previous.x, point.x) > 156;
		});
		assert.strictEqual(crossesLabel, false);
	});

	test('prefers a substantially shorter path over avoiding one edge crossing', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_left', 'ex:Left', new Bounds(0, 125, 80, 50)),
				new DiagramNode('node_right', 'ex:Right', new Bounds(320, 125, 80, 50)),
				new DiagramNode('node_top', 'ex:Top', new Bounds(175, 0, 50, 80)),
				new DiagramNode('node_bottom', 'ex:Bottom', new Bounds(175, 220, 50, 80)),
			],
			[
				new DiagramEdge('edge_existing', 'node_top', 'node_bottom', 'ex:vertical', new Point(200, 150), [new Point(200, 80), new Point(200, 220)]),
				new DiagramEdge('edge_selected', 'node_left', 'node_right', 'ex:horizontal', new Point(200, 150), [new Point(80, 150), new Point(320, 150)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_selected');

		assert.ok(result.diagram);
		const points = result.diagram.edges[1].points;
		const crossesExisting = points.slice(1).some((point, index) => {
			const previous = points[index];
			return previous.y === point.y
				&& previous.y > 80
				&& previous.y < 220
				&& Math.min(previous.x, point.x) < 200
				&& Math.max(previous.x, point.x) > 200;
		});
		const routeLength = points.slice(1).reduce((length, point, index) =>
			length + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0);
		assert.strictEqual(crossesExisting, true);
		assert.ok(routeLength <= 300);
	});

	test('places self loops in the clearest available quadrant', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_self', 'ex:Self', new Bounds(120, 120, 100, 80)),
				new DiagramNode('node_right', 'ex:Right', new Bounds(220, 80, 160, 240)),
				new DiagramNode('node_bottom', 'ex:Bottom', new Bounds(80, 200, 180, 160)),
			],
			[
				new DiagramEdge('edge_self', 'node_self', 'node_self', 'ex:self', new Point(280, 180), [new Point(220, 150), new Point(300, 150), new Point(300, 260), new Point(185, 200)]),
			],
		);

		const result = new OptimizeEdgeRouteUseCase().execute(diagram, 'edge_self');

		assert.ok(result.diagram);
		const points = result.diagram.edges[0].points;
		assert.ok(points.some((point) => point.x < 120 || point.y < 120));
		assert.ok(points.every((point) => point.x <= 220 || point.y < 80));
	});

	test('straightens side-by-side edge routes horizontally', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 80)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(220, 20, 100, 80)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(10, 10), new Point(160, 10), new Point(160, 120), new Point(300, 120)],
				),
			],
		);

		const result = new StraightenEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 50 },
			{ x: 220, y: 50 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 160,
			y: 50,
		});
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
	});

	test('straightens orthogonal side-by-side edges without moving a usable source anchor', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 80)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(220, 20, 100, 80)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(100, 35), new Point(160, 35), new Point(160, 120), new Point(220, 120)],
					undefined,
					{},
					'orthogonal',
				),
			],
		);

		const result = new StraightenEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 35 },
			{ x: 220, y: 35 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 160,
			y: 35,
		});
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
	});

	test('straightens stacked edge routes vertically', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 80)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(20, 220, 100, 80)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(10, 10), new Point(160, 10), new Point(160, 120), new Point(300, 120)],
				),
			],
		);

		const result = new StraightenEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 60, y: 80 },
			{ x: 60, y: 220 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 60,
			y: 150,
		});
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
	});

	test('forces a nearest axis-aligned route for diagonal endpoints', () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(0, 0, 100, 80)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(220, 110, 100, 80)),
			],
			[
				new DiagramEdge(
					'edge_relates',
					'node_source',
					'node_target',
					'ex:relates',
					new Point(0, 0),
					[new Point(100, 40), new Point(160, 40), new Point(160, 150), new Point(220, 150)],
				),
			],
		);

		const result = new StraightenEdgeRouteUseCase().execute(diagram, 'edge_relates');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 100, y: 95 },
			{ x: 220, y: 95 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), {
			x: 160,
			y: 95,
		});
		assert.strictEqual(result.diagram.edges[0].routeLayout, 'direct');
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

	test('updates node instance type visibility', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_requirement', 'ex:REQ-001', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }, undefined, true, true),
		]);

		const disabled = new UpdateNodeTypeVisibilityUseCase().execute(diagram, 'node_requirement', false);
		assert.ok(disabled.diagram);
		assert.strictEqual(disabled.diagram.nodes[0].showType, false);
		assert.deepStrictEqual(disabled.diagram.nodes[0].toPersistenceObject().show_type, false);

		const enabled = new UpdateNodeTypeVisibilityUseCase().execute(disabled.diagram, 'node_requirement', true);
		assert.ok(enabled.diagram);
		assert.strictEqual(enabled.diagram.nodes[0].showType, true);
		assert.deepStrictEqual(enabled.diagram.nodes[0].toPersistenceObject().show_type, true);
	});

	test('updates node property value visibility', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_requirement', 'ex:REQ-001', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }, undefined, true, undefined),
		]);

		const enabled = new UpdateNodePropertyValuesVisibilityUseCase().execute(diagram, 'node_requirement', true);
		assert.ok(enabled.diagram);
		assert.strictEqual(enabled.diagram.nodes[0].showPropertyValues, true);
		assert.deepStrictEqual(enabled.diagram.nodes[0].toPersistenceObject().show_property_values, true);

		const disabled = new UpdateNodePropertyValuesVisibilityUseCase().execute(enabled.diagram, 'node_requirement', false);
		assert.ok(disabled.diagram);
		assert.strictEqual(disabled.diagram.nodes[0].showPropertyValues, false);
		assert.deepStrictEqual(disabled.diagram.nodes[0].toPersistenceObject().show_property_values, false);
	});

	test('updates node property value text overflow', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_requirement', 'ex:REQ-001', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }, undefined, true, true),
		]);

		const wrapped = new UpdateNodePropertyValueTextOverflowUseCase().execute(diagram, 'node_requirement', 'wrap');
		assert.ok(wrapped.diagram);
		assert.strictEqual(wrapped.diagram.nodes[0].propertyValueTextOverflow, 'wrap');
		assert.deepStrictEqual(wrapped.diagram.nodes[0].toPersistenceObject().property_value_text_overflow, 'wrap');

		const truncated = new UpdateNodePropertyValueTextOverflowUseCase().execute(wrapped.diagram, 'node_requirement', 'truncate');
		assert.ok(truncated.diagram);
		assert.strictEqual(truncated.diagram.nodes[0].propertyValueTextOverflow, undefined);
		assert.strictEqual(truncated.diagram.nodes[0].toPersistenceObject().property_value_text_overflow, undefined);
	});

	test('updates node label text overflow', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_requirement', 'ex:REQ-001', new Bounds(0, 0, 100, 50)),
			new DiagramNode('node_design', 'ex:DES-001', new Bounds(150, 0, 100, 50)),
			new DiagramNode('node_other', 'ex:Other', new Bounds(300, 0, 100, 50)),
		]);

		const wrapped = new UpdateNodeLabelTextOverflowUseCase().execute(diagram, 'node_requirement', 'wrap');
		assert.ok(wrapped.diagram);
		assert.strictEqual(wrapped.diagram.nodes[0].labelTextOverflow, 'wrap');
		assert.deepStrictEqual(wrapped.diagram.nodes[0].toPersistenceObject().label_text_overflow, 'wrap');

		const truncated = new UpdateNodeLabelTextOverflowUseCase().execute(wrapped.diagram, 'node_requirement', 'truncate');
		assert.ok(truncated.diagram);
		assert.strictEqual(truncated.diagram.nodes[0].labelTextOverflow, undefined);
		assert.strictEqual(truncated.diagram.nodes[0].toPersistenceObject().label_text_overflow, undefined);

		const batch = new UpdateNodeLabelTextOverflowUseCase().executeMany(
			truncated.diagram,
			['node_requirement', 'node_design'],
			'wrap',
		);
		assert.ok(batch.diagram);
		assert.deepStrictEqual(
			batch.diagram.nodes.map((node) => node.labelTextOverflow),
			['wrap', 'wrap', undefined],
		);
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
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'data:image/png;base64,aW1hZ2U='),
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

	test('replaces an embedded image source selected from the property panel', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'data:image/png;base64,b2xk'),
		]);

		const result = new UpdateImageSourceUseCase().execute(diagram, 'image_logo', 'data:image/png;base64,aW1hZ2U=');

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.images[0].source, 'data:image/png;base64,aW1hZ2U=');
	});

	test('rejects non-embedded image source changes without changing the diagram', () => {
		const diagram = diagramWithImages([
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'data:image/png;base64,b2xk'),
		]);

		const result = new UpdateImageSourceUseCase().execute(diagram, 'image_logo', 'https://example.com/logo.png');

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'Image source must be an embedded data image URI.');
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
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'data:image/png;base64,bG9nbw=='),
			new DiagramImage('image_banner', new Bounds(40, 50, 120, 90), 'data:image/png;base64,YmFubmVy'),
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
			image_fit: 'match_height',
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
			image_fit: 'match_height',
		});
	});

	test('updates multiple node styles atomically', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 100, 50), new CommonStyle('#FFFFFF')),
			new DiagramNode('node_team', 'ex:Team', new Bounds(150, 0, 100, 50), new CommonStyle('#EEEEEE')),
		]);
		const useCase = new UpdateElementStyleUseCase();
		const result = useCase.executeMany(diagram, [
			{ elementType: 'node', id: 'node_person', style: { bg_color: '#FFFFFF', text_color: '#111111' } },
			{ elementType: 'node', id: 'node_team', style: { bg_color: '#EEEEEE', text_color: '#111111' } },
		]);

		assert.ok(result.diagram);
		assert.deepStrictEqual(
			result.diagram.nodes.map((node) => node.style?.toPersistenceObject()),
			[
				{ bg_color: '#FFFFFF', text_color: '#111111' },
				{ bg_color: '#EEEEEE', text_color: '#111111' },
			],
		);

		const invalid = useCase.executeMany(diagram, [
			{ elementType: 'node', id: 'node_person', style: { text_color: '#111111' } },
			{ elementType: 'node', id: 'node_team', style: { font: { size: 0 } } },
		]);
		assert.strictEqual(invalid.diagram, undefined);
		assert.strictEqual(invalid.notification, 'Font size must be greater than 0.');
		assert.strictEqual(diagram.nodes[0].style?.textColor, undefined);
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
			new DiagramImage('image_logo', new Bounds(10, 20, 100, 80), 'data:image/png;base64,aW1hZ2U='),
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

	test('updates editable diagram metadata fields', () => {
		const diagram = new OntologyDiagramDocument(
			new DiagramMetadata('1.0', 'Example', ['Old Author'], '0.1.0', 'themes/base.otheme', { status: 'draft' }, { custom_metadata: true }, 'dark'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[],
			[],
		);

		const result = new UpdateDiagramMetadataUseCase().execute(diagram, {
			title: 'Published diagram',
			authors: ['Ada Lovelace', 'Grace Hopper'],
			diagram_version: '1.2.3',
		});

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.metadata.schemaVersion, '1.0');
		assert.strictEqual(result.diagram.metadata.title, 'Published diagram');
		assert.deepStrictEqual(result.diagram.metadata.authors, ['Ada Lovelace', 'Grace Hopper']);
		assert.strictEqual(result.diagram.metadata.diagramVersion, '1.2.3');
		assert.strictEqual(result.diagram.metadata.themeFile, 'themes/base.otheme');
		assert.deepStrictEqual(result.diagram.metadata.additional, { status: 'draft' });
		assert.deepStrictEqual(result.diagram.metadata.extra, { custom_metadata: true });
		assert.strictEqual(result.diagram.metadata.themeMode, 'dark');
	});

	test('clears diagram theme file metadata', () => {
		const diagram = new OntologyDiagramDocument(
			new DiagramMetadata('1.0', 'Example', [], '0.1.0', 'themes/base.otheme'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[],
			[],
		);

		const result = new UpdateDiagramMetadataUseCase().execute(diagram, {
			theme_file: undefined,
		});

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.metadata.themeFile, undefined);
		assert.strictEqual(result.diagram.metadata.title, 'Example');
	});

	test('arranges ontology nodes in directed layers and reroutes edges', async () => {
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

		const result = await new ArrangeDiagramUseCase().execute(diagram);

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

	test('reports empty diagrams when arranging', async () => {
		const result = await new ArrangeDiagramUseCase().execute(emptyDiagram());

		assert.strictEqual(result.diagram, undefined);
		assert.strictEqual(result.notification, 'There are no ontology nodes to arrange.');
	});

	test('renders selected part-of edges as recursively laid out containment', () => {
		const diagram = containmentTestDiagram();
		const useCase = new UpdateEdgePresentationUseCase();
		const first = useCase.execute(diagram, 'edge_childA', 'containment', 'target_contains_source');
		assert.ok(first.diagram);
		const second = useCase.execute(first.diagram, 'edge_childB', 'containment', 'target_contains_source');
		assert.ok(second.diagram);

		assert.deepStrictEqual(second.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 40, y: 40, width: 248, height: 122 },
			{ x: 56, y: 96, width: 100, height: 50 },
			{ x: 172, y: 96, width: 100, height: 50 },
			{ x: 500, y: 40, width: 120, height: 60 },
		]);
		assert.strictEqual(second.diagram.edges[0].renderAs, 'containment');
		assert.strictEqual(second.diagram.edges[0].containmentDirection, 'target_contains_source');
	});

	test('rejects a second containment parent and containment cycles', () => {
		const useCase = new UpdateEdgePresentationUseCase();
		const diagram = containmentTestDiagram();
		const firstParent = useCase.execute(diagram, 'edge_childA', 'containment', 'target_contains_source').diagram;
		assert.ok(firstParent);

		const secondParent = useCase.execute(firstParent, 'edge_otherParent', 'containment', 'target_contains_source');
		assert.strictEqual(secondParent.diagram, undefined);
		assert.match(secondParent.notification ?? '', /cannot be contained by both/);

		const cycleDiagram = new OntologyDiagramDocument(
			firstParent.metadata,
			firstParent.ontologies,
			firstParent.namespaces,
			firstParent.nodes,
			[
				...firstParent.edges,
				new DiagramEdge(
					'edge_cycle',
					'node_parent',
					'node_childA',
					'ex:partOf',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
				),
			],
		);
		const cycle = useCase.execute(cycleDiagram, 'edge_cycle', 'containment', 'target_contains_source');
		assert.strictEqual(cycle.diagram, undefined);
		assert.match(cycle.notification ?? '', /cycle/);
	});

	test('arranges containment trees as compound root nodes', async () => {
		const useCase = new UpdateEdgePresentationUseCase();
		const first = useCase.execute(containmentTestDiagram(), 'edge_childA', 'containment', 'target_contains_source').diagram;
		assert.ok(first);
		const nestedDiagram = useCase.execute(first, 'edge_childB', 'containment', 'target_contains_source').diagram;
		assert.ok(nestedDiagram);

		const result = await new ArrangeDiagramUseCase().execute(nestedDiagram, 'grid');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 80, y: 80, width: 248, height: 122 },
			{ x: 96, y: 136, width: 100, height: 50 },
			{ x: 212, y: 136, width: 100, height: 50 },
			{ x: 400, y: 80, width: 120, height: 60 },
		]);
		assert.strictEqual(result.diagram.edges[0].renderAs, 'containment');
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		]);
		assert.notDeepStrictEqual(result.diagram.edges[2].points.map((point) => point.toPersistenceObject()), [
			{ x: 0, y: 0 },
			{ x: 1, y: 1 },
		]);
	});

	test('promotes a selected contained node to its compound root for layout', async () => {
		const useCase = new UpdateEdgePresentationUseCase();
		const nestedDiagram = useCase.execute(
			containmentTestDiagram(),
			'edge_childA',
			'containment',
			'target_contains_source',
		).diagram;
		assert.ok(nestedDiagram);

		const result = await new ArrangeDiagramUseCase().execute(
			nestedDiagram,
			'grid',
			undefined,
			['node_childA'],
		);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 80, y: 80, width: 132, height: 122 },
			{ x: 96, y: 136, width: 100, height: 50 },
			{ x: 360, y: 40, width: 100, height: 50 },
			{ x: 500, y: 40, width: 120, height: 60 },
		]);
	});

	test('leaves unselected containment trees unchanged when arranging a selected tree', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Containment selection'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_parentA', 'ex:ParentA', new Bounds(20, 20, 180, 160)),
				new DiagramNode('node_childA', 'ex:ChildA', new Bounds(60, 100, 100, 50)),
				new DiagramNode('node_parentB', 'ex:ParentB', new Bounds(400, 20, 220, 180)),
				new DiagramNode('node_childB', 'ex:ChildB', new Bounds(480, 120, 100, 50)),
			],
			[
				new DiagramEdge(
					'edge_childA',
					'node_childA',
					'node_parentA',
					'ex:partOf',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
					undefined,
					{},
					undefined,
					'containment',
					'target_contains_source',
				),
				new DiagramEdge(
					'edge_childB',
					'node_childB',
					'node_parentB',
					'ex:partOf',
					new Point(0, 0),
					[new Point(0, 0), new Point(1, 1)],
					undefined,
					{},
					undefined,
					'containment',
					'target_contains_source',
				),
			],
		);
		const algorithm: DiagramLayoutAlgorithm = {
			id: 'grid',
			layout: async (layoutDiagram) => ({
				nodeBoundsById: new Map(layoutDiagram.nodes.map((node) => [
					node.id.value,
					new Bounds(80, 80, node.bounds.width, node.bounds.height),
				])),
			}),
		};

		const result = await new ArrangeDiagramUseCase([algorithm]).execute(
			diagram,
			'grid',
			undefined,
			['node_childA'],
		);

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes[2].bounds.toPersistenceObject(), {
			x: 400,
			y: 20,
			width: 220,
			height: 180,
		});
		assert.deepStrictEqual(result.diagram.nodes[3].bounds.toPersistenceObject(), {
			x: 480,
			y: 120,
			width: 100,
			height: 50,
		});
	});

	test('reroutes stale edges when arranging already placed nodes', async () => {
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

		const result = await new ArrangeDiagramUseCase().execute(diagram);

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

	test('selects the grid layout algorithm while preserving node sizes', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_a', 'ex:A', new Bounds(500, 300, 100, 50)),
				new DiagramNode('node_b', 'ex:B', new Bounds(20, 20, 120, 60)),
				new DiagramNode('node_c', 'ex:C', new Bounds(20, 220, 80, 40)),
			],
			[],
		);

		const result = await new ArrangeDiagramUseCase().execute(diagram, 'grid');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.nodes.map((node) => node.bounds.toPersistenceObject()), [
			{ x: 80, y: 80, width: 100, height: 50 },
			{ x: 252, y: 80, width: 120, height: 60 },
			{ x: 80, y: 212, width: 80, height: 40 },
		]);
	});

	test('uses ELK layouts for cyclic diagrams and routed edges', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_a', 'ex:A', new Bounds(500, 300, 100, 50)),
				new DiagramNode('node_b', 'ex:B', new Bounds(20, 20, 120, 60)),
				new DiagramNode('node_c', 'ex:C', new Bounds(20, 220, 80, 40)),
			],
			[
				new DiagramEdge('edge_ab', 'node_a', 'node_b', 'ex:ab', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
				new DiagramEdge('edge_bc', 'node_b', 'node_c', 'ex:bc', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
				new DiagramEdge('edge_ca', 'node_c', 'node_a', 'ex:ca', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
			],
		);

		for (const algorithmId of ['elk-layered', 'elk-force', 'elk-mrtree'] as const) {
			const result = await new ArrangeDiagramUseCase().execute(diagram, algorithmId);

			assert.ok(result.diagram, `${algorithmId} should arrange the diagram`);
			assert.deepStrictEqual(result.diagram.nodes.map((node) => ({
				width: node.bounds.width,
				height: node.bounds.height,
			})), [
				{ width: 100, height: 50 },
				{ width: 120, height: 60 },
				{ width: 80, height: 40 },
			]);
			assert.ok(new Set(result.diagram.nodes.map((node) => node.bounds.x)).size > 1);
			assert.ok(result.diagram.nodes.every((node) => node.bounds.x >= 80 && node.bounds.y >= 80));
			assert.ok(result.diagram.edges.every((edge) => edge.points.length >= 2));
			assert.ok(result.diagram.edges.every((edge) => edge.label.x > 0 && edge.label.y > 0));
		}
	});

	test('uses routes supplied by an injected layout algorithm', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_source', 'ex:Source', new Bounds(10, 20, 100, 50)),
				new DiagramNode('node_target', 'ex:Target', new Bounds(300, 20, 100, 50)),
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
		const algorithm: DiagramLayoutAlgorithm = {
			id: 'grid',
			layout: async () => ({
				nodeBoundsById: new Map([
					['node_source', new Bounds(80, 80, 100, 50)],
					['node_target', new Bounds(320, 80, 100, 50)],
				]),
				edgeRoutesById: new Map([[
					'edge_relates',
					{
						label: new Point(250, 60),
						points: [new Point(180, 105), new Point(250, 105), new Point(250, 105), new Point(320, 105)],
					},
				]]),
			}),
		};

		const result = await new ArrangeDiagramUseCase([algorithm]).execute(diagram, 'grid');

		assert.ok(result.diagram);
		assert.deepStrictEqual(result.diagram.edges[0].points.map((point) => point.toPersistenceObject()), [
			{ x: 180, y: 105 },
			{ x: 250, y: 105 },
			{ x: 250, y: 105 },
			{ x: 320, y: 105 },
		]);
		assert.deepStrictEqual(result.diagram.edges[0].label.toPersistenceObject(), { x: 250, y: 60 });
	});

	test('passes configured ELK layered gaps to the selected layout algorithm', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_a', 'ex:A', new Bounds(80, 80, 100, 50))],
			[],
		);
		let receivedOptions: { readonly nodeSpacing?: number; readonly layerSpacing?: number; readonly direction?: 'horizontal' | 'right-to-left' | 'vertical' | 'bottom-up' } | undefined;
		const algorithm: DiagramLayoutAlgorithm = {
			id: 'elk-layered',
			layout: async (_diagram, elkLayeredOptions) => {
				receivedOptions = elkLayeredOptions;
				return { nodeBoundsById: new Map() };
			},
		};

		await new ArrangeDiagramUseCase([algorithm]).execute(diagram, 'elk-layered', {
			nodeSpacing: 104,
			layerSpacing: 240,
			direction: 'vertical',
		});

		assert.deepStrictEqual(receivedOptions, {
			nodeSpacing: 104,
			layerSpacing: 240,
			direction: 'vertical',
		});
	});

	test('arranges only selected nodes, or every node when none are selected', async () => {
		const diagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_a', 'ex:A', new Bounds(10, 20, 100, 50)),
				new DiagramNode('node_b', 'ex:B', new Bounds(200, 20, 100, 50)),
				new DiagramNode('node_c', 'ex:C', new Bounds(390, 20, 100, 50)),
			],
			[
				new DiagramEdge('edge_ab', 'node_a', 'node_b', 'ex:ab', new Point(150, 45), [new Point(110, 45), new Point(200, 45)]),
				new DiagramEdge('edge_bc', 'node_b', 'node_c', 'ex:bc', new Point(340, 45), [new Point(300, 45), new Point(390, 45)]),
			],
		);
		const layoutNodeIds: string[][] = [];
		const algorithm: DiagramLayoutAlgorithm = {
			id: 'grid',
			layout: async (layoutDiagram) => {
				layoutNodeIds.push(layoutDiagram.nodes.map((node) => node.id.value));
				return {
					nodeBoundsById: new Map(layoutDiagram.nodes.map((node, index) => [
						node.id.value,
						new Bounds(80 + (index * 160), 80, node.bounds.width, node.bounds.height),
					])),
				};
			},
		};
		const useCase = new ArrangeDiagramUseCase([algorithm]);

		const selectedResult = await useCase.execute(diagram, 'grid', undefined, ['node_b', 'node_c']);
		assert.ok(selectedResult.diagram);
		assert.deepStrictEqual(layoutNodeIds[0], ['node_b', 'node_c']);
		assert.deepStrictEqual(selectedResult.diagram.nodes[0].bounds.toPersistenceObject(), { x: 10, y: 20, width: 100, height: 50 });

		await useCase.execute(diagram, 'grid');
		assert.deepStrictEqual(layoutNodeIds[1], ['node_a', 'node_b', 'node_c']);
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

function containmentTestDiagram(): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Containment'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[
			new DiagramNode('node_parent', 'ex:Parent', new Bounds(40, 40, 120, 60)),
			new DiagramNode('node_childA', 'ex:ChildA', new Bounds(240, 40, 100, 50)),
			new DiagramNode('node_childB', 'ex:ChildB', new Bounds(360, 40, 100, 50)),
			new DiagramNode('node_otherParent', 'ex:OtherParent', new Bounds(500, 40, 120, 60)),
		],
		[
			new DiagramEdge('edge_childA', 'node_childA', 'node_parent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
			new DiagramEdge('edge_childB', 'node_childB', 'node_parent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
			new DiagramEdge('edge_otherParent', 'node_childA', 'node_otherParent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
		],
	);
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
