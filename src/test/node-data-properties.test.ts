import * as assert from 'assert';

import type { DiagramNode, DiagramPayload } from '../ui/webview/ontology-diagram-types';
import { availableNodePropertyValueAttributes, nodeCompartmentAttributes, nodeTitleText } from '../ui/webview/components/node-data-properties';

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
});
