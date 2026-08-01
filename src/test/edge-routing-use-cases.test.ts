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

suite('Edge routing use cases', () => {
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

});

