import type { DiagramEdge, DiagramLegendElement, DiagramNode, DiagramPayload } from '../ontology-diagram-types';

export interface OntologyLegendEntry {
	readonly key: string;
	readonly label: string;
}

const elementTypeLabels: Readonly<Record<string, string>> = {
	class: 'Classes',
	individual: 'Individuals',
	datatype: 'Datatypes',
	objectProperty: 'Object properties',
	dataProperty: 'Data properties',
	annotationProperty: 'Annotation properties',
	subclassRelationship: 'Subclass relationships',
	objectPropertyAssertion: 'Object property assertions',
};

const elementTypeOrder = [
	'class', 'individual', 'datatype', 'objectProperty', 'dataProperty', 'annotationProperty',
	'subclassRelationship', 'objectPropertyAssertion',
] as const;

export function activeOntologyLegend(payload: DiagramPayload): DiagramLegendElement | undefined {
	return payload.diagram?.legend_elements?.[0];
}

export function ontologyColor(reference: string, payload: DiagramPayload, itemType?: string): string | undefined {
	const legend = activeOntologyLegend(payload);
	if (legend === undefined || legend.color_by === 'none') {
		return undefined;
	}
	const key = legend.color_by === 'elementType'
		? itemType ?? ontologyItemType(reference, payload)
		: ontologySource(reference, payload);
	return key === undefined ? undefined : legend.colors[key];
}

export function ontologyColorMode(payload: DiagramPayload): 'border' | 'background' {
	return activeOntologyLegend(payload)?.color_mode ?? 'border';
}

export function ontologyBackgroundColor(reference: string, payload: DiagramPayload, fallback: string, itemType?: string): string {
	return ontologyColorMode(payload) === 'background' ? ontologyColor(reference, payload, itemType) ?? fallback : fallback;
}

export function ontologyTextColor(reference: string, payload: DiagramPayload, fallback: string, itemType?: string): string {
	const color = ontologyColorMode(payload) === 'background' ? ontologyColor(reference, payload, itemType) : undefined;
	return color === undefined ? fallback : readableTextColor(color, fallback);
}

export function readableTextColor(background: string, fallback: string): string {
	const backgroundRgb = parsedColor(background);
	if (backgroundRgb === undefined) {return fallback;}
	const backgroundLuminance = relativeLuminance(backgroundRgb);
	const fallbackRgb = parsedColor(fallback);
	if (fallbackRgb !== undefined && contrastRatio(backgroundLuminance, relativeLuminance(fallbackRgb)) >= 4.5) {
		return fallback;
	}
	return backgroundLuminance > 0.179 ? '#111111' : '#FFFFFF';
}

export function ontologySource(reference: string, payload: DiagramPayload): string | undefined {
	return payload.ontology?.items?.find((item) => item.reference === reference)?.sourceOntologyPath;
}

export function ontologyLegendEntries(payload: DiagramPayload): readonly OntologyLegendEntry[] {
	const colorBy = activeOntologyLegend(payload)?.color_by ?? 'ontologySource';
	if (colorBy === 'none') {
		return [];
	}
	if (colorBy === 'ontologySource') {
		return (payload.diagram?.ontologies ?? []).map((ontology) => ({ key: ontology.path, label: ontology.path }));
	}

	const types = new Set<string>();
	for (const node of payload.diagram?.nodes ?? []) {
		addElementType(types, node, payload);
	}
	for (const edge of payload.diagram?.edges ?? []) {
		if (edge.ontology_item_type !== 'noteConnection') {
			addElementType(types, edge, payload);
		}
	}
	return [
		...elementTypeOrder.filter((type) => types.delete(type)).map((key) => ({ key, label: elementTypeLabel(key) })),
		...Array.from(types).sort((left, right) => left.localeCompare(right)).map((key) => ({ key, label: elementTypeLabel(key) })),
	];
}

export function ontologyName(reference: string, payload: DiagramPayload): string | undefined {
	return payload.ontology?.items?.find((item) => item.reference === reference)?.sourceOntologyName;
}

export function nodeOntologyLabel(reference: string, payload: DiagramPayload): string | undefined {
	return payload.diagram?.metadata?.show_ontology_information === true ? ontologyName(reference, payload) : undefined;
}

function addElementType(types: Set<string>, element: DiagramNode | DiagramEdge, payload: DiagramPayload): void {
	const type = element.ontology_item_type ?? ontologyItemType(element.ontology_ref, payload);
	if (type !== undefined && type.length > 0) {
		types.add(type);
	}
}

function ontologyItemType(reference: string, payload: DiagramPayload): string | undefined {
	return payload.ontology?.items?.find((item) => item.reference === reference)?.type;
}

function elementTypeLabel(type: string): string {
	return elementTypeLabels[type] ?? type;
}

function parsedColor(value: string): readonly [number, number, number] | undefined {
	const compact = /^#([\da-f])([\da-f])([\da-f])$/iu.exec(value.trim());
	if (compact !== null) {return [parseInt(compact[1] + compact[1], 16), parseInt(compact[2] + compact[2], 16), parseInt(compact[3] + compact[3], 16)];}
	const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(value.trim());
	if (full !== null) {return [parseInt(full[1], 16), parseInt(full[2], 16), parseInt(full[3], 16)];}
	const rgb = /^rgba?\(\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)\s*[, ]\s*(\d+(?:\.\d+)?)(?:\s*[,/]\s*[\d.]+%?)?\s*\)$/iu.exec(value.trim());
	if (rgb === null) {return undefined;}
	const channels = rgb.slice(1, 4).map((channel) => Number.parseFloat(channel));
	return channels.every((channel) => channel >= 0 && channel <= 255)
		? channels as unknown as readonly [number, number, number]
		: undefined;
}

function linearRgb(value: number): number {
	const normalized = value / 255;
	return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(rgb: readonly [number, number, number]): number {
	return (0.2126 * linearRgb(rgb[0])) + (0.7152 * linearRgb(rgb[1])) + (0.0722 * linearRgb(rgb[2]));
}

function contrastRatio(firstLuminance: number, secondLuminance: number): number {
	const lighter = Math.max(firstLuminance, secondLuminance);
	const darker = Math.min(firstLuminance, secondLuminance);
	return (lighter + 0.05) / (darker + 0.05);
}
