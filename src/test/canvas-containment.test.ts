import * as assert from 'assert';

import { createDiagramContainmentIndex } from '../shared/diagram-containment';
import { createSvgExportCommand } from '../ui/webview/components/canvas-export';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';
import { containmentColorAtDepth, type WebviewTheme } from '../ui/webview/webview-theme';

suite('Canvas containment', () => {
	test('assigns a distinct palette color to each containment depth', () => {
		const palette = ['lavender', 'mint', 'peach', 'blue'];
		assert.deepStrictEqual(
			[0, 1, 2, 3, 4].map((depth) => containmentColorAtDepth(palette, depth, 'fallback')),
			['lavender', 'mint', 'peach', 'blue', 'lavender'],
		);
	});

	test('indexes recursive parents, children, and depths', () => {
		const index = createDiagramContainmentIndex(
			['node_root', 'node_group', 'node_leaf'],
			[
				{
					id: 'edge_group',
					source: 'node_group',
					target: 'node_root',
					render_as: 'containment',
					containment_direction: 'target_contains_source',
				},
				{
					id: 'edge_leaf',
					source: 'node_group',
					target: 'node_leaf',
					render_as: 'containment',
					containment_direction: 'source_contains_target',
				},
			],
		);

		assert.strictEqual(index.parentByNodeId.get('node_group'), 'node_root');
		assert.strictEqual(index.parentByNodeId.get('node_leaf'), 'node_group');
		assert.deepStrictEqual(index.childrenByNodeId.get('node_root'), ['node_group']);
		assert.strictEqual(index.depthByNodeId.get('node_leaf'), 2);
		assert.deepStrictEqual([...index.containmentEdgeIds], ['edge_group', 'edge_leaf']);
	});

	test('exports containers before descendants without containment edges', () => {
		const command = createSvgExportCommand(containmentPayload, testTheme);
		assert.ok(command);
		const svg = command.content;

		assert.ok(
			svg.indexOf('<rect x="20" y="20" width="260" height="150"')
			< svg.indexOf('<rect x="36" y="76" width="120" height="56"'),
		);
		assert.doesNotMatch(svg, /partOf/);
		assert.doesNotMatch(svg, /edge_partOf/);
		assert.match(svg, />Outer<\/tspan>/);
		assert.match(svg, />Inner<\/tspan>/);
		assert.match(svg, /fill="#E8EEF8"/);
		assert.match(svg, /stroke="#375A8C"/);
		assert.match(svg, /fill="#F3F6FB"/);
		assert.match(svg, /stroke="#6682A8"/);
	});
});

const containmentPayload: DiagramPayload = {
	file: {
		fsPath: '/workspace/containment.odiagram',
		uri: 'file:///workspace/containment.odiagram',
		directory: '/workspace',
	},
	diagram: {
		metadata: {
			title: 'Containment',
		},
		nodes: [
			{ id: 'node_outer', ontology_ref: 'ex:Outer', x: 20, y: 20, width: 260, height: 150 },
			{ id: 'node_inner', ontology_ref: 'ex:Inner', x: 36, y: 76, width: 120, height: 56 },
		],
		edges: [{
			id: 'edge_partOf',
			source: 'node_inner',
			target: 'node_outer',
			ontology_ref: 'ex:partOf',
			label: { x: 900, y: 900 },
			points: [{ x: 900, y: 900 }, { x: 920, y: 920 }],
			render_as: 'containment',
			containment_direction: 'target_contains_source',
		}],
	},
	ontology: {
		items: [
			{ reference: 'ex:Outer', displayLabel: 'Outer container', type: 'class' },
			{ reference: 'ex:Inner', displayLabel: 'Inner item', type: 'class' },
			{ reference: 'ex:partOf', displayLabel: 'partOf', type: 'objectProperty' },
		],
	},
};

const testTheme: WebviewTheme = {
	canvasBackground: '#FFFFFF',
	containmentBackgrounds: ['#E8EEF8', '#F3F6FB'],
	containmentBorders: ['#375A8C', '#6682A8'],
	edgeColor: '#4A4A4A',
	edgeTextColor: '#000000',
	edgeWeight: 1,
	elementShadow: false,
	editorBackground: '#FFFFFF',
	editorForeground: '#000000',
	focusBorder: '#007FD4',
	fontFamily: 'Arial',
	fontSize: 13,
	iconBackground: '#FFFFFF',
	nodeBackground: '#FFFFCC',
	nodeBorder: '#333333',
	nodeCornerRadius: 0,
	nodeFontBold: false,
	nodeFontFamily: 'Arial',
	nodeFontItalic: false,
	nodeFontSize: 13,
	noteBackground: '#CCFFCC',
	noteBorder: '#669966',
	noteCornerRadius: 0,
	noteFoldBackground: '#B8E6B8',
	noteForeground: '#000000',
	shadowColor: 'rgb(0 0 0 / 16%)',
};
