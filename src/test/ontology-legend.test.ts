import * as assert from 'assert';

import { Bounds, DiagramEdge, DiagramLegendElement, DiagramNode, OntologyDiagramDocument, OntologyFileReference, Point, parseOntologyDiagramYaml } from '../documents/odiagram';
import { ApplyLegendColoringUseCase, CreateLegendElementUseCase, DeleteLegendElementUseCase, UpdateLegendColorByUseCase, UpdateLegendColorsUseCase } from '../diagram-editor/use-cases';
import { defaultOntologyColorPalette } from '../diagram-editor/use-cases/create-legend-element-use-case';
import { createEmbeddedGalleryIcon, embeddedGalleryIconColor } from '../shared/embedded-gallery-icon';
import { ontologyColor } from '../ui/webview/components/ontology-legend';

suite('Ontology legend', () => {
	test('persists the diagram ontology-label setting and legend colours', () => {
		const document = parseOntologyDiagramYaml(`metadata:
  schema_version: "1.0"
  title: Example
  authors: []
  diagram_version: "0.1.0"
  show_ontology_information: true
ontologies: []
namespaces: {}
nodes: []
edges: []
legend_elements:
  - id: legend_item1
    x: 10
    y: 20
    width: 240
    height: 84
    colors:
      core.ttl: "#4E79A7"
    color_mode: background
`);

		assert.strictEqual(document.metadata.showOntologyInformation, true);
		assert.strictEqual(document.legendElements[0].colors.get('core.ttl'), '#4E79A7');
		assert.strictEqual(document.legendElements[0].colorMode, 'background');
		assert.match(JSON.stringify(document.toPersistenceObject()), /show_ontology_information/);
	});

	test('resolves a node icon colour from the active legend', () => {
		const payload = {
			diagram: {
				legend_elements: [{
					id: 'legend_item1', x: 0, y: 0, width: 200, height: 84,
					colors: { class: '#123456' }, color_by: 'elementType' as const,
				}],
			},
			ontology: {
				items: [{ reference: 'ex:Class', displayLabel: 'Class', type: 'class' }],
			},
		};

		assert.strictEqual(ontologyColor('ex:Class', payload), '#123456');
	});

	test('recolors assigned gallery icons when a legend color changes', () => {
		const diagram = new OntologyDiagramDocument(
			OntologyDiagramDocument.createEmpty('Example').metadata,
			[new OntologyFileReference('core.ttl')],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode(
				'node_class',
				'ex:Class',
				new Bounds(0, 0, 100, 50),
				undefined,
				createEmbeddedGalleryIcon('<path d="M0 0h24v24z"/>', 24, 24, '#4E79A7'),
				{ ontology_item_type: 'class' },
			)],
			[],
			[], [], [], {}, [], [new DiagramLegendElement(
				'legend_item1',
				new Bounds(0, 100, 200, 84),
				new Map([['core.ttl', '#4E79A7']]),
				undefined,
				{},
				'border',
				'ontologySource',
			)],
		);

		const updated = new UpdateLegendColorsUseCase().execute(
			diagram,
			'legend_item1',
			{ 'core.ttl': '#123456' },
			'border',
			'ontologySource',
			new Map([['ex:Class', 'core.ttl']]),
		).diagram!;

		assert.strictEqual(embeddedGalleryIconColor(updated.nodes[0].image), '#123456');
	});

	test('recolors assigned gallery icons when the legend grouping changes', () => {
		const diagram = new OntologyDiagramDocument(
			OntologyDiagramDocument.createEmpty('Example').metadata,
			[new OntologyFileReference('core.ttl')],
			new Map([['ex', 'https://example.com/ontology#']]),
			[
				new DiagramNode('node_class', 'ex:Class', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'class' }),
				new DiagramNode(
					'node_individual',
					'ex:Individual',
					new Bounds(120, 0, 100, 50),
					undefined,
					createEmbeddedGalleryIcon('<path d="M0 0h24v24z"/>', 24, 24, '#F28E2B'),
					{ ontology_item_type: 'individual' },
				),
			],
			[],
			[], [], [], {}, [], [new DiagramLegendElement(
				'legend_item1',
				new Bounds(0, 100, 200, 84),
				new Map([['class', '#4E79A7'], ['individual', '#F28E2B']]),
				undefined,
				{},
				'border',
				'elementType',
			)],
		);

		const updated = new UpdateLegendColorByUseCase().execute(
			diagram,
			'legend_item1',
			'ontologySource',
			new Map([['ex:Class', 'core.ttl'], ['ex:Individual', 'core.ttl']]),
		).diagram!;

		assert.strictEqual(embeddedGalleryIconColor(updated.nodes[1].image), '#4E79A7');
	});

	test('assigns the default palette and removing the legend removes colour assignments', () => {
		const diagram = new OntologyDiagramDocument(
			OntologyDiagramDocument.createEmpty('Example').metadata,
			[new OntologyFileReference('core.ttl'), new OntologyFileReference('extension.ttl')],
			new Map(), [], [],
		);
		const created = new CreateLegendElementUseCase().execute(diagram, { x: 10, y: 20 }).diagram!;

		assert.strictEqual(created.legendElements[0].colors.get('core.ttl'), defaultOntologyColorPalette[0]);
		assert.strictEqual(created.legendElements[0].colors.get('extension.ttl'), defaultOntologyColorPalette[1]);
		assert.strictEqual(new CreateLegendElementUseCase().execute(created, { x: 30, y: 40 }).notification, 'The diagram already has an ontology legend.');

		const recolored = new UpdateLegendColorsUseCase().execute(created, 'legend_item1', {
			...Object.fromEntries(created.legendElements[0].colors),
			'core.ttl': '#123456',
		}, 'background').diagram!;
		assert.strictEqual(recolored.legendElements[0].colors.get('core.ttl'), '#123456');
		assert.strictEqual(recolored.legendElements[0].colorMode, 'background');

		const removed = new DeleteLegendElementUseCase().execute(recolored, 'legend_item1').diagram!;
		assert.strictEqual(removed.legendElements.length, 0);
	});

	test('rebuilds legend colours from element types and supports disabling colouring', () => {
		const diagram = new OntologyDiagramDocument(
			OntologyDiagramDocument.createEmpty('Example').metadata,
			[new OntologyFileReference('core.ttl')],
			new Map([['ex', 'https://example.com/ontology#'], ['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[
				new DiagramNode('node_class', 'ex:Class', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'class' }),
				new DiagramNode('node_individual', 'ex:Individual', new Bounds(200, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' }),
			],
			[
				new DiagramEdge('edge_subclass', 'node_class', 'node_individual', 'rdfs:subClassOf', new Point(150, 25), [new Point(100, 25), new Point(200, 25)], undefined, { ontology_item_type: 'subclassRelationship' }),
			],
		);
		const withLegend = new CreateLegendElementUseCase().execute(diagram, { x: 10, y: 20 }).diagram!;

		const typeLegend = new UpdateLegendColorByUseCase().execute(withLegend, 'legend_item1', 'elementType').diagram!;
		assert.strictEqual(typeLegend.legendElements[0].colorBy, 'elementType');
		assert.deepStrictEqual([...typeLegend.legendElements[0].colors.keys()], ['class', 'individual', 'subclassRelationship']);
		assert.strictEqual(typeLegend.legendElements[0].colors.get('class'), defaultOntologyColorPalette[0]);
		assert.strictEqual(typeLegend.legendElements[0].bounds.height, 108);
		assert.match(JSON.stringify(typeLegend.toPersistenceObject()), /color_by/);

		const uncolored = new UpdateLegendColorByUseCase().execute(typeLegend, 'legend_item1', 'none').diagram!;
		assert.strictEqual(uncolored.legendElements[0].colorBy, 'none');
		assert.deepStrictEqual([...uncolored.legendElements[0].colors], []);
	});

	test('adds colours for new element types without replacing existing legend colours', () => {
		const diagram = new OntologyDiagramDocument(
			OntologyDiagramDocument.createEmpty('Example').metadata,
			[],
			new Map([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_class', 'ex:Class', new Bounds(0, 0, 100, 50), undefined, undefined, { ontology_item_type: 'class' })],
			[],
		);
		const withLegend = new UpdateLegendColorByUseCase().execute(
			new CreateLegendElementUseCase().execute(diagram, { x: 10, y: 20 }).diagram!,
			'legend_item1',
			'elementType',
		).diagram!;
		const withNewIndividual = new OntologyDiagramDocument(
			withLegend.metadata,
			withLegend.ontologies,
			withLegend.namespaces,
			[...withLegend.nodes, new DiagramNode('node_individual', 'ex:Individual', new Bounds(200, 0, 100, 50), undefined, undefined, { ontology_item_type: 'individual' })],
			withLegend.edges,
			withLegend.notes,
			withLegend.images,
			withLegend.labels,
			withLegend.extra,
			withLegend.metadataElements,
			withLegend.legendElements.map((legend) => new DiagramLegendElement(legend.id.value, legend.bounds, new Map([['class', '#123456']]), legend.style, legend.extra, legend.colorMode, legend.colorBy)),
		);

		const updated = new ApplyLegendColoringUseCase().execute(withNewIndividual).diagram!;
		assert.strictEqual(updated.legendElements[0].colors.get('class'), '#123456');
		assert.strictEqual(updated.legendElements[0].colors.get('individual'), defaultOntologyColorPalette[1]);
		assert.strictEqual(updated.legendElements[0].bounds.height, 84);
	});
});
