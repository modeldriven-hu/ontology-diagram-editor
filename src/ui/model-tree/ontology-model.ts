export type OntologyItemType =
	| 'class'
	| 'objectProperty'
	| 'objectPropertyAssertion'
	| 'dataProperty'
	| 'annotationProperty'
	| 'subclassRelationship'
	| 'individual'
	| 'datatype';

export interface OntologyItem {
	readonly type: OntologyItemType;
	readonly reference: string;
	readonly displayLabel: string;
	readonly sourceOntologyPath: string;
	readonly metadata: OntologyItemMetadata;
}

export interface OntologyItemMetadata {
	readonly iri?: string;
	readonly relationshipReference?: string;
	readonly displayLabels: readonly string[];
	readonly superclassReferences?: readonly string[];
	readonly equivalentClassReferences?: readonly string[];
	readonly assertedClassReferences?: readonly string[];
	readonly propertyAssertions?: readonly OntologyPropertyAssertion[];
	readonly domainReferences?: readonly string[];
	readonly rangeReferences?: readonly string[];
	readonly propertyCardinalities?: readonly OntologyPropertyCardinality[];
	readonly comments?: readonly string[];
	readonly annotations?: readonly OntologyAnnotation[];
	readonly subclassReference?: string;
	readonly superclassReference?: string;
	readonly edgeOntologyRef?: string;
	readonly sourceOntologyRef?: string;
	readonly targetOntologyRef?: string;
	readonly targetNodeType?: 'class' | 'datatype' | 'individual';
}

export interface OntologyAnnotation {
	readonly propertyReference: string;
	readonly value: string;
	readonly valueType: 'literal' | 'resource';
	readonly datatypeReference?: string;
	readonly language?: string;
}

export interface OntologyPropertyCardinality {
	readonly propertyReference: string;
	readonly minimum?: number;
	readonly maximum?: number;
}

export interface OntologyPropertyAssertion {
	readonly propertyReference: string;
	readonly value: string;
	readonly valueType: 'literal' | 'resource';
	readonly datatypeReference?: string;
	readonly language?: string;
}

export interface LoadedOntology {
	readonly relativePath: string;
	readonly absolutePath: string;
	readonly items: readonly OntologyItem[];
	readonly ontologyIri?: string;
	readonly error?: string;
}
export const ontologyFileExtensions = ['ttl', 'rdf', 'owl', 'xml', 'jsonld', 'nt'] as const;
const itemTypeLabels: Record<OntologyItemType, string> = {
	class: 'Classes',
	objectProperty: 'Object properties',
	objectPropertyAssertion: 'Object property assertions',
	dataProperty: 'Data properties',
	annotationProperty: 'Annotation properties',
	subclassRelationship: 'Subclass relationships',
	individual: 'Individuals',
	datatype: 'Datatypes',
};

const itemTypeOrder: readonly OntologyItemType[] = [
	'class',
	'objectProperty',
	'dataProperty',
	'annotationProperty',
	'subclassRelationship',
	'individual',
	'objectPropertyAssertion',
	'datatype',
];

export function getOntologyItemTypeLabel(type: OntologyItemType): string {
	return itemTypeLabels[type];
}

export function getOntologyItemTypeOrder(): readonly OntologyItemType[] {
	return itemTypeOrder;
}

export { findOntologyImportPaths, isPotentialOntologyFilePath, loadReferencedOntologies } from './ontology-loader';
