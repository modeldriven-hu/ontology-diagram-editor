import * as path from 'path';
import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { fileURLToPath } from 'url';
import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { createOntologyItems } from './ontology-item-projector';
import { ontologyFileExtensions, type LoadedOntology } from './ontology-model';

interface RdfTerm {
	readonly termType: string;
	readonly value: string;
	readonly datatype?: RdfTerm;
	readonly language?: string;
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
interface OntologyImportDeclarations {
	readonly ontologyIris: readonly string[];
	readonly importIris: readonly string[];
}
const rdfType = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const owlImports = 'http://www.w3.org/2002/07/owl#imports';
const owlOntology = 'http://www.w3.org/2002/07/owl#Ontology';

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
				ontologyIri: declaredOntologyIri(quads),
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

function declaredOntologyIri(quads: readonly RdfQuad[]): string | undefined {
	for (const quad of quads) {
		if (namedTermValue(quad.predicate) === rdfType && namedTermValue(quad.object) === owlOntology) {
			return resourceTermValue(quad.subject);
		}
	}
	return undefined;
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
	const declarationsByPath = new Map<string, OntologyImportDeclarations>();
	const pathsByOntologyIri = new Map<string, string[]>();

	await Promise.all(candidatePaths.map(async (candidatePath) => {
		const declarations = await readOntologyImportDeclarations(candidatePath);
		declarationsByPath.set(candidatePath, declarations);
		registerOntologyPaths(pathsByOntologyIri, candidatePath, declarations.ontologyIris);
	}));

	const importedPaths: string[] = [];
	const importedPathSet = new Set<string>();
	const visitedPaths = new Set<string>();
	const visitingPaths = new Set<string>();

	const declarationsFor = async (ontologyPath: string): Promise<OntologyImportDeclarations> => {
		const existing = declarationsByPath.get(ontologyPath);
		if (existing !== undefined) {
			return existing;
		}

		const declarations = await readOntologyImportDeclarations(ontologyPath);
		declarationsByPath.set(ontologyPath, declarations);
		registerOntologyPaths(pathsByOntologyIri, ontologyPath, declarations.ontologyIris);
		return declarations;
	};

	const visit = async (currentPath: string): Promise<void> => {
		if (visitedPaths.has(currentPath) || visitingPaths.has(currentPath)) {
			return;
		}

		visitingPaths.add(currentPath);
		const declarations = await declarationsFor(currentPath);
		for (const importIri of declarations.importIris) {
			for (const importedPath of await importedOntologyPaths(importIri, pathsByOntologyIri)) {
				if (importedPath === currentPath) {
					continue;
				}

				await visit(importedPath);
				if (importedPath !== selectedPath && !importedPathSet.has(importedPath)) {
					importedPaths.push(importedPath);
					importedPathSet.add(importedPath);
				}
			}
		}

		visitingPaths.delete(currentPath);
		visitedPaths.add(currentPath);
	};

	await visit(selectedPath);

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

async function readOntologyImportDeclarations(filePath: string): Promise<OntologyImportDeclarations> {
	try {
		const ontologyIris = new Set<string>();
		const importIris = new Set<string>();
		for (const quad of await parseOntologyFile(filePath)) {
			const predicate = namedTermValue(quad.predicate);
			if (predicate === rdfType && namedTermValue(quad.object) === owlOntology) {
				const ontologyIri = namedTermValue(quad.subject);
				if (ontologyIri !== undefined) {
					ontologyIris.add(ontologyIri);
				}
			} else if (predicate === owlImports) {
				const importIri = namedTermValue(quad.object);
				if (importIri !== undefined) {
					importIris.add(importIri);
				}
			}
		}

		return { ontologyIris: [...ontologyIris], importIris: [...importIris] };
	} catch {
		return { ontologyIris: [], importIris: [] };
	}
}

function registerOntologyPaths(
	pathsByOntologyIri: Map<string, string[]>,
	ontologyPath: string,
	ontologyIris: readonly string[],
): void {
	for (const ontologyIri of ontologyIris) {
		const paths = pathsByOntologyIri.get(ontologyIri) ?? [];
		paths.push(ontologyPath);
		pathsByOntologyIri.set(ontologyIri, [...new Set(paths)].sort((left, right) => left.localeCompare(right)));
	}
}

async function importedOntologyPaths(
	importIri: string,
	pathsByOntologyIri: ReadonlyMap<string, readonly string[]>,
): Promise<readonly string[]> {
	const directImportPath = localImportPath(importIri);
	if (directImportPath !== undefined && await isFile(directImportPath)) {
		return [directImportPath];
	}

	const matchingPaths = pathsByOntologyIri.get(importIri) ?? [];
	return matchingPaths.length === 1 ? matchingPaths : [];
}

function localImportPath(importIri: string): string | undefined {
	if (!importIri.startsWith('file:')) {
		return undefined;
	}

	try {
		return normalizeAbsoluteFilePath(fileURLToPath(importIri));
	} catch {
		return undefined;
	}
}

async function isFile(filePath: string): Promise<boolean> {
	try {
		return (await stat(filePath)).isFile();
	} catch {
		return false;
	}
}

function normalizeAbsoluteFilePath(filePath: string): string {
	return path.resolve(filePath).replaceAll('\\', '/');
}


function uniqueStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
}

function namedTermValue(term: RdfTerm): string | undefined {
	return term.termType === 'NamedNode' ? term.value : undefined;
}

function resourceTermValue(term: RdfTerm): string | undefined {
	if (term.termType === 'NamedNode') {
		return term.value;
	}
	return term.termType === 'BlankNode' ? `_:${term.value}` : undefined;
}

