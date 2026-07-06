import * as path from 'path';
import { createReadStream } from 'fs';
import { readFile } from 'fs/promises';

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

interface SubclassRelationship {
	readonly subclassReference: string;
	readonly superclassReference: string;
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
	readonly comments?: readonly string[];
	readonly subclassReference?: string;
	readonly superclassReference?: string;
}

export interface LoadedOntology {
	readonly relativePath: string;
	readonly absolutePath: string;
	readonly items: readonly OntologyItem[];
	readonly error?: string;
}

interface OntologyNamespaceDeclaration {
	readonly prefix: string;
	readonly namespaceIri: string;
}

interface OntologyFileDeclarations {
	readonly prefixes: readonly OntologyNamespaceDeclaration[];
	readonly bases: readonly string[];
}

const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const rdfsClass = 'http://www.w3.org/2000/01/rdf-schema#Class';
const rdfsComment = 'http://www.w3.org/2000/01/rdf-schema#comment';
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
const owlThing = 'http://www.w3.org/2002/07/owl#Thing';

export const ontologyFileExtensions = ['ttl', 'rdf', 'owl', 'xml', 'jsonld', 'nt'] as const;

const builtInNamespaceIris = [
	'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	'http://www.w3.org/2000/01/rdf-schema#',
	'http://www.w3.org/2002/07/owl#',
	'http://www.w3.org/2001/XMLSchema#',
	'http://www.w3.org/2004/02/skos/core#',
];

const ontologyVocabularyTypeNamespaceIris = [
	'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
	'http://www.w3.org/2000/01/rdf-schema#',
	'http://www.w3.org/2002/07/owl#',
	'http://www.w3.org/2001/XMLSchema#',
];

const baseDirectivePattern = /^(?:@base|base)\s+<([^>]*)>\s*\.?\s*$/i;
const prefixDirectivePattern = /^(?:@prefix|prefix)\s+([^\s:]*):\s*<([^>]*)>\s*\.?\s*$/i;
const uriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;

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

export function isPotentialOntologyFilePath(filePath: string): boolean {
	const extension = path.extname(filePath).slice(1).toLowerCase();
	return (ontologyFileExtensions as readonly string[]).includes(extension);
}

export async function findOntologyImportPaths(
	selectedOntologyPath: string,
	candidateOntologyPaths: readonly string[],
): Promise<readonly string[]> {
	const selectedPath = normalizeAbsoluteFilePath(selectedOntologyPath);
	const candidatePaths = [...uniqueStrings([
		selectedPath,
		...candidateOntologyPaths
			.filter(isPotentialOntologyFilePath)
			.map(normalizeAbsoluteFilePath),
	])].sort((left, right) => left.localeCompare(right));
	const declarationsByPath = new Map<string, OntologyFileDeclarations>();

	await Promise.all(candidatePaths.map(async (candidatePath) => {
		declarationsByPath.set(candidatePath, await readOntologyFileDeclarations(candidatePath));
	}));

	const pathsByNamespaceKey = new Map<string, string[]>();
	for (const [candidatePath, declarations] of declarationsByPath) {
		for (const key of ontologyIdentityNamespaceKeys(declarations)) {
			const paths = pathsByNamespaceKey.get(key) ?? [];
			paths.push(candidatePath);
			pathsByNamespaceKey.set(key, paths);
		}
	}
	for (const paths of pathsByNamespaceKey.values()) {
		paths.sort((left, right) => left.localeCompare(right));
	}

	const importedPaths: string[] = [];
	const importedPathSet = new Set<string>();
	const visitedPaths = new Set<string>();
	const visitingPaths = new Set<string>();

	const visit = (currentPath: string): void => {
		if (visitedPaths.has(currentPath) || visitingPaths.has(currentPath)) {
			return;
		}

		visitingPaths.add(currentPath);
		const declarations = declarationsByPath.get(currentPath);
		if (declarations !== undefined) {
			for (const namespaceKey of ontologyReferencedNamespaceKeys(declarations)) {
				for (const matchedPath of pathsByNamespaceKey.get(namespaceKey) ?? []) {
					if (matchedPath === currentPath) {
						continue;
					}

					visit(matchedPath);
					if (matchedPath !== selectedPath && !importedPathSet.has(matchedPath)) {
						importedPaths.push(matchedPath);
						importedPathSet.add(matchedPath);
					}
				}
			}
		}

		visitingPaths.delete(currentPath);
		visitedPaths.add(currentPath);
	};

	visit(selectedPath);

	return importedPaths;
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

async function readOntologyFileDeclarations(filePath: string): Promise<OntologyFileDeclarations> {
	try {
		return parseOntologyFileDeclarations(await readFile(filePath, 'utf8'));
	} catch {
		return {
			prefixes: [],
			bases: [],
		};
	}
}

function parseOntologyFileDeclarations(content: string): OntologyFileDeclarations {
	const prefixes: OntologyNamespaceDeclaration[] = [];
	const bases: string[] = [];
	let currentBase: string | undefined;

	for (const line of content.split(/\r?\n/)) {
		const trimmed = line.trim();
		if (trimmed.length === 0 || trimmed.startsWith('#')) {
			continue;
		}

		const baseMatch = baseDirectivePattern.exec(trimmed);
		if (baseMatch !== null) {
			currentBase = resolveDeclarationIri(baseMatch[1], currentBase);
			bases.push(currentBase);
			continue;
		}

		const prefixMatch = prefixDirectivePattern.exec(trimmed);
		if (prefixMatch !== null) {
			prefixes.push({
				prefix: prefixMatch[1],
				namespaceIri: resolveDeclarationIri(prefixMatch[2], currentBase),
			});
		}
	}

	return {
		prefixes,
		bases,
	};
}

function ontologyIdentityNamespaceKeys(declarations: OntologyFileDeclarations): readonly string[] {
	const explicitIdentities = [
		...declarations.bases,
		...declarations.prefixes
			.filter((prefix) => prefix.prefix.length === 0)
			.map((prefix) => prefix.namespaceIri),
	].filter((namespaceIri) => !isBuiltInNamespace(namespaceIri));
	const identityIris = explicitIdentities.length > 0
		? explicitIdentities
		: declarations.prefixes
			.map((prefix) => prefix.namespaceIri)
			.filter((namespaceIri) => !isBuiltInNamespace(namespaceIri));

	return uniqueStrings(identityIris.flatMap(namespaceComparisonKeys));
}

function ontologyReferencedNamespaceKeys(declarations: OntologyFileDeclarations): readonly string[] {
	return uniqueStrings(declarations.prefixes
		.filter((prefix) => prefix.prefix.length > 0)
		.map((prefix) => prefix.namespaceIri)
		.filter((namespaceIri) => !isBuiltInNamespace(namespaceIri))
		.flatMap(namespaceComparisonKeys));
}

function namespaceComparisonKeys(namespaceIri: string): readonly string[] {
	const trimmed = namespaceIri.trim();
	const withoutTrailingSeparator = trimmed.replace(/[\/#]+$/u, '');
	return uniqueStrings([trimmed, withoutTrailingSeparator].filter((key) => key.length > 0));
}

function resolveDeclarationIri(value: string, baseIri: string | undefined): string {
	if (baseIri === undefined || uriSchemePattern.test(value)) {
		return value;
	}

	try {
		return new URL(value, baseIri).toString();
	} catch {
		return value;
	}
}

function isBuiltInNamespace(namespaceIri: string): boolean {
	const keys = namespaceComparisonKeys(namespaceIri);
	return builtInNamespaceIris.some((builtInNamespaceIri) =>
		namespaceComparisonKeys(builtInNamespaceIri).some((builtInKey) => keys.includes(builtInKey)),
	);
}

function normalizeAbsoluteFilePath(filePath: string): string {
	return path.resolve(filePath).replaceAll('\\', '/');
}

function createOntologyItems(
	sourceOntologyPath: string,
	quads: readonly RdfQuad[],
	namespaces: ReadonlyMap<string, string>,
): readonly OntologyItem[] {
	const subjectsByType = new Map<string, Set<string>>();
	const labels = new Map<string, Set<string>>();
	const comments = new Map<string, Set<string>>();
	const domains = new Map<string, Set<string>>();
	const ranges = new Map<string, Set<string>>();
	const superclasses = new Map<string, Set<string>>();
	const equivalentClasses = new Map<string, Set<string>>();
	const classAssertions = new Map<string, Set<string>>();
	const subclassRelationships: SubclassRelationship[] = [];

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
		} else if (predicate === rdfsComment && quad.object.termType === 'Literal') {
			addMapValue(comments, subject, quad.object.value);
		} else if (predicate === rdfsDomain) {
			addMapValue(domains, subject, object);
		} else if (predicate === rdfsRange) {
			addMapValue(ranges, subject, object);
		} else if (predicate === rdfsSubClassOf) {
			addMapValue(superclasses, subject, object);
			subclassRelationships.push({ subclassReference: subject, superclassReference: object });
		} else if (predicate === owlEquivalentClass) {
			addMapValue(equivalentClasses, subject, object);
		}
	}

	const individualIris = createIndividualIris(subjectsByType, classAssertions);
	const items = [
		...createEntityItems('class', [owlClass, rdfsClass], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
			superclassReferences: valuesFor(superclasses, iri),
			equivalentClassReferences: valuesFor(equivalentClasses, iri),
		})),
		...createEntityItems('objectProperty', [owlObjectProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...createEntityItems('dataProperty', [owlDatatypeProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...createEntityItems('annotationProperty', [owlAnnotationProperty], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
			domainReferences: valuesFor(domains, iri),
			rangeReferences: valuesFor(ranges, iri),
		})),
		...subclassRelationships.map((relationship) => createSubclassRelationship(
			sourceOntologyPath,
			relationship.subclassReference,
			relationship.superclassReference,
			labels,
			namespaces,
		)),
		...createItemsFromIris('individual', individualIris, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
			assertedClassReferences: valuesFor(classAssertions, iri),
		})),
		...createEntityItems('datatype', [rdfsDatatype], subjectsByType, labels, namespaces, sourceOntologyPath, (iri) => ({
			iri,
			displayLabels: valuesFor(labels, iri),
			comments: valuesFor(comments, iri),
		})),
	];

	return items.sort((left, right) => left.displayLabel.localeCompare(right.displayLabel));
}

function createIndividualIris(
	subjectsByType: ReadonlyMap<string, ReadonlySet<string>>,
	classAssertions: ReadonlyMap<string, ReadonlySet<string>>,
): readonly string[] {
	const ontologyEntityIris = new Set([
		...valuesFor(subjectsByType, owlClass),
		...valuesFor(subjectsByType, rdfsClass),
		...valuesFor(subjectsByType, owlObjectProperty),
		...valuesFor(subjectsByType, owlDatatypeProperty),
		...valuesFor(subjectsByType, owlAnnotationProperty),
		...valuesFor(subjectsByType, rdfsDatatype),
	]);
	const classAssertionIris = [...classAssertions.keys()]
		.filter((iri) => !ontologyEntityIris.has(iri));

	return uniqueStrings([
		...valuesFor(subjectsByType, owlNamedIndividual),
		...classAssertionIris,
	]);
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

	return createItemsFromIris(type, iris, labels, namespaces, sourceOntologyPath, createMetadata);
}

function createItemsFromIris(
	type: OntologyItemType,
	iris: readonly string[],
	labels: ReadonlyMap<string, ReadonlySet<string>>,
	namespaces: ReadonlyMap<string, string>,
	sourceOntologyPath: string,
	createMetadata: (iri: string) => OntologyItemMetadata,
): readonly OntologyItem[] {
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
		displayLabel: `${subclassLabel} ⊑ ${superclassLabel}`,
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
	const label = valuesFor(labels, iri)[0];
	if (label !== undefined) {
		return label;
	}

	const compact = compactIri(iri, namespaces);
	return compact === iri ? localName(iri) : compact;
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

function uniqueStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
}

function namedTermValue(term: RdfTerm): string | undefined {
	return term.termType === 'NamedNode' ? term.value : undefined;
}

function termValue(term: RdfTerm): string | undefined {
	return term.termType === 'NamedNode' || term.termType === 'Literal' ? term.value : undefined;
}

function isBuiltInType(value: string): boolean {
	return value !== owlThing && ontologyVocabularyTypeNamespaceIris.some((namespaceIri) => value.startsWith(namespaceIri));
}
