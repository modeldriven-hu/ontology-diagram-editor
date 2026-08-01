import * as assert from 'assert';

import { minimumNodeWithImageHeight, minimumNodeWithImageWidth } from '../shared/canvas-geometry';
import type { DiagramNode, DiagramPayload } from '../ui/webview/ontology-diagram-types';
import { availableNodePropertyValueAttributes, measuredTextWidth, nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeTitleDisplayText, nodeTitleText, requiredMinimumNodeSize } from '../ui/webview/components/node-data-properties';

suite('Node data properties', () => {
	test('keeps a minimum usable image area when minimizing an image node', () => {
		const node: DiagramNode = {
			id: 'node_icon',
			ontology_ref: 'ex:Icon',
			x: 0,
			y: 0,
			width: 240,
			height: 180,
			image: 'data:image/png;base64,aWNvbg==',
		};
		const size = requiredMinimumNodeSize(node, { diagram: {} }, {
			nodeFontSize: 13,
			nodeFontFamily: 'Arial',
			nodeFontBold: true,
			nodeFontItalic: false,
		});

		assert.deepStrictEqual(size, {
			width: minimumNodeWithImageWidth,
			height: minimumNodeWithImageHeight,
		});
		assert.strictEqual(size.height, 88);
	});

	test('uses ontology labels for class node titles', () => {
		const node: DiagramNode = {
			id: 'node_service',
			ontology_ref: 'ex:ApiService',
			x: 0,
			y: 0,
			width: 180,
			height: 72,
			ontology_item_type: 'class',
		};
		const payload: DiagramPayload = {
			diagram: {
				namespaces: {
					ex: 'https://example.com/ontology#',
				},
			},
			ontology: {
				items: [{
					reference: 'https://example.com/ontology#ApiService',
					displayLabel: 'API Service',
					type: 'class',
				}],
			},
		};

		assert.strictEqual(nodeTitleText(node, payload), 'API Service');
	});

	test('truncates node labels by default and wraps them when configured', () => {
		const node: DiagramNode = {
			id: 'node_service',
			ontology_ref: 'ex:ApiService',
			x: 0,
			y: 0,
			width: 90,
			height: 60,
			ontology_item_type: 'class',
		};
		const payload: DiagramPayload = {
			ontology: {
				items: [{
					reference: 'ex:ApiService',
					displayLabel: 'Application programming interface service',
					type: 'class',
				}],
			},
		};
		const displayOptions = {
			node,
			payload,
			width: 70,
			height: 60,
			fontSize: 12,
		};

		assert.match(nodeTitleDisplayText(displayOptions), /\.\.\.$/u);
		const wrapped = nodeTitleDisplayText({
			...displayOptions,
			node: { ...node, label_text_overflow: 'wrap' },
		});
		const lines = wrapped.split('\n');
		assert.ok(lines.length > 1);
		assert.ok(lines.length <= 4);
		assert.ok(lines.every((line) => measuredTextWidth({ text: line, fontSize: 12 }) <= 70));
	});

	test('formats individual type and property value slots', () => {
		const node: DiagramNode = {
			id: 'node_requirement',
			ontology_ref: 'ex:REQ-001',
			x: 0,
			y: 0,
			width: 180,
			height: 72,
			ontology_item_type: 'individual',
			show_property_values: true,
		};
		const payload: DiagramPayload = {
			diagram: {
				namespaces: {
					ex: 'https://example.com/requirements/instances#',
					req: 'https://example.com/requirements#',
				},
			},
			ontology: {
				items: [
					{ reference: 'ex:REQ-001', displayLabel: 'ex:REQ-001', type: 'individual' },
					{ reference: 'ex:REQ-002', displayLabel: 'Password Reset', type: 'individual' },
					{ reference: 'req:FunctionalRequirement', displayLabel: 'Functional Requirement', type: 'class' },
					{ reference: 'req:title', displayLabel: 'title', type: 'dataProperty' },
					{ reference: 'req:dependsOn', displayLabel: 'depends on', type: 'objectProperty' },
				],
				individuals: [
					{
						reference: 'ex:REQ-001',
						displayLabel: 'ex:REQ-001',
						assertedClassReferences: ['https://example.com/requirements#FunctionalRequirement'],
						propertyAssertions: [
							{
								propertyReference: 'https://example.com/requirements#title',
								value: 'User Authentication',
								valueType: 'literal',
							},
							{
								propertyReference: 'https://example.com/requirements#dependsOn',
								value: 'https://example.com/requirements/instances#REQ-002',
								valueType: 'resource',
							},
						],
					},
				],
			},
		};

		assert.strictEqual(nodeTitleText(node, payload), 'REQ-001 : Functional Requirement');
		assert.strictEqual(nodeTitleText({ ...node, type_display: 'stereotype' }, payload), '«Functional Requirement»\nREQ-001');
		assert.strictEqual(nodeTitleDisplayText({
			node: { ...node, type_display: 'stereotype' },
			payload,
			width: 180,
			height: 44,
			fontSize: 12,
		}), '«Functional Requirement»\nREQ-001');
		assert.deepStrictEqual(availableNodePropertyValueAttributes(node, payload).map((attribute) => attribute.text), [
			"title = 'User Authentication'",
			'depends on = Password Reset',
		]);
		assert.deepStrictEqual(nodeCompartmentAttributes({ ...node, show_property_values: false }, payload), []);
		assert.strictEqual(nodeTitleText({ ...node, show_type: false }, payload), 'REQ-001');
	});

	test('wraps individual property value attributes when configured', () => {
		const attributes = [
			{ text: "description = 'Authenticate users with password reset, multi factor enrollment, and recovery codes'" },
		];
		const wrappedNode: DiagramNode = {
			id: 'node_requirement',
			ontology_ref: 'ex:REQ-001',
			x: 0,
			y: 0,
			width: 180,
			height: 72,
			ontology_item_type: 'individual',
			property_value_text_overflow: 'wrap',
		};
		const wrappedLines = nodeAttributeTextLines({
			attributes,
			width: 140,
			fontSize: 12,
			textOverflow: nodeAttributeTextOverflow(wrappedNode),
		});
		const truncatedLines = nodeAttributeTextLines({
			attributes,
			width: 140,
			fontSize: 12,
			textOverflow: nodeAttributeTextOverflow({ ...wrappedNode, property_value_text_overflow: undefined }),
		});

		assert.ok(wrappedLines.length > 1);
		assert.ok(wrappedLines.every((line) => measuredTextWidth({ text: line, fontSize: 12 }) <= 140 || line.length === 1));
		assert.strictEqual(truncatedLines.length, 1);
		assert.match(truncatedLines[0], /\.\.\.$/u);
	});

	test('omits individual property values that point to rendered nodes', () => {
		const node: DiagramNode = {
			id: 'node_requirement',
			ontology_ref: 'ex:REQ-001',
			x: 0,
			y: 0,
			width: 180,
			height: 72,
			ontology_item_type: 'individual',
			show_property_values: true,
		};
		const payload: DiagramPayload = {
			diagram: {
				namespaces: {
					ex: 'https://example.com/requirements/instances#',
					req: 'https://example.com/requirements#',
				},
				nodes: [
					node,
					{
						id: 'node_dependency',
						ontology_ref: 'ex:REQ-002',
						x: 220,
						y: 0,
						width: 180,
						height: 72,
						ontology_item_type: 'individual',
					},
				],
			},
			ontology: {
				items: [
					{ reference: 'ex:REQ-001', displayLabel: 'REQ-001', type: 'individual' },
					{ reference: 'ex:REQ-002', displayLabel: 'Password Reset', type: 'individual' },
					{ reference: 'req:title', displayLabel: 'title', type: 'dataProperty' },
					{ reference: 'req:dependsOn', displayLabel: 'depends on', type: 'objectProperty' },
					{ reference: 'req:priority', displayLabel: 'priority', type: 'dataProperty' },
					{ reference: 'https://example.com/requirements#High', displayLabel: 'High', type: 'individual' },
				],
				individuals: [
					{
						reference: 'ex:REQ-001',
						displayLabel: 'REQ-001',
						assertedClassReferences: [],
						propertyAssertions: [
							{
								propertyReference: 'https://example.com/requirements#title',
								value: 'User Authentication',
								valueType: 'literal',
							},
							{
								propertyReference: 'https://example.com/requirements#dependsOn',
								value: 'https://example.com/requirements/instances#REQ-002',
								valueType: 'resource',
							},
							{
								propertyReference: 'https://example.com/requirements#priority',
								value: 'https://example.com/requirements#High',
								valueType: 'resource',
							},
						],
					},
				],
			},
		};

		assert.deepStrictEqual(availableNodePropertyValueAttributes(node, payload).map((attribute) => attribute.text), [
			"title = 'User Authentication'",
			'priority = High',
		]);
	});
});
