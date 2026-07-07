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

	test('shows object property assertion endpoints in tree description', () => {
		const requirement = ontologyItem('individual', 'ex:REQ-001', 'REQ-001');
		const service = ontologyItem('class', 'ex:AuthenticationService', 'AuthenticationService');
		const appliesTo = ontologyItem('objectPropertyAssertion', 'req:appliesTo', 'REQ-001 appliesTo AuthenticationService', {
			edgeOntologyRef: 'req:appliesTo',
			sourceOntologyRef: 'ex:REQ-001',
			targetOntologyRef: 'ex:AuthenticationService',
			targetNodeType: 'class',
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [requirement, service, appliesTo],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:req:appliesTo:REQ-001',
			label: appliesTo.displayLabel,
			ontology,
			item: appliesTo,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, '(REQ-001, AuthenticationService)');
		assert.ok(String(item.tooltip).includes('Reference: req:appliesTo'));
		assert.ok(String(item.tooltip).includes('Source: REQ-001 (ex:REQ-001)'));
		assert.ok(String(item.tooltip).includes('Target: AuthenticationService (ex:AuthenticationService)'));
	});

	test('shows individual asserted class instead of reference in tree description', () => {
		const service = ontologyItem('class', 'https://example.com/ontology#AuthenticationService', 'AuthenticationService');
		const instance = ontologyItem('individual', 'https://example.com/ontology#auth-service-1', 'auth-service-1', {
			assertedClassReferences: ['https://example.com/ontology#AuthenticationService'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [service, instance],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:https://example.com/ontology#auth-service-1',
			label: instance.displayLabel,
			ontology,
			item: instance,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, 'AuthenticationService');
		assert.ok(String(item.tooltip).includes('Reference: https://example.com/ontology#auth-service-1'));
	});

	test('does not show individual reference in tree description when class is unknown', () => {
		const instance = ontologyItem('individual', 'https://example.com/ontology#auth-service-1', 'auth-service-1');
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [instance],
		};

		const item = new ModelTree().getTreeItem({
			kind: 'ontologyItem',
			id: 'item:https://example.com/ontology#auth-service-1',
			label: instance.displayLabel,
			ontology,
			item: instance,
		} as Parameters<ModelTree['getTreeItem']>[0]);

		assert.strictEqual(item.description, undefined);
		assert.ok(String(item.tooltip).includes('Reference: https://example.com/ontology#auth-service-1'));
	});

	test('groups individuals by asserted class and sorts each group by name', () => {
		const task = ontologyItem('class', 'ex:Task', 'Task');
		const service = ontologyItem('class', 'ex:Service', 'Service');
		const zetaTask = ontologyItem('individual', 'ex:zeta-task', 'Zeta task', {
			assertedClassReferences: ['ex:Task'],
		});
		const alphaTask = ontologyItem('individual', 'ex:alpha-task', 'Alpha task', {
			assertedClassReferences: ['ex:Task'],
		});
		const betaService = ontologyItem('individual', 'ex:beta-service', 'Beta service', {
			assertedClassReferences: ['ex:Service'],
		});
		const untyped = ontologyItem('individual', 'ex:untyped', 'Untyped');
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [zetaTask, task, untyped, service, betaService, alphaTask],
		};
		const tree = new ModelTree();
		const ontologyFileNode = {
			kind: 'ontologyFile',
			id: 'ontology:model.ttl',
			label: 'model.ttl',
			ontology,
		} as Parameters<ModelTree['getChildren']>[0];

		const itemTypeGroups = modelTreeChildren(tree, ontologyFileNode);
		const individualsGroup = itemTypeGroups.find((node) => node.label === 'Individuals');
		assert.ok(individualsGroup);

		const individualTypeGroups = modelTreeChildren(tree, individualsGroup);
		assert.deepStrictEqual(individualTypeGroups.map((node) => node.label), ['Service', 'Task', 'No asserted type']);
		assert.deepStrictEqual(individualTypeGroups.map((node) => tree.getTreeItem(node).description), ['1', '2', '1']);

		const taskItems = modelTreeChildren(tree, individualTypeGroups[1]);
		assert.deepStrictEqual(taskItems.map((node) => node.label), ['Alpha task', 'Zeta task']);

		const serviceItems = modelTreeChildren(tree, individualTypeGroups[0]);
		assert.deepStrictEqual(serviceItems.map((node) => node.label), ['Beta service']);

		const untypedItems = modelTreeChildren(tree, individualTypeGroups[2]);
		assert.deepStrictEqual(untypedItems.map((node) => node.label), ['Untyped']);

		const taskParent = modelTreeParent(tree, taskItems[0]);
		assert.strictEqual(taskParent.label, 'Task');
	});
});

function modelTreeChildren(
	tree: ModelTree,
	node: Parameters<ModelTree['getChildren']>[0],
): readonly Parameters<ModelTree['getTreeItem']>[0][] {
	const children = tree.getChildren(node);
	assert.ok(Array.isArray(children));
	return children as readonly Parameters<ModelTree['getTreeItem']>[0][];
}

function modelTreeParent(
	tree: ModelTree,
	node: Parameters<ModelTree['getTreeItem']>[0],
): Parameters<ModelTree['getTreeItem']>[0] {
	const parent = tree.getParent(node);
	assert.ok(parent !== undefined);
	return parent as Parameters<ModelTree['getTreeItem']>[0];
}

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
