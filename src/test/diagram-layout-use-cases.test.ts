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

suite('Diagram layout and containment use cases', () => {
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

});

