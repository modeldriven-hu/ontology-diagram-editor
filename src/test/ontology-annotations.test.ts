import * as assert from 'assert';

import { ontologyAnnotationFieldsForReference } from '../ui/webview/components/ontology-annotations';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';

suite('Ontology annotations', () => {
	test('formats annotation properties with their display names and language tags', () => {
		const payload: DiagramPayload = {
			diagram: {
				namespaces: {
					ex: 'https://example.com/ontology#',
				},
			},
			ontology: {
				items: [
					{ reference: 'ex:editorialStatus', displayLabel: 'Editorial status', type: 'annotationProperty' },
				],
				annotations: [
					{
						reference: 'ex:Requirement',
						annotations: [
							{
								propertyReference: 'http://www.w3.org/2000/01/rdf-schema#comment',
								value: 'A requirement captured from a stakeholder.',
								valueType: 'literal',
							},
							{
								propertyReference: 'https://example.com/ontology#editorialStatus',
								value: 'reviewed',
								valueType: 'literal',
								language: 'en',
							},
						],
					},
				],
			},
		};

		assert.deepStrictEqual(ontologyAnnotationFieldsForReference('https://example.com/ontology#Requirement', payload), [
			{ label: 'rdfs:comment', value: 'A requirement captured from a stakeholder.' },
			{ label: 'Editorial status (en)', value: 'reviewed' },
		]);
	});
});
