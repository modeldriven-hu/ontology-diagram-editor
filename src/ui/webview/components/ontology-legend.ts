import type { DiagramLegendElement, DiagramPayload } from '../ontology-diagram-types';

export function activeOntologyLegend(payload: DiagramPayload): DiagramLegendElement | undefined {
	return payload.diagram?.legend_elements?.[0];
}

export function ontologyColor(reference: string, payload: DiagramPayload): string | undefined {
	const legend = activeOntologyLegend(payload);
	const source = ontologySource(reference, payload);
	return legend === undefined || source === undefined ? undefined : legend.colors[source];
}

export function ontologyColorMode(payload: DiagramPayload): 'border' | 'background' {
	return activeOntologyLegend(payload)?.color_mode ?? 'border';
}

export function ontologyBackgroundColor(reference: string, payload: DiagramPayload, fallback: string): string {
	return ontologyColorMode(payload) === 'background' ? ontologyColor(reference, payload) ?? fallback : fallback;
}

export function ontologyTextColor(reference: string, payload: DiagramPayload, fallback: string): string {
	const color = ontologyColorMode(payload) === 'background' ? ontologyColor(reference, payload) : undefined;
	if (color === undefined) {return fallback;}
	const rgb = hexColor(color);
	if (rgb === undefined) {return fallback;}
	const luminance = (0.2126 * linearRgb(rgb[0])) + (0.7152 * linearRgb(rgb[1])) + (0.0722 * linearRgb(rgb[2]));
	return luminance > 0.179 ? '#111111' : '#FFFFFF';
}

export function ontologySource(reference: string, payload: DiagramPayload): string | undefined {
	return payload.ontology?.items?.find((item) => item.reference === reference)?.sourceOntologyPath;
}

export function ontologyName(reference: string, payload: DiagramPayload): string | undefined {
	return payload.ontology?.items?.find((item) => item.reference === reference)?.sourceOntologyName;
}

export function nodeOntologyLabel(reference: string, payload: DiagramPayload): string | undefined {
	return payload.diagram?.metadata?.show_ontology_information === true ? ontologyName(reference, payload) : undefined;
}

function hexColor(value: string): readonly [number, number, number] | undefined {
	const compact = /^#([\da-f])([\da-f])([\da-f])$/iu.exec(value.trim());
	if (compact !== null) {return [parseInt(compact[1] + compact[1], 16), parseInt(compact[2] + compact[2], 16), parseInt(compact[3] + compact[3], 16)];}
	const full = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/iu.exec(value.trim());
	return full === null ? undefined : [parseInt(full[1], 16), parseInt(full[2], 16), parseInt(full[3], 16)];
}

function linearRgb(value: number): number {
	const normalized = value / 255;
	return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
}
