import * as path from 'path';
import { createReadStream } from 'fs';

import { OntologyDiagramDocument } from '../../documents/odiagram';

interface RdfTerm {
	readonly termType: string;
	readonly value: string;
}

interface RdfQuad {
	readonly subject: RdfTerm;
	readonly predicate: RdfTerm;
	readonly object: RdfTerm;
}

interface RdfQuadStream {
	on(event: 'data', listener: (quad: RdfQuad) => void): RdfQuadStream;
	on(event: 'error', listener: (error: Error) => void): RdfQuadStream;
	on(event: 'end', listener: () => void): RdfQuadStream;
}

interface RdfParser {
	parse(stream: NodeJS.ReadableStream, options: { readonly path: string; readonly baseIRI: string }): RdfQuadStream;
}

const rdfParser = (require('rdf-parse') as { readonly rdfParser: RdfParser }).rdfParser;

export type OntologyItemType =
	| 'class'
	| 'objectProperty'
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
	readonly domainReferences?: readonly string[];
	readonly rangeReferences?: readonly string[];
	readonly subclassReference?: string;
	readonly superclassReference?: string;
}

export interface LoadedOntology {
	readonly relativePath: string;
	readonly absolutePath: string;
	readonly items: readonly OntologyItem[];
	readonly error?: string;
}

const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const rdfsClass = 'http://www.w3.org/2000/01/rdf-schema#Class';
const rdfsDatatype = 'http://www.w3.org/2000/01/rdf-schema#Datatype';
const rdfsDomain = 'http://www.w3.org/2000/01/rdf-schema#domain';
const rdfsLabel = 'http://www.w3.org/2000/01/rdf-schema#label';
const rdfsRange = 'http://www.w3.org/2000/01/rdf-schema#range';
const rdfsSubClassOf = 'http://www.w3.org/2000/01/rdf-schema#subClassOf';
const owlAnnotationProperty = 'http://www.w3.org/2002/07/owl#AnnotationProperty';
const owlClass = 'http://www.w3.org/2002/07/owl#Class';
const owlDatatypeProperty = 'http://www.w3.org/2002/07/owl#DatatypeProperty';
const owlEquivalentClass = 'http://www.w3.org/2002/07/owl#equivalentClass';
const owlNamedIndividual = 'http://www.w3.org/2002/07/owl#NamedIndividual';
const owlObjectProperty = 'http://www.w3.org/2002/07/owl#ObjectProperty';

const itemTypeLabels: Record<OntologyItemType, string> = {
	class: 'Classes',
	objectProperty: 'Object properties',
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
	'datatype',
];

export function getOntologyItemTypeLabel(type: OntologyItemType): string {
	return itemTypeLabels[type];
}

export function getOntologyItemTypeOrder(): readonly OntologyItemType[] {
	return itemTypeOrder;
}

export async function loadReferencedOntologies(diagramPath: string, diagram: OntologyDiagramDocument): Promise<readonly LoadedOntology[]> {
	const diagramDirectory = path.dirname(diagramPath);

	return Promise.all(diagram.ontologies.map(async (ontology) => {
		const absolutePath = path.resolve(diagramDirectory, ontology.path);

		try {
			const quads = await parseOntologyFile(absolutePath);
			return {
				relativePath: ontology.path,
				absolutePath,
				items: createOntologyItems(ontology.path, quads, diagram.namespaces),
			};
		} catch (error) {
			return {
				relativePath: ontology.path,
				absolutePath,
				items: [],
				error: error instanceof Error ? error.message : String(error),
			};
		}
	}));
}

function parseOntologyFile(filePath: string): Promise<readonly RdfQuad[]> {
	return new Promise((resolve, reject) => {
		const quads: RdfQuad[] = [];
		const quadStream = rdfParser.parse(createReadStream(filePath), {
			path: filePath,
			baseIRI: `file://${filePath}`,
		});

		quadStream.on('data', (quad: RdfQuad) => {
			quads.push(quad);
		});
		quadStream.on('error', reject);
		quadStream.on('end', () => {
			resolve(quads);
		});
	});
}

function createOntologyItems(
	sourceOntologyPath: string,
	quads: readonly RdfQuad[],
	namespaces: ReadonlyMap<string, string>,
): readonly OntologyItem[] {
	const subjectsByType = new Map<string, Set<string>>();
	const labels = new Map<string, Set<string>>();
	const domains = new Map<string, Set<string>>();
	const ranges = new Map<string, Set<string>>();
	const superclasses = new Map<string, Set<string>>();
	const equivalentClasses = new Map<string, Set<string>>();
	const classAssertions = new Map<string, Set<string>>();
	const subclassRelationships: OntologyItem[] = [];

	for (const quad of quads) {
		const subject = namedTermValue(quad.subject);
		const predicate = namedTermValue(quad.predicate);
		const object = termValue(quad.object);
		if (subject === undefined || predicate === undefined || object === undefined) {
			continue;
		}

		if (predicate === rdfType) {
			addMapValue(subjectsByType, object, subject);
			if (!isBuiltInType(object)) {
				addMapValue(classAssertions, subject, object);
			}
		} else if (predicate === rdfsLabel && quad.object.termType === 'Literal') {
			addMapValue(labels, subject, quad.object.value);
		} else if (predicate === rdfsDomain) {
			addMapValue(domains, subject, object);
		} else if (predicate === rdfsRange) {
			addMapValue(ranges, subject, object);
		} else if (predicate === rdfsSubClassOf) {
			addMapValue(superclasses, subject, object);
			subclassRelationships.push(createSubclassRelationship(sourceOntologyPath, subject, object, labels, namespaces));
		} else if (predicate === owlEquivalentClass) {
			addMapValue(equivalentClasses, subject, object);
		}
	}

	const items = [
		...createEntityItems('class', [owlClass, rdfsClass], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			superclassReferences: valuesFor(superclasses, iri),
			equivalentClassReferences: valuesFor(equivalentClasses, iri),
		})),
		...createEntityItems('objectProperty', [owlObjectProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...createEntityItems('dataProperty', [owlDatatypeProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...createEntityItems('annotationProperty', [owlAnnotationProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...subclassRelationships,
		...createEntityItems('individual', [owlNamedIndividual], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			assertedClassReferences: valuesFor(classAssertions, iri),
		})),
		...createEntityItems('datatype', [rdfsDatatype], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
		})),
	];

	return items.sort((left, right) => left.displayLabel.localeCompare(right.displayLabel));
}

function createEntityItems(
	type: OntologyItemType,
	typeIris: readonly string[],
	subjectsByType: ReadonlyMap<string, ReadonlySet<string>>,
	labels: ReadonlyMap<string, ReadonlySet<string>>,
	namespaces: ReadonlyMap<string, string>,
	sourceOntologyPath: string,
	createMetadata: (iri: string) => OntologyItemMetadata,
): readonly OntologyItem[] {
	const iris = [...new Set(typeIris.flatMap((typeIri) => [...(subjectsByType.get(typeIri) ?? [])]))];

	return iris.map((iri) => ({
		type,
		reference: compactIri(iri, namespaces),
		displayLabel: displayLabel(iri, labels, namespaces),
		sourceOntologyPath,
		metadata: createMetadata(iri),
	}));
}

function createSubclassRelationship(
	sourceOntologyPath: string,
	subclassReference: string,
	superclassReference: string,
	labels: ReadonlyMap<string, ReadonlySet<string>>,
	namespaces: ReadonlyMap<string, string>,
): OntologyItem {
	const subclassLabel = displayLabel(subclassReference, labels, namespaces);
	const superclassLabel = displayLabel(superclassReference, labels, namespaces);

	return {
		type: 'subclassRelationship',
		reference: 'rdfs:subClassOf',
		displayLabel: `${subclassLabel} -> ${superclassLabel}`,
		sourceOntologyPath,
		metadata: {
			relationshipReference: 'rdfs:subClassOf',
			displayLabels: [],
			subclassReference: compactIri(subclassReference, namespaces),
			superclassReference: compactIri(superclassReference, namespaces),
		},
	};
}

function displayLabel(iri: string, labels: ReadonlyMap<string, ReadonlySet<string>>, namespaces: ReadonlyMap<string, string>): string {
	return valuesFor(labels, iri)[0] ?? compactIri(iri, namespaces) ?? localName(iri);
}

function compactIri(iri: string, namespaces: ReadonlyMap<string, string>): string {
	for (const [prefix, namespace] of namespaces) {
		if (iri.startsWith(namespace)) {
			return `${prefix}:${iri.slice(namespace.length)}`;
		}
	}

	return iri;
}

function localName(iri: string): string {
	const hashIndex = iri.lastIndexOf('#');
	const slashIndex = iri.lastIndexOf('/');
	const separatorIndex = Math.max(hashIndex, slashIndex);

	return separatorIndex >= 0 ? iri.slice(separatorIndex + 1) : iri;
}

function addMapValue(map: Map<string, Set<string>>, key: string, value: string): void {
	const values = map.get(key) ?? new Set<string>();
	values.add(value);
	map.set(key, values);
}

function valuesFor(map: ReadonlyMap<string, ReadonlySet<string>>, key: string): readonly string[] {
	return [...(map.get(key) ?? [])];
}

function namedTermValue(term: RdfTerm): string | undefined {
	return term.termType === 'NamedNode' ? term.value : undefined;
}

function termValue(term: RdfTerm): string | undefined {
	return term.termType === 'NamedNode' || term.termType === 'Literal' ? term.value : undefined;
}

function isBuiltInType(value: string): boolean {
	return [
		owlClass,
		rdfsClass,
		owlObjectProperty,
		owlDatatypeProperty,
		owlAnnotationProperty,
		owlNamedIndividual,
		rdfsDatatype,
	].includes(value);
}
