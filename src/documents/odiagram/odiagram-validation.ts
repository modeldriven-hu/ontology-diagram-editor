import { DiagramEdge, OntologyDiagramDocument, OntologyDiagramValidationError } from './odiagram-model';

export function validateDocument(document: OntologyDiagramDocument): void {
	const issues = [
		...validateUniqueElementIds(document),
		...validateEdgeReferences(document),
		...validateContainmentRelationships(document),
		...validateOntologyReferencePrefixes(document),
		...validateUniqueOntologyPaths(document),
	];

	if (issues.length > 0) {
		throw new OntologyDiagramValidationError('Invalid .odiagram document.', issues);
	}
}

function validateContainmentRelationships(document: OntologyDiagramDocument): string[] {
	const issues: string[] = [];
	const nodeIds = new Set(document.nodes.map((node) => node.id.value));
	const parentByChild = new Map<string, string>();

	for (const edge of document.edges) {
		if (edge.renderAs !== 'containment') {
			if (edge.containmentDirection !== undefined) {
				issues.push(`Edge "${edge.id.value}" has a containment direction but is not rendered as containment.`);
			}
			continue;
		}
		if (edge.containmentDirection === undefined) {
			issues.push(`Containment edge "${edge.id.value}" must specify containment_direction.`);
			continue;
		}
		if (!nodeIds.has(edge.source.value) || !nodeIds.has(edge.target.value)) {
			issues.push(`Containment edge "${edge.id.value}" must connect two ontology nodes.`);
			continue;
		}

		const endpoints = containmentEndpoints(edge);
		if (endpoints.parentNodeId === endpoints.childNodeId) {
			issues.push(`Containment edge "${edge.id.value}" cannot contain a node inside itself.`);
			continue;
		}

		const existingParent = parentByChild.get(endpoints.childNodeId);
		if (existingParent !== undefined && existingParent !== endpoints.parentNodeId) {
			issues.push(`Node "${endpoints.childNodeId}" cannot be contained by both "${existingParent}" and "${endpoints.parentNodeId}".`);
			continue;
		}
		parentByChild.set(endpoints.childNodeId, endpoints.parentNodeId);
	}

	for (const nodeId of nodeIds) {
		const visited = new Set<string>();
		let current: string | undefined = nodeId;
		while (current !== undefined) {
			if (visited.has(current)) {
				issues.push(`Containment relationships contain a cycle involving node "${current}".`);
				break;
			}
			visited.add(current);
			current = parentByChild.get(current);
		}
	}

	return [...new Set(issues)];
}

export function containmentEndpoints(edge: DiagramEdge): {
	readonly parentNodeId: string;
	readonly childNodeId: string;
} {
	return edge.containmentDirection === 'source_contains_target'
		? { parentNodeId: edge.source.value, childNodeId: edge.target.value }
		: { parentNodeId: edge.target.value, childNodeId: edge.source.value };
}

function validateUniqueElementIds(document: OntologyDiagramDocument): string[] {
	const ids = [
		...document.nodes.map((node) => node.id.value),
		...document.edges.map((edge) => edge.id.value),
		...document.notes.map((note) => note.id.value),
		...document.images.map((image) => image.id.value),
		...document.labels.map((label) => label.id.value),
		...document.metadataElements.map((element) => element.id.value),
		...document.legendElements.map((element) => element.id.value),
		...document.diagramLinks.map((link) => link.id.value),
	];
	const seen = new Set<string>();
	const duplicates = ids.filter((id) => {
		if (seen.has(id)) {
			return true;
		}
		seen.add(id);
		return false;
	});

	return [...new Set(duplicates)].map((id) => `Duplicate element identifier "${id}".`);
}

function validateEdgeReferences(document: OntologyDiagramDocument): string[] {
	const elementIds = new Set([
		...document.nodes.map((node) => node.id.value),
		...document.notes.map((note) => note.id.value),
		...document.images.map((image) => image.id.value),
	]);
	return document.edges.flatMap((edge) => {
		const issues: string[] = [];
		if (!elementIds.has(edge.source.value)) {
			issues.push(`Edge "${edge.id.value}" references missing source element "${edge.source.value}".`);
		}
		if (!elementIds.has(edge.target.value)) {
			issues.push(`Edge "${edge.id.value}" references missing target element "${edge.target.value}".`);
		}
		return issues;
	});
}

function validateOntologyReferencePrefixes(document: OntologyDiagramDocument): string[] {
	const references = [
		...document.nodes.map((node) => ({ id: node.id.value, reference: node.ontologyRef })),
		...document.edges.map((edge) => ({ id: edge.id.value, reference: edge.ontologyRef })),
	];

	return references.flatMap(({ id, reference }) => {
		const compactPrefix = reference.getCompactPrefix();
		if (compactPrefix !== undefined && !document.namespaces.has(compactPrefix)) {
			return [`Element "${id}" uses unknown ontology namespace prefix "${compactPrefix}".`];
		}
		return [];
	});
}

function validateUniqueOntologyPaths(document: OntologyDiagramDocument): string[] {
	const normalizedPaths = document.ontologies.map((ontology) => ontology.path.replaceAll('\\', '/'));
	const seen = new Set<string>();
	const duplicates = normalizedPaths.filter((path) => {
		if (seen.has(path)) {
			return true;
		}
		seen.add(path);
		return false;
	});

	return [...new Set(duplicates)].map((path) => `Duplicate ontology path "${path}".`);
}

