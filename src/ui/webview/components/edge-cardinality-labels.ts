import type { CanvasPoint } from '../../../shared/canvas-geometry';
import type { DiagramEdge, DiagramPayload } from '../ontology-diagram-types';
import { propertyCardinalityText } from './node-data-properties';

export interface EdgeCardinalityLabels {
	readonly source?: string;
	readonly target?: string;
}

export function edgeCardinalityLabels(edge: DiagramEdge, payload: DiagramPayload): EdgeCardinalityLabels {
	const nodesById = new Map((payload.diagram?.nodes ?? []).map((node) => [node.id, node] as const));
	const source = nodesById.get(edge.source);
	const target = nodesById.get(edge.target);

	return {
		source: source === undefined ? undefined : propertyCardinalityText(edge.ontology_ref, source.ontology_ref, payload),
		target: target === undefined ? undefined : propertyCardinalityText(edge.ontology_ref, target.ontology_ref, payload),
	};
}

export function defaultSourceCardinalityLabel(points: readonly CanvasPoint[]): CanvasPoint | undefined {
	const point = points[0];
	if (point === undefined) {
		return undefined;
	}

	return { x: point.x + 16, y: point.y - 16 };
}

export function defaultTargetCardinalityLabel(points: readonly CanvasPoint[]): CanvasPoint | undefined {
	const point = points[points.length - 1];
	if (point === undefined) {
		return undefined;
	}

	return { x: point.x - 16, y: point.y - 16 };
}
