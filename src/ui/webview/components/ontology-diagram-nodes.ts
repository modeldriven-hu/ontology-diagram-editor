import type { NodeBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramNode } from '../ontology-diagram-types';

export function nodeBounds(node: DiagramNode): NodeBoundsUpdate {
	return {
		id: node.id,
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
	};
}
