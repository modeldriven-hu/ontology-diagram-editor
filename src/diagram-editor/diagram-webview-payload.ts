import * as path from 'path';
import * as vscode from 'vscode';
import { parseOntologyDiagramTextDocument } from '../documents/odiagram';
import { readOntologyDiagramThemeFile, resolveNodeStyle } from '../documents/otheme';
import { loadReferencedOntologies } from '../ui/model-tree/ontology-model';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';
import type { WebviewThemeMode, WebviewThemeOverrideMap, WebviewThemeOverrides } from '../ui/webview/webview-theme';

export async function getDiagramPayload(document: vscode.TextDocument): Promise<DiagramPayload> {
	try {
		const diagram = parseOntologyDiagramTextDocument(document);
		const persistenceObject = diagram.toPersistenceObject();
		const loadedOntologies = await loadReferencedOntologies(document.uri.fsPath, diagram);

		return {
			file: {
				fsPath: document.uri.fsPath,
				uri: document.uri.toString(),
				directory: path.dirname(document.uri.fsPath),
			},
			diagram: persistenceObject,
			ontology: {
				items: loadedOntologies.flatMap((ontology) =>
					ontology.items.map((item) => ({
						reference: item.reference,
						displayLabel: item.displayLabel,
							type: item.type,
							sourceOntologyPath: ontology.relativePath,
							sourceOntologyName: ontologyName(ontology.ontologyIri),
					})),
				),
				data_properties: loadedOntologies.flatMap((ontology) =>
					ontology.items
						.filter((item) => item.type === 'dataProperty')
						.map((item) => ({
							reference: item.reference,
							displayLabel: item.displayLabel,
							domainReferences: item.metadata.domainReferences ?? [],
							rangeReferences: item.metadata.rangeReferences ?? [],
						})),
				),
				property_cardinalities: loadedOntologies.flatMap((ontology) =>
					ontology.items
						.filter((item) => item.type === 'class')
						.flatMap((item) => (item.metadata.propertyCardinalities ?? []).map((cardinality) => ({
							propertyReference: cardinality.propertyReference,
							classReference: item.reference,
							minimum: cardinality.minimum,
							maximum: cardinality.maximum,
						}))),
				),
				individuals: loadedOntologies.flatMap((ontology) =>
					ontology.items
						.filter((item) => item.type === 'individual')
						.map((item) => ({
							reference: item.reference,
							displayLabel: item.displayLabel,
							assertedClassReferences: item.metadata.assertedClassReferences ?? [],
							propertyAssertions: item.metadata.propertyAssertions ?? [],
						})),
				),
				comments: loadedOntologies.flatMap((ontology) =>
					ontology.items
						.filter((item) => (item.metadata.comments ?? []).length > 0)
						.map((item) => ({
							reference: item.reference,
							comments: item.metadata.comments ?? [],
						})),
				),
				annotations: loadedOntologies.flatMap((ontology) =>
					ontology.items
						.filter((item) => (item.metadata.annotations ?? []).length > 0)
						.map((item) => ({
							reference: item.reference,
							annotations: item.metadata.annotations ?? [],
						})),
				),
			},
			theme: await resolvedThemeOverrides(document, diagram),
		};
	} catch (error) {
		return {
			file: {
				fsPath: document.uri.fsPath,
				uri: document.uri.toString(),
				directory: path.dirname(document.uri.fsPath),
			},
			error: error instanceof Error ? error.message : String(error),
		};
	}
}

function ontologyName(ontologyIri: string | undefined): string | undefined {
	if (ontologyIri === undefined) {
		return undefined;
	}
	const parts = ontologyIri.replace(/[/#]+$/u, '').split(/[/#]/u);
	return parts[parts.length - 1] || undefined;
}

async function resolvedThemeOverrides(document: vscode.TextDocument, diagram: ReturnType<typeof parseOntologyDiagramTextDocument>): Promise<WebviewThemeOverrideMap | undefined> {
	const themeFile = diagram.metadata.themeFile;
	if (themeFile === undefined || themeFile.trim().length === 0) {
		return undefined;
	}

	try {
		const themePath = path.resolve(path.dirname(document.uri.fsPath), themeFile);
		const theme = await readOntologyDiagramThemeFile(themePath);
		return {
			light: nodeThemeOverrides(theme, 'light'),
			dark: nodeThemeOverrides(theme, 'dark'),
		};
	} catch {
		return undefined;
	}
}

function nodeThemeOverrides(theme: Awaited<ReturnType<typeof readOntologyDiagramThemeFile>>, mode: WebviewThemeMode): WebviewThemeOverrides {
	const nodeStyle = resolveNodeStyle(theme, undefined, mode);
	return {
		nodeFontBold: nodeStyle.font?.bold,
		nodeFontFamily: nodeStyle.font?.family,
		nodeFontItalic: nodeStyle.font?.italic,
		nodeFontSize: nodeStyle.font?.size,
	};
}


