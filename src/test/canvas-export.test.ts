import * as assert from 'assert';

import { createEmbeddedGalleryIcon } from '../shared/embedded-gallery-icon';
import { createSvgExportCommand } from '../ui/webview/components/canvas-export';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';
import type { WebviewTheme } from '../ui/webview/webview-theme';

suite('Canvas export', () => {
	test('exports the full edge label centered at its persisted coordinates', () => {
		const payload: DiagramPayload = {
			diagram: {
				nodes: [
					{ id: 'source', ontology_ref: 'ex:Source', x: 10, y: 40, width: 80, height: 40 },
					{ id: 'target', ontology_ref: 'ex:Target', x: 260, y: 40, width: 80, height: 40 },
				],
				edges: [{
					id: 'edge_relationship',
					source: 'source',
					target: 'target',
					ontology_ref: 'ex:relationship',
					label: { x: 175, y: 24 },
					points: [{ x: 90, y: 60 }, { x: 260, y: 60 }],
					style: {
						font: {
							family: 'Arial',
							size: 16,
							bold: true,
						},
					},
				}],
			},
			ontology: {
				items: [{
					reference: 'ex:relationship',
					displayLabel: 'owns a complete & descriptive relationship',
					type: 'objectProperty',
				}],
			},
		};

		const command = createSvgExportCommand(payload, testTheme);
		assert.ok(command);
		assert.match(command.content, /<text x="175" y="24"[^>]*font-size="16"[^>]*font-weight="700"/u);
		assert.match(command.content, />owns a complete &amp; descriptive relationship<\/tspan>/u);
		assert.doesNotMatch(command.content, /clip_edge_relationship/u);
	});

	test('exports cardinality labels centered at their persisted coordinates', () => {
		const payload: DiagramPayload = {
			diagram: {
				nodes: [
					{ id: 'source', ontology_ref: 'ex:Source', x: 10, y: 40, width: 80, height: 40 },
					{ id: 'target', ontology_ref: 'ex:Target', x: 260, y: 40, width: 80, height: 40 },
				],
				edges: [{
					id: 'edge_cardinality',
					source: 'source',
					target: 'target',
					ontology_ref: 'ex:relationship',
					label: { x: 175, y: 24 },
					source_cardinality_label: { x: 105, y: 42 },
					target_cardinality_label: { x: 245, y: 42 },
					points: [{ x: 90, y: 60 }, { x: 260, y: 60 }],
				}],
			},
			ontology: {
				property_cardinalities: [
					{ propertyReference: 'ex:relationship', classReference: 'ex:Source', minimum: 1, maximum: 3 },
					{ propertyReference: 'ex:relationship', classReference: 'ex:Target', minimum: 0, maximum: 5 },
				],
			},
		};

		const command = createSvgExportCommand(payload, testTheme);
		assert.ok(command);
		assert.match(command.content, /<text x="105" y="42"[^>]*>[\s\S]*?>1\.\.3<\/tspan>/u);
		assert.match(command.content, /<text x="245" y="42"[^>]*>[\s\S]*?>0\.\.5<\/tspan>/u);
	});

	test('exports a long standalone label in full at its canvas center', () => {
		const payload: DiagramPayload = {
			diagram: {
				labels: [{
					id: 'label_long',
					x: 100,
					y: 60,
					width: 80,
					height: 24,
					text: 'A complete standalone label that is wider than its element',
				}],
			},
		};

		const command = createSvgExportCommand(payload, testTheme);
		assert.ok(command);
		assert.match(command.content, /<text x="140" y="72"[^>]*>/u);
		assert.match(command.content, />A complete standalone label that is wider than its element<\/tspan>/u);
		assert.doesNotMatch(command.content, /clip_label_long/u);

		const viewBox = command.content.match(/viewBox="([^"]+)"/u)?.[1].split(' ').map(Number);
		assert.ok(viewBox);
		assert.ok(viewBox[0] < 100);
		assert.ok(viewBox[2] > 128);
	});

	test('exports match-width node images at the node bounding-box width', () => {
		const image = createEmbeddedGalleryIcon('<path d="M0 0h32v16H0z"/>', 32, 16);
		const payload: DiagramPayload = {
			diagram: {
				nodes: [{
					id: 'node_department',
					ontology_ref: 'ex:Department',
					x: 16,
					y: 12,
					width: 208,
					height: 156,
					image,
					style: { image_fit: 'match_width' },
				}],
				edges: [],
			},
		};

		const command = createSvgExportCommand(payload, testTheme);
		assert.ok(command);
		assert.match(command.content, /<svg x="16" y="20" width="208" height="100" overflow="hidden"><image [^>]*x="0" y="0" width="208" height="104" preserveAspectRatio="xMidYMid meet"\/><\/svg>/u);
	});

	test('uses configured white and transparent diagram backgrounds', () => {
		const content = (canvasBackground: 'white' | 'transparent'): string => {
			const command = createSvgExportCommand({
				diagram: {
					metadata: { canvas_background: canvasBackground },
					labels: [{ id: 'label_title', x: 10, y: 10, width: 80, height: 24, text: 'Title' }],
				},
			}, { ...testTheme, canvasBackground: '#123456' });
			assert.ok(command);
			return command.content;
		};

		assert.match(content('white'), /<rect[^>]*fill="#FFFFFF"\/>/u);
		assert.match(content('transparent'), /<rect[^>]*fill="transparent"\/>/u);
		const darkCommand = createSvgExportCommand({
			diagram: {
				metadata: { canvas_background: 'white' },
				labels: [{ id: 'label_title', x: 10, y: 10, width: 80, height: 24, text: 'Title' }],
			},
		}, { ...testTheme, mode: 'dark', canvasBackground: '#123456' });
		assert.ok(darkCommand);
		assert.match(darkCommand.content, /<rect[^>]*fill="#000000"\/>/u);
	});
});

const testTheme: WebviewTheme = {
	mode: 'light',
	canvasBackground: '#FFFFFF',
	containmentBackgrounds: ['#E8EEF8'],
	containmentBorders: ['#375A8C'],
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
