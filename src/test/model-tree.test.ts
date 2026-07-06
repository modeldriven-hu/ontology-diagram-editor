import * as assert from 'assert';

import { ModelTree } from '../ui/model-tree/model-tree';
import type { LoadedOntology, OntologyItem } from '../ui/model-tree/ontology-model';

suite('Model tree', () => {
	test('does not show class references in tree description', () => {
		const requirement = ontologyItem('class', 'https://example.com/ontology#Requirement', 'Requirement');
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [requirement],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:Requirement',
			label: requirement.displayLabel,
			ontology,
			item: requirement,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, undefined);
		assert.ok(String(item.tooltip).includes('Reference: https://example.com/ontology#Requirement'));
	});

	test('shows object property endpoint names instead of reference in tree description', () => {
		const requirement = ontologyItem('class', 'ex:Requirement', 'Requirement');
		const domain = ontologyItem('class', 'ex:Domain', 'Domain');
		const appliesTo = ontologyItem('objectProperty', 'ex:appliesTo', 'applies to', {
			domainReferences: ['ex:Requirement'],
			rangeReferences: ['ex:Domain'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [requirement, domain, appliesTo],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:ex:appliesTo',
			label: appliesTo.displayLabel,
			ontology,
			item: appliesTo,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, '(Requirement, Domain)');
		assert.ok(String(item.tooltip).includes('Reference: ex:appliesTo'));
		assert.ok(String(item.tooltip).includes('Domain: Requirement (ex:Requirement)'));
		assert.ok(String(item.tooltip).includes('Range: Domain (ex:Domain)'));
	});

	test('shows data property domain and datatype range in tree description', () => {
		const requirement = ontologyItem('class', 'ex:Requirement', 'Requirement');
		const identifier = ontologyItem('dataProperty', 'ex:identifier', 'identifier', {
			domainReferences: ['ex:Requirement'],
			rangeReferences: ['rdfs:Literal'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [requirement, identifier],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:ex:identifier',
			label: identifier.displayLabel,
			ontology,
			item: identifier,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, '(Requirement, Literal)');
		assert.ok(String(item.tooltip).includes('Reference: ex:identifier'));
		assert.ok(String(item.tooltip).includes('Domain: Requirement (ex:Requirement)'));
		assert.ok(String(item.tooltip).includes('Range: Literal (rdfs:Literal)'));
	});
});

function ontologyItem(
	type: OntologyItem['type'],
	reference: string,
	displayLabel: string,
	metadata: Partial<OntologyItem['metadata']> = {},
): OntologyItem {
	return {
		type,
		reference,
		displayLabel,
		sourceOntologyPath: 'model.ttl',
		metadata: {
			displayLabels: [displayLabel],
			...metadata,
		},
	};
}
