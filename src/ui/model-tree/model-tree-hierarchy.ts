import type { LoadedOntology, OntologyItem } from './ontology-model';
import type { OntologyGroupTreeNode } from './model-tree-types';
import { expandedOntologyReference, ontologyReferencesEqual } from './ontology-reference';
import { ontologyReferenceDisplayName, uniqueStrings } from './model-tree-presentation';

export const untypedIndividualTypeGroupLabel = 'No asserted type';
export const untypedIndividualTypeGroupKey = 'untyped';

export function compareOntologyItemsByDisplayLabel(left: OntologyItem, right: OntologyItem): number {
	return compareText(left.displayLabel, right.displayLabel)
		|| compareText(left.reference, right.reference);
}

export function compareIndividualTypeGroups(left: OntologyGroupTreeNode, right: OntologyGroupTreeNode): number {
	const leftUntyped = left.individualTypeReferences?.length === 0;
	const rightUntyped = right.individualTypeReferences?.length === 0;
	if (leftUntyped !== rightUntyped) {
		return leftUntyped ? 1 : -1;
	}

	return compareText(left.label, right.label)
		|| compareText(left.id, right.id);
}

export function classHierarchyRoots(
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
	classes: readonly OntologyItem[] = ontology.items.filter((item) => item.type === 'class'),
): readonly OntologyItem[] {
	const sortedClasses = [...classes].sort(compareOntologyItemsByDisplayLabel);
	const roots = sortedClasses.filter((item) => classHierarchyParents(ontology, item, namespaces, sortedClasses).length === 0);
	const reachable = new Set<OntologyItem>();
	const markReachable = (item: OntologyItem): void => {
		if (reachable.has(item)) {
			return;
		}

		reachable.add(item);
		for (const child of classHierarchyChildren(ontology, item, namespaces, sortedClasses)) {
			markReachable(child);
		}
	};

	for (const root of roots) {
		markReachable(root);
	}

	// Invalid ontologies can contain subclass cycles. Give each disconnected cyclic
	// component a deterministic root so its classes remain visible in the tree.
	for (const item of sortedClasses) {
		if (!reachable.has(item)) {
			roots.push(item);
			markReachable(item);
		}
	}

	return roots.sort(compareOntologyItemsByDisplayLabel);
}

export function classHierarchyParents(
	ontology: LoadedOntology,
	item: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
	classes: readonly OntologyItem[] = ontology.items.filter((candidate) => candidate.type === 'class'),
): readonly OntologyItem[] {
	const parents = new Set<OntologyItem>();
	for (const reference of item.metadata.superclassReferences ?? []) {
		const parent = classItemForReference(ontology, reference, namespaces, classes);
		if (parent !== undefined && parent !== item) {
			parents.add(parent);
		}
	}

	return [...parents].sort(compareOntologyItemsByDisplayLabel);
}

export function classHierarchyChildren(
	ontology: LoadedOntology,
	item: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
	classes: readonly OntologyItem[] = ontology.items.filter((candidate) => candidate.type === 'class'),
): readonly OntologyItem[] {
	return classes
		.filter((candidate) => classHierarchyParents(ontology, candidate, namespaces, classes).includes(item))
		.sort(compareOntologyItemsByDisplayLabel);
}

export function classAncestorPath(
	ontology: LoadedOntology,
	target: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] | undefined {
	const visit = (
		item: OntologyItem,
		ancestors: readonly string[],
		visited: ReadonlySet<OntologyItem>,
	): readonly string[] | undefined => {
		if (item === target) {
			return ancestors;
		}

		const nextVisited = new Set(visited);
		nextVisited.add(item);
		for (const child of classHierarchyChildren(ontology, item, namespaces)) {
			if (nextVisited.has(child)) {
				continue;
			}

			const result = visit(child, [...ancestors, item.reference], nextVisited);
			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	};

	for (const root of classHierarchyRoots(ontology, namespaces)) {
		const result = visit(root, [], new Set());
		if (result !== undefined) {
			return result;
		}
	}

	return undefined;
}

export function classItemForReference(
	ontology: LoadedOntology,
	reference: string,
	namespaces: ReadonlyMap<string, string>,
	classes: readonly OntologyItem[] = ontology.items.filter((item) => item.type === 'class'),
): OntologyItem | undefined {
	return classes.find((item) => ontologyReferencesEqual(item.reference, reference, namespaces));
}

export function sortedIndividualTypeReferences(
	item: OntologyItem,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	return [...uniqueStrings(item.metadata.assertedClassReferences ?? [])].sort((left, right) =>
		compareText(ontologyReferenceDisplayName(left, ontology, namespaces), ontologyReferenceDisplayName(right, ontology, namespaces))
		|| compareText(left, right),
	);
}

export function individualTypeGroupLabel(
	typeReferences: readonly string[],
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string {
	const displayNames = uniqueStrings(typeReferences.map((reference) => ontologyReferenceDisplayName(reference, ontology, namespaces)));
	return displayNames.length === 0 ? untypedIndividualTypeGroupLabel : displayNames.join(' | ');
}

export function individualTypeGroupKey(typeReferences: readonly string[], namespaces: ReadonlyMap<string, string>): string {
	if (typeReferences.length === 0) {
		return untypedIndividualTypeGroupKey;
	}

	return `typed:${typeReferences
		.map((reference) => encodeURIComponent(expandedOntologyReference(reference, namespaces)))
		.join('|')}`;
}

export function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}


