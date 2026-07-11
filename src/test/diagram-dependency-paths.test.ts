import * as assert from 'assert';
import * as path from 'path';

import { DiagramMetadata, OntologyFileReference } from '../documents/odiagram';
import { diagramDependencyPaths } from '../diagram-editor/diagram-dependency-paths';

suite('Diagram dependency paths', () => {
	test('resolves ontology and theme dependencies relative to the diagram', () => {
		const dependencies = diagramDependencyPaths('/workspace/diagrams/example.odiagram', {
			metadata: new DiagramMetadata('1.0', 'Example', [], '0.1.0', '../themes/default.otheme.yml'),
			ontologies: [
				new OntologyFileReference('../ontology/model.ttl'),
				new OntologyFileReference('local.owl'),
			],
		});

		assert.deepStrictEqual(dependencies, [
			{ absolutePath: path.normalize('/workspace/ontology/model.ttl'), kind: 'ontology' },
			{ absolutePath: path.normalize('/workspace/diagrams/local.owl'), kind: 'ontology' },
			{ absolutePath: path.normalize('/workspace/themes/default.otheme.yml'), kind: 'theme' },
		]);
	});

	test('omits empty themes and duplicate ontology paths', () => {
		const dependencies = diagramDependencyPaths('/workspace/example.odiagram', {
			metadata: new DiagramMetadata('1.0', 'Example', [], '0.1.0', '  '),
			ontologies: [
				new OntologyFileReference('model.ttl'),
				new OntologyFileReference('./model.ttl'),
			],
		});

		assert.deepStrictEqual(dependencies, [
			{ absolutePath: path.normalize('/workspace/model.ttl'), kind: 'ontology' },
		]);
	});
});
