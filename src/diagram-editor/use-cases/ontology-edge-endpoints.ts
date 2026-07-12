import type { OntologyDiagramDocument } from '../../documents/odiagram';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';

export type ResolvedEdgeEndpointNodeType = 'class' | 'datatype' | 'individual';

export interface ResolvedEdgeEndpoints {
	readonly edgeOntologyRef: string;
	readonly sourceOntologyRef: string;
	readonly targetOntologyRef: string;
	readonly sourceNodeType: ResolvedEdgeEndpointNodeType;
	readonly targetNodeType: ResolvedEdgeEndpointNodeType;
}

export interface EdgeEndpointSelection {
	readonly sourceOntologyRef: string;
	readonly targetOntologyRef: string;
}

export interface EdgeEndpointCandidates {
	readonly edgeOntologyRef: string;
	readonly sourceOntologyRefs: readonly string[];
	readonly targetOntologyRefs: readonly string[];
	readonly sourceNodeType: ResolvedEdgeEndpointNodeType;
	readonly targetNodeType: ResolvedEdgeEndpointNodeType;
}

export function isConnectionCapableOntologyItem(type: string): boolean {
	return type === 'objectProperty'
		|| type === 'dataProperty'
		|| type === 'subclassRelationship'
		|| type === 'objectPropertyAssertion';
}

export function resolveEdgeEndpoints(
	payload: ModelTreeItemDropPayload,
	selection?: EdgeEndpointSelection,
): ResolvedEdgeEndpoints | 'ambiguous' | undefined {
	const candidates = edgeEndpointCandidates(payload);
	if (candidates === undefined) {
		return undefined;
	}

	const sourceOntologyRef = selectedEndpoint(candidates.sourceOntologyRefs, selection?.sourceOntologyRef);
	const targetOntologyRef = selectedEndpoint(candidates.targetOntologyRefs, selection?.targetOntologyRef);
	if (sourceOntologyRef === undefined || targetOntologyRef === undefined) {
		return 'ambiguous';
	}

	return {
		edgeOntologyRef: candidates.edgeOntologyRef,
		sourceOntologyRef,
		targetOntologyRef,
		sourceNodeType: candidates.sourceNodeType,
		targetNodeType: candidates.targetNodeType,
	};
}

export function edgeEndpointCandidates(payload: ModelTreeItemDropPayload): EdgeEndpointCandidates | undefined {
	const metadata = payload.ontologyItemMetadata;
	if (!isObject(metadata)) {
		return undefined;
	}

	if (payload.ontologyItemType === 'objectProperty') {
		return propertyEndpointCandidates(
			payload.ontologyItemReference,
			references(metadata.domainReferences),
			references(metadata.rangeReferences),
			'class',
		);
	}

	if (payload.ontologyItemType === 'dataProperty') {
		return propertyEndpointCandidates(
			payload.ontologyItemReference,
			references(metadata.domainReferences),
			references(metadata.rangeReferences),
			'datatype',
		);
	}

	if (payload.ontologyItemType === 'subclassRelationship') {
		return propertyEndpointCandidates(
			'rdfs:subClassOf',
			optionalReference(metadata.subclassReference),
			optionalReference(metadata.superclassReference),
			'class',
		);
	}

	if (payload.ontologyItemType === 'objectPropertyAssertion') {
		const edge = stringValue(metadata.edgeOntologyRef) ?? payload.ontologyItemReference;
		const targetNodeType = endpointNodeType(metadata.targetNodeType, 'individual');
		return propertyEndpointCandidates(
			edge,
			optionalReference(metadata.sourceOntologyRef),
			optionalReference(metadata.targetOntologyRef),
			targetNodeType,
			'individual',
		);
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

function propertyEndpointCandidates(
	edgeOntologyRef: string,
	sourceOntologyRefs: readonly string[],
	targetOntologyRefs: readonly string[],
	targetNodeType: ResolvedEdgeEndpointNodeType,
	sourceNodeType: ResolvedEdgeEndpointNodeType = 'class',
): EdgeEndpointCandidates {
	return {
		edgeOntologyRef,
		sourceOntologyRefs,
		targetOntologyRefs,
		sourceNodeType,
		targetNodeType,
	};
}

function endpointNodeType(value: unknown, fallback: ResolvedEdgeEndpointNodeType): ResolvedEdgeEndpointNodeType {
	return value === 'class' || value === 'datatype' || value === 'individual' ? value : fallback;
}

function selectedEndpoint(candidates: readonly string[], selected: string | undefined): string | undefined {
	if (candidates.length === 1) {
		return candidates[0];
	}

	return selected !== undefined && candidates.includes(selected) ? selected : undefined;
}

function references(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return uniqueReferences(value.filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0));
}

function optionalReference(value: unknown): readonly string[] {
	const reference = stringValue(value);
	return reference === undefined ? [] : [reference];
}

function uniqueReferences(references: readonly string[]): readonly string[] {
	return [...new Set(references)];
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
