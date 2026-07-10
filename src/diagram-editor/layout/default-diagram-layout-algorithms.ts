import type { DiagramLayoutAlgorithm } from './diagram-layout-algorithm';
import { DirectedLayerLayoutAlgorithm } from './directed-layer-layout-algorithm';
import { ElkLayeredLayoutAlgorithm } from './elk-layered-layout-algorithm';
import { GridLayoutAlgorithm } from './grid-layout-algorithm';

export function createDefaultDiagramLayoutAlgorithms(): readonly DiagramLayoutAlgorithm[] {
	return [
		new DirectedLayerLayoutAlgorithm(),
		new ElkLayeredLayoutAlgorithm(),
		new GridLayoutAlgorithm(),
	];
}
