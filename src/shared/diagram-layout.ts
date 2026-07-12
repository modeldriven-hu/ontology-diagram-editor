export const diagramLayoutAlgorithms = [
	{ id: 'directed-layers', label: 'Directed layers' },
	{ id: 'elk-layered', label: 'ELK layered' },
	{ id: 'elk-force', label: 'ELK Force' },
	{ id: 'elk-mrtree', label: 'ELK Mr. Tree' },
	{ id: 'grid', label: 'Grid' },
] as const;

export type DiagramLayoutAlgorithmId = typeof diagramLayoutAlgorithms[number]['id'];

export const defaultDiagramLayoutAlgorithmId: DiagramLayoutAlgorithmId = 'directed-layers';

export const defaultElkLayeredNodeSpacing = 72;
export const defaultElkLayeredLayerSpacing = 180;
export const minimumElkLayeredSpacing = 16;
export const maximumElkLayeredSpacing = 480;

export interface ElkLayeredLayoutOptions {
	readonly nodeSpacing?: number;
	readonly layerSpacing?: number;
}

export function normalizeElkLayeredSpacing(value: number | undefined, fallback: number): number {
	if (value === undefined || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.round(value), minimumElkLayeredSpacing), maximumElkLayeredSpacing);
}

export function isDiagramLayoutAlgorithmId(value: string): value is DiagramLayoutAlgorithmId {
	return diagramLayoutAlgorithms.some((algorithm) => algorithm.id === value);
}
