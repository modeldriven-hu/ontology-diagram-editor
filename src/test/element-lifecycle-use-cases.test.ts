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
import { AlignEdgeEndPointsUseCase, AlignEdgeStartPointsUseCase, AlignSubclassEndpointsUseCase, ArrangeDiagramUseCase, CreateCommentNoteUseCase, CreateEdgeUseCase, CreateImageUseCase, CreateLabelUseCase, CreateMetadataElementUseCase, CreateNodeUseCase, CreateNoteConnectionUseCase, DeleteEdgeUseCase, DeleteElementsUseCase, DeleteImageUseCase, DeleteLabelUseCase, DeleteMetadataElementUseCase, DeleteNodeUseCase, DeleteNoteUseCase, OptimizeEdgeRouteUseCase, SaveDiagramExportUseCase, ShowRelatedElementsUseCase, StraightenEdgeRouteUseCase, UpdateDiagramMetadataUseCase, UpdateEdgePresentationUseCase, UpdateEdgeRouteUseCase, UpdateEdgeRouteLayoutUseCase, UpdateElementBoundsUseCase, UpdateElementStyleUseCase, UpdateImageBoundsUseCase, UpdateImageSourceUseCase, UpdateLabelBoundsUseCase, UpdateLabelTextUseCase, UpdateMetadataBoundsUseCase, UpdateNodeBoundsUseCase, UpdateNodeDataPropertiesVisibilityUseCase, UpdateNodeImageUseCase, UpdateNodeLabelTextOverflowUseCase, UpdateNodePropertyValueTextOverflowUseCase, UpdateNodePropertyValuesVisibilityUseCase, UpdateNodeTypeDisplayUseCase, UpdateNodeTypeVisibilityUseCase, UpdateNoteBoundsUseCase, UpdateNoteExportVisibilityUseCase, UpdateThemeModeUseCase } from '../diagram-editor/use-cases';
import type { DiagramExportSavePort } from '../diagram-editor/use-cases';
import type { DiagramLayoutAlgorithm } from '../diagram-editor/layout';
import { isConnectionCapableOntologyItem } from '../diagram-editor/use-cases/ontology-edge-endpoints';
import { loadReferencedOntologies } from '../ui/model-tree/ontology-model';
import { RecordingDiagramExportSavePort, containmentTestDiagram, diagramWithImages, diagramWithLabels, diagramWithNodes, diagramWithNotes, emptyDiagram, overlaps } from './support/diagram-builders';

suite('Element lifecycle and geometry use cases', () => {
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
			width: 96,
			height: 44,
		});
		assert.strictEqual(result.diagram.nodes[0].labelTextOverflow, 'wrap');
		assert.strictEqual(result.diagram.nodes[0].toPersistenceObject().label_text_overflow, 'wrap');
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
		);

		assert.ok(result.diagram);
		assert.strictEqual(result.diagram.nodes[0].showType, true);
		assert.strictEqual(result.diagram.nodes[0].showPropertyValues, true);
		assert.strictEqual(result.diagram.nodes[0].bounds.width, 96);
		assert.strictEqual(result.diagram.nodes[0].bounds.height, 44);
		assert.strictEqual(result.diagram.nodes[0].labelTextOverflow, 'wrap');
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

});

