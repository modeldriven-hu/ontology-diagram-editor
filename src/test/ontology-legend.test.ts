import * as assert from 'assert';

import { OntologyDiagramDocument, OntologyFileReference, parseOntologyDiagramYaml } from '../documents/odiagram';
import { CreateLegendElementUseCase, DeleteLegendElementUseCase, UpdateLegendColorsUseCase } from '../diagram-editor/use-cases';
import { defaultOntologyColorPalette } from '../diagram-editor/use-cases/create-legend-element-use-case';

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
});
