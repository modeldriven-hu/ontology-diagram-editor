import * as assert from 'assert';

import { parseOntologyDiagramYaml, stringifyOntologyDiagramYaml } from '../documents/odiagram';
import { CreateDiagramLinkUseCase, DeleteElementsUseCase, UpdateDiagramLinkIconUseCase, UpdateDiagramLinkReferenceUseCase, UpdateElementBoundsUseCase } from '../diagram-editor/use-cases';
import { emptyDiagram } from './support/diagram-builders';

suite('Diagram links', () => {
	test('parses and serializes a relative diagram link with an optional icon', () => {
		const document = parseOntologyDiagramYaml(`${emptyYaml}
diagram_links:
  - id: link_architecture
    x: 25
    y: 35
    width: 160
    height: 112
    diagram_ref: ../architecture/system.odiagram
    icon: data:image/svg+xml;base64,PHN2Zy8+
`);

		assert.strictEqual(document.diagramLinks.length, 1);
		assert.strictEqual(document.diagramLinks[0].diagramRef, '../architecture/system.odiagram');
		assert.strictEqual(document.diagramLinks[0].icon, 'data:image/svg+xml;base64,PHN2Zy8+');
		const serialized = stringifyOntologyDiagramYaml(document);
		assert.match(serialized, /diagram_links:/u);
		assert.match(serialized, /diagram_ref: \.\.\/architecture\/system\.odiagram/u);
	});

	test('rejects absolute and non-diagram references', () => {
		assert.throws(() => parseOntologyDiagramYaml(linkYaml('/tmp/target.odiagram')), /relative/u);
		assert.throws(() => parseOntologyDiagramYaml(linkYaml('target.yaml')), /\.odiagram/u);
	});

	test('creates, edits, moves, and deletes a diagram link', () => {
		const created = new CreateDiagramLinkUseCase().execute(emptyDiagram(), 'details/domain.odiagram', { x: 10.4, y: 20.6 }).diagram;
		assert.ok(created);
		assert.strictEqual(created.diagramLinks[0].id.value, 'link_item1');
		assert.deepStrictEqual(created.diagramLinks[0].bounds.toPersistenceObject(), { x: 10, y: 21, width: 160, height: 112 });

		const referenced = new UpdateDiagramLinkReferenceUseCase().execute(created, 'link_item1', '../domain.odiagram').diagram;
		assert.ok(referenced);
		assert.strictEqual(referenced.diagramLinks[0].diagramRef, '../domain.odiagram');

		const icon = 'data:image/svg+xml;base64,PHN2Zy8+';
		const customized = new UpdateDiagramLinkIconUseCase().execute(referenced, 'link_item1', icon).diagram;
		assert.ok(customized);
		assert.strictEqual(customized.diagramLinks[0].icon, icon);

		const moved = new UpdateElementBoundsUseCase().execute(customized, {
			nodeUpdates: [], noteUpdates: [], imageUpdates: [], labelUpdates: [],
			diagramLinkUpdates: [{ id: 'link_item1', x: 40, y: 50, width: 180, height: 120 }],
		}).diagram;
		assert.ok(moved);
		assert.deepStrictEqual(moved.diagramLinks[0].bounds.toPersistenceObject(), { x: 40, y: 50, width: 180, height: 120 });

		const deleted = new DeleteElementsUseCase().execute(moved, ['link_item1']).diagram;
		assert.ok(deleted);
		assert.strictEqual(deleted.diagramLinks.length, 0);
	});
});

const emptyYaml = `metadata:
  schema_version: "1.0"
  title: Links
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces: {}
nodes: []
edges: []`;

function linkYaml(reference: string): string {
	return `${emptyYaml}
diagram_links:
  - id: link_target
    x: 0
    y: 0
    width: 160
    height: 112
    diagram_ref: ${reference}
`;
}
