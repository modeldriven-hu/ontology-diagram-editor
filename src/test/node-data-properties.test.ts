import * as assert from 'assert';

import type { DiagramNode, DiagramPayload } from '../ui/webview/ontology-diagram-types';
import { availableNodePropertyValueAttributes, measuredTextWidth, nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeTitleText } from '../ui/webview/components/node-data-properties';

suite('Node data properties', () => {
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
