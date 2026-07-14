export const diagramLayoutAlgorithms = [
	{ id: 'directed-layers', label: 'Directed layers' },
	{ id: 'elk-layered', label: 'ELK layered' },
	{ id: 'elk-force', label: 'ELK Force' },
	{ id: 'elk-mrtree', label: 'ELK Mr. Tree' },
	{ id: 'grid', label: 'Grid' },
] as const;

export type DiagramLayoutAlgorithmId = typeof diagramLayoutAlgorithms[number]['id'];

export const defaultDiagramLayoutAlgorithmId: DiagramLayoutAlgorithmId = 'directed-layers';

export const defaultElkLayeredNodeSpacing = 30;
export const defaultElkLayeredLayerSpacing = 30;
export const minimumElkLayeredSpacing = 16;
export const maximumElkLayeredSpacing = 480;

export const elkLayeredDirections = [
	{ id: 'horizontal', label: 'Left to right' },
	{ id: 'right-to-left', label: 'Right to left' },
	{ id: 'vertical', label: 'Top to bottom' },
	{ id: 'bottom-up', label: 'Bottom to top' },
] as const;

export type ElkLayeredDirection = typeof elkLayeredDirections[number]['id'];

export const defaultElkLayeredDirection: ElkLayeredDirection = 'horizontal';

export interface ElkLayeredLayoutOptions {
	readonly nodeSpacing?: number;
	readonly layerSpacing?: number;
	readonly direction?: ElkLayeredDirection;
}

export function normalizeElkLayeredSpacing(value: number | undefined, fallback: number): number {
	if (value === undefined || !Number.isFinite(value)) {
		return fallback;
	}

	return Math.min(Math.max(Math.round(value), minimumElkLayeredSpacing), maximumElkLayeredSpacing);
}

export function isElkLayeredDirection(value: string): value is ElkLayeredDirection {
	return elkLayeredDirections.some((direction) => direction.id === value);
}

export function isDiagramLayoutAlgorithmId(value: string): value is DiagramLayoutAlgorithmId {
	return diagramLayoutAlgorithms.some((algorithm) => algorithm.id === value);
}
