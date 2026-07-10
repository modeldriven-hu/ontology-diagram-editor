export const diagramLayoutAlgorithms = [
	{ id: 'directed-layers', label: 'Directed layers' },
	{ id: 'elk-layered', label: 'ELK layered' },
	{ id: 'grid', label: 'Grid' },
] as const;

export type DiagramLayoutAlgorithmId = typeof diagramLayoutAlgorithms[number]['id'];

export const defaultDiagramLayoutAlgorithmId: DiagramLayoutAlgorithmId = 'directed-layers';

export function isDiagramLayoutAlgorithmId(value: string): value is DiagramLayoutAlgorithmId {
	return diagramLayoutAlgorithms.some((algorithm) => algorithm.id === value);
}
