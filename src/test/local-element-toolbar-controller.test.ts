import * as assert from 'assert';

import { edgePresentationFromSelectValue, edgePresentationOptions, edgePresentationSelectValue } from '../ui/webview/engine/local-element-toolbar-controller';
import type { DiagramEdge } from '../ui/webview/ontology-diagram-types';

suite('Local element toolbar controller', () => {
	test('maps the connection presentation to omitted containment fields', () => {
		assert.deepStrictEqual(edgePresentationFromSelectValue('connection'), {});
	});

	test('maps both containment directions atomically', () => {
		assert.deepStrictEqual(edgePresentationFromSelectValue('target_contains_source'), {
			renderAs: 'containment',
			containmentDirection: 'target_contains_source',
		});
		assert.deepStrictEqual(edgePresentationFromSelectValue('source_contains_target'), {
			renderAs: 'containment',
			containmentDirection: 'source_contains_target',
		});
	});

	test('labels containment directions with endpoint names', () => {
		assert.deepStrictEqual(edgePresentationOptions('Task', 'Project'), [
			{ value: 'connection', label: 'Connection' },
			{ value: 'target_contains_source', label: 'Project contains Task' },
			{ value: 'source_contains_target', label: 'Task contains Project' },
		]);
	});

	test('selects the persisted edge presentation', () => {
		assert.strictEqual(edgePresentationSelectValue(edge()), 'connection');
		assert.strictEqual(edgePresentationSelectValue(edge({
			render_as: 'containment',
			containment_direction: 'source_contains_target',
		})), 'source_contains_target');
	});

	test('rejects an unknown presentation value', () => {
		assert.strictEqual(edgePresentationFromSelectValue('unknown'), undefined);
	});
});

function edge(overrides: Partial<DiagramEdge> = {}): DiagramEdge {
	return {
		id: 'edge_1',
		source: 'node_1',
		target: 'node_2',
		ontology_ref: 'example:contains',
		label: { x: 100, y: 50 },
		points: [{ x: 80, y: 50 }, { x: 120, y: 50 }],
		...overrides,
	};
}
