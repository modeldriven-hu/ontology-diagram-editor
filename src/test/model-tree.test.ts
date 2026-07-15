import * as assert from 'assert';
import * as vscode from 'vscode';

import { Bounds, DiagramMetadata, DiagramNode, OntologyDiagramDocument } from '../documents/odiagram';
import { ModelTree, modelTreeDragMimeType } from '../ui/model-tree/model-tree';
import type { LoadedOntology, OntologyItem } from '../ui/model-tree/ontology-model';

suite('Model tree', () => {
	test('serializes every selected ontology item in one drag payload', async () => {
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [],
		};
		const person = ontologyItem('class', 'ex:Person', 'Person');
		const organization = ontologyItem('class', 'ex:Organization', 'Organization');
		const source = [person, organization].map((item) => ({
			kind: 'ontologyItem',
			id: `item:${item.reference}`,
			label: item.displayLabel,
			ontology,
			item,
		})) as Parameters<ModelTree['handleDrag']>[0];
		const dataTransfer = new vscode.DataTransfer();

		const tree = new ModelTree();
		tree.handleDrag(source, dataTransfer);

		const serialized = await dataTransfer.get(modelTreeDragMimeType)?.asString();
		assert.ok(serialized);
		const payload = JSON.parse(serialized ?? '{}') as { readonly items?: readonly { readonly ontologyItemReference: string }[] };
		assert.deepStrictEqual(payload.items?.map((item) => item.ontologyItemReference), ['ex:Person', 'ex:Organization']);
		assert.deepStrictEqual(tree.getLastDraggedItems().map((item) => item.ontologyItemReference), ['ex:Person', 'ex:Organization']);
	});

	test('shows only unadded addable items and promotes classes whose displayed parent is filtered out', () => {
		const person = ontologyItem('class', 'ex:Person', 'Person');
		const employee = ontologyItem('class', 'ex:Employee', 'Employee', {
			superclassReferences: ['ex:Person'],
		});
		const note = ontologyItem('annotationProperty', 'ex:note', 'note');
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [person, employee, note],
		};
		const tree = new ModelTree();
		const state = tree as unknown as {
			parsedDiagram?: OntologyDiagramDocument;
			unaddedItemsOntologyPath?: string;
		};
		state.parsedDiagram = new OntologyDiagramDocument(
			DiagramMetadata.createEmpty('Example'),
			[],
			new Map<string, string>([['ex', 'https://example.com/ontology#']]),
			[new DiagramNode('node_person', 'ex:Person', new Bounds(0, 0, 160, 80))],
			[],
		);
		state.unaddedItemsOntologyPath = ontology.relativePath;
		const ontologyFileNode = {
			kind: 'ontologyFile',
			id: 'ontology:model.ttl',
			label: 'model.ttl',
			ontology,
		} as Parameters<ModelTree['getChildren']>[0];

		const groups = modelTreeChildren(tree, ontologyFileNode);
		assert.deepStrictEqual(groups.map((node) => node.label), ['Classes']);
		const classes = modelTreeChildren(tree, groups[0]);
		assert.deepStrictEqual(classes.map((node) => node.label), ['Employee']);
	});

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

	test('nests classes under their superclasses', () => {
		const thing = ontologyItem('class', 'ex:Thing', 'Thing');
		const activity = ontologyItem('class', 'ex:Activity', 'Activity', {
			superclassReferences: ['ex:Thing'],
		});
		const agent = ontologyItem('class', 'ex:Agent', 'Agent', {
			superclassReferences: ['ex:Thing'],
		});
		const family = ontologyItem('class', 'ex:Family', 'Family', {
			superclassReferences: ['ex:Agent'],
		});
		const nobleFamily = ontologyItem('class', 'ex:NobleFamily', 'Noble family', {
			superclassReferences: ['ex:Family'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [nobleFamily, activity, family, thing, agent],
		};
		const tree = new ModelTree();
		const classesGroup = ontologyGroup(tree, ontology, 'Classes');

		const roots = modelTreeChildren(tree, classesGroup);
		assert.deepStrictEqual(roots.map((node) => node.label), ['Thing']);
		assert.strictEqual(tree.getTreeItem(roots[0]).collapsibleState, vscode.TreeItemCollapsibleState.Collapsed);

		const thingChildren = modelTreeChildren(tree, roots[0]);
		assert.deepStrictEqual(thingChildren.map((node) => node.label), ['Activity', 'Agent']);
		const agentChildren = modelTreeChildren(tree, thingChildren[1]);
		assert.deepStrictEqual(agentChildren.map((node) => node.label), ['Family']);
		const familyChildren = modelTreeChildren(tree, agentChildren[0]);
		assert.deepStrictEqual(familyChildren.map((node) => node.label), ['Noble family']);
		assert.strictEqual(tree.getTreeItem(familyChildren[0]).collapsibleState, vscode.TreeItemCollapsibleState.None);

		assert.strictEqual(modelTreeParent(tree, familyChildren[0]).label, 'Family');
		assert.strictEqual(modelTreeParent(tree, roots[0]).label, 'Classes');
	});

	test('shows a multiply inherited class below each superclass', () => {
		const agent = ontologyItem('class', 'ex:Agent', 'Agent');
		const organisation = ontologyItem('class', 'ex:Organisation', 'Organisation');
		const cooperative = ontologyItem('class', 'ex:Cooperative', 'Cooperative', {
			superclassReferences: ['ex:Agent', 'ex:Organisation'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [cooperative, organisation, agent],
		};
		const tree = new ModelTree();
		const roots = modelTreeChildren(tree, ontologyGroup(tree, ontology, 'Classes'));

		assert.deepStrictEqual(roots.map((node) => node.label), ['Agent', 'Organisation']);
		const agentChild = modelTreeChildren(tree, roots[0])[0];
		const organisationChild = modelTreeChildren(tree, roots[1])[0];
		assert.strictEqual(agentChild.label, 'Cooperative');
		assert.strictEqual(organisationChild.label, 'Cooperative');
		assert.notStrictEqual(tree.getTreeItem(agentChild).id, tree.getTreeItem(organisationChild).id);
		assert.strictEqual(modelTreeParent(tree, agentChild).label, 'Agent');
		assert.strictEqual(modelTreeParent(tree, organisationChild).label, 'Organisation');
	});

	test('keeps cyclic class hierarchies visible without repeating ancestors', () => {
		const alpha = ontologyItem('class', 'ex:Alpha', 'Alpha', {
			superclassReferences: ['ex:Beta'],
		});
		const beta = ontologyItem('class', 'ex:Beta', 'Beta', {
			superclassReferences: ['ex:Alpha'],
		});
		const ontology: LoadedOntology = {
			relativePath: 'model.ttl',
			absolutePath: '/workspace/model.ttl',
			items: [beta, alpha],
		};
		const tree = new ModelTree();
		const roots = modelTreeChildren(tree, ontologyGroup(tree, ontology, 'Classes'));

		assert.deepStrictEqual(roots.map((node) => node.label), ['Alpha']);
		const children = modelTreeChildren(tree, roots[0]);
		assert.deepStrictEqual(children.map((node) => node.label), ['Beta']);
		assert.deepStrictEqual(modelTreeChildren(tree, children[0]), []);
	});
});

function ontologyGroup(
	tree: ModelTree,
	ontology: LoadedOntology,
	label: string,
): Parameters<ModelTree['getTreeItem']>[0] {
	const ontologyFileNode = {
		kind: 'ontologyFile',
		id: `ontology:${ontology.relativePath}`,
		label: ontology.relativePath,
		ontology,
	} as Parameters<ModelTree['getChildren']>[0];
	const group = modelTreeChildren(tree, ontologyFileNode).find((node) => node.label === label);
	assert.ok(group);
	return group;
}

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
