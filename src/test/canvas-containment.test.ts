import * as assert from 'assert';

import { containmentMovementNodeIds, createDiagramContainmentIndex } from '../shared/diagram-containment';
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

	test('expands moved containers to every descendant exactly once', () => {
		const childrenByNodeId = new Map<string, readonly string[]>([
			['node_root', ['node_group', 'node_leaf']],
			['node_group', ['node_nested']],
		]);

		assert.deepStrictEqual(
			containmentMovementNodeIds(['node_root', 'node_group'], childrenByNodeId),
			['node_root', 'node_group', 'node_nested', 'node_leaf'],
		);
	});

	test('exports containers behind ordinary edges and descendants without containment edges', () => {
		const command = createSvgExportCommand(containmentPayload, testTheme);
		assert.ok(command);
		const svg = command.content;
		const containerIndex = svg.indexOf('<rect x="20" y="20" width="260" height="150"');
		const ordinaryEdgeIndex = svg.indexOf('<polyline points="156,104 160,104"');
		const firstLeafIndex = svg.indexOf('<rect x="36" y="76" width="120" height="56"');

		assert.ok(containerIndex >= 0);
		assert.ok(ordinaryEdgeIndex > containerIndex);
		assert.ok(firstLeafIndex > ordinaryEdgeIndex);
		assert.doesNotMatch(svg, /partOf/);
		assert.doesNotMatch(svg, /edge_partOf/);
		assert.match(svg, />uses API<\/tspan>/);
		assert.match(svg, />Outer container<\/tspan>/);
		assert.match(svg, />Inner item<\/tspan>/);
		assert.match(svg, /fill="#E8EEF8"/);
		assert.match(svg, /stroke="#375A8C"/);
		assert.match(svg, /fill="#F3F6FB"/);
		assert.match(svg, /stroke="#6682A8"/);
	});

	test('exports wrapped node labels on multiple lines', () => {
		const payload: DiagramPayload = {
			...containmentPayload,
			diagram: {
				...containmentPayload.diagram,
				nodes: [{
					id: 'node_service',
					ontology_ref: 'ex:Service',
					x: 20,
					y: 20,
					width: 140,
					height: 72,
					label_text_overflow: 'wrap',
				}],
				edges: [],
			},
			ontology: {
				items: [{
					reference: 'ex:Service',
					displayLabel: 'Application programming interface service',
					type: 'class',
				}],
			},
		};

		const command = createSvgExportCommand(payload, testTheme);
		assert.ok(command);
		assert.match(command.content, />Application<\/tspan>/);
		assert.match(command.content, />programming<\/tspan>/);
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
			{ id: 'node_inner2', ontology_ref: 'ex:Inner2', x: 160, y: 76, width: 100, height: 56 },
		],
		edges: [
			{
				id: 'edge_partOf',
				source: 'node_inner',
				target: 'node_outer',
				ontology_ref: 'ex:partOf',
				label: { x: 900, y: 900 },
				points: [{ x: 900, y: 900 }, { x: 920, y: 920 }],
				render_as: 'containment',
				containment_direction: 'target_contains_source',
			},
			{
				id: 'edge_partOf2',
				source: 'node_inner2',
				target: 'node_outer',
				ontology_ref: 'ex:partOf',
				label: { x: 900, y: 900 },
				points: [{ x: 900, y: 900 }, { x: 920, y: 920 }],
				render_as: 'containment',
				containment_direction: 'target_contains_source',
			},
			{
				id: 'edge_uses',
				source: 'node_inner',
				target: 'node_inner2',
				ontology_ref: 'ex:uses',
				label: { x: 158, y: 104 },
				points: [{ x: 156, y: 104 }, { x: 160, y: 104 }],
				route_layout: 'direct',
			},
		],
	},
	ontology: {
		items: [
			{ reference: 'ex:Outer', displayLabel: 'Outer container', type: 'class' },
			{ reference: 'ex:Inner', displayLabel: 'Inner item', type: 'class' },
			{ reference: 'ex:Inner2', displayLabel: 'Second inner item', type: 'class' },
			{ reference: 'ex:partOf', displayLabel: 'partOf', type: 'objectProperty' },
			{ reference: 'ex:uses', displayLabel: 'uses API', type: 'objectProperty' },
		],
	},
};

const testTheme: WebviewTheme = {
	mode: 'light',
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
