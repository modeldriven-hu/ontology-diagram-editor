import type { OntologyDiagramDocument } from '../../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';

export interface ResolvedEdgeEndpoints {
	readonly edgeOntologyRef: string;
	readonly sourceOntologyRef: string;
	readonly targetOntologyRef: string;
	readonly sourceNodeType: 'class';
	readonly targetNodeType: 'class' | 'datatype';
}

export function isConnectionCapableOntologyItem(type: string): boolean {
	return type === 'objectProperty' || type === 'dataProperty' || type === 'subclassRelationship';
}

export function resolveEdgeEndpoints(payload: ModelTreeItemDropPayload): ResolvedEdgeEndpoints | 'ambiguous' | undefined {
	const metadata = payload.ontologyItemMetadata;
	if (!isObject(metadata)) {
		return undefined;
	}

	if (payload.ontologyItemType === 'objectProperty') {
		const source = singleString(metadata.domainReferences);
		const target = singleString(metadata.rangeReferences);
		return resolvedPropertyEndpoints(payload.ontologyItemReference, source, target, 'class');
	}

	if (payload.ontologyItemType === 'dataProperty') {
		const source = singleString(metadata.domainReferences);
		const target = singleString(metadata.rangeReferences);
		return resolvedPropertyEndpoints(payload.ontologyItemReference, source, target, 'datatype');
	}

	if (payload.ontologyItemType === 'subclassRelationship') {
		const source = stringValue(metadata.subclassReference);
		const target = stringValue(metadata.superclassReference);
		return resolvedPropertyEndpoints('rdfs:subClassOf', source, target, 'class');
	}

	return undefined;
}

export function namespacesWithRequiredEdgePrefixes(
	diagram: OntologyDiagramDocument,
	resolved: ResolvedEdgeEndpoints,
): OntologyDiagramDocument['namespaces'] {
	if (resolved.edgeOntologyRef !== 'rdfs:subClassOf' || diagram.namespaces.has('rdfs')) {
		return diagram.namespaces;
	}

	return new Map([
		...diagram.namespaces,
		['rdfs', 'http://www.w3.org/2000/01/rdf-schema#'],
	]);
}

export function ontologyReferencesEqual(left: string, right: string, namespaces: ReadonlyMap<string, string>): boolean {
	if (left === right) {
		return true;
	}

	return expandedOntologyReference(left, namespaces) === expandedOntologyReference(right, namespaces);
}

export function expandedOntologyReference(value: string, namespaces: ReadonlyMap<string, string>): string {
	if (value.includes('://')) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0) {
		return value;
	}

	const namespace = namespaces.get(value.slice(0, separatorIndex));
	return namespace === undefined ? value : `${namespace}${value.slice(separatorIndex + 1)}`;
}

function resolvedPropertyEndpoints(
	edgeOntologyRef: string,
	sourceOntologyRef: string | 'ambiguous' | undefined,
	targetOntologyRef: string | 'ambiguous' | undefined,
	targetNodeType: 'class' | 'datatype',
): ResolvedEdgeEndpoints | 'ambiguous' {
	if (sourceOntologyRef === 'ambiguous' || targetOntologyRef === 'ambiguous' || sourceOntologyRef === undefined || targetOntologyRef === undefined) {
		return 'ambiguous';
	}

	return {
		edgeOntologyRef,
		sourceOntologyRef,
		targetOntologyRef,
		sourceNodeType: 'class',
		targetNodeType,
	};
}

function singleString(value: unknown): string | 'ambiguous' | undefined {
	if (!Array.isArray(value) || value.length !== 1) {
		return value === undefined ? undefined : 'ambiguous';
	}

	return typeof value[0] === 'string' && value[0].length > 0 ? value[0] : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
