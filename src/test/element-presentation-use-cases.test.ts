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

suite('Element presentation use cases', () => {
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

	test('updates individual type display for one or many nodes', () => {
		const diagram = diagramWithNodes([
			new DiagramNode('node_requirement', 'ex:REQ-001', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }, undefined, true),
			new DiagramNode('node_design', 'ex:DES-001', new Bounds(150, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }, undefined, true),
			new DiagramNode('node_other', 'ex:Other', new Bounds(300, 0, 100, 50)),
		]);

		const stereotyped = new UpdateNodeTypeDisplayUseCase().executeMany(
			diagram,
			['node_requirement', 'node_design'],
			'stereotype',
		);
		assert.ok(stereotyped.diagram);
		assert.deepStrictEqual(stereotyped.diagram.nodes.map((node) => node.typeDisplay), ['stereotype', 'stereotype', undefined]);
		assert.strictEqual(stereotyped.diagram.nodes[0].toPersistenceObject().type_display, 'stereotype');

		const inline = new UpdateNodeTypeDisplayUseCase().execute(stereotyped.diagram, 'node_requirement', 'inline');
		assert.ok(inline.diagram);
		assert.strictEqual(inline.diagram.nodes[0].typeDisplay, undefined);
		assert.strictEqual(inline.diagram.nodes[0].toPersistenceObject().type_display, undefined);
		assert.strictEqual(inline.diagram.nodes[1].typeDisplay, 'stereotype');
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

});

