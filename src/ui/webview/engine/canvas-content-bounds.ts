import type { CanvasPoint } from '../../../shared/canvas-geometry';
import type { DiagramEdge, DiagramNode, DiagramPayload } from '../ontology-diagram-types';

export interface ContentBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export function diagramContentBounds(diagram: DiagramPayload['diagram']): ContentBounds | undefined {
	if (diagram === undefined) {
		return undefined;
	}

	const bounds: ContentBounds[] = [
		...(diagram.nodes ?? []).map(elementBounds),
		...(diagram.notes ?? []).map(elementBounds),
		...(diagram.images ?? []).map(elementBounds),
		...(diagram.labels ?? []).map(elementBounds),
		...(diagram.metadata_elements ?? []).map(elementBounds),
		...(diagram.edges ?? []).flatMap(edgeBounds),
	];
	if (bounds.length === 0) {
		return undefined;
	}

	const left = Math.min(...bounds.map((bound) => bound.x));
	const top = Math.min(...bounds.map((bound) => bound.y));
	const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
	const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));

	return {
		x: left,
		y: top,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

export function elementBounds(element: {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}): ContentBounds {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
}

export function edgeBounds(edge: DiagramEdge): readonly ContentBounds[] {
	const pointBounds = edgeRoutePoints(edge).map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));

	return [
		...pointBounds,
		...(edge.ontology_item_type === 'noteConnection' ? [] : [
			{
				x: edge.label.x,
				y: edge.label.y,
				width: Math.max(80, edge.ontology_ref.length * 7),
				height: 24,
			},
		]),
	];
}

export function edgeRoutePoints(edge: DiagramEdge): readonly CanvasPoint[] {
	if (edge.points.length < 2) {
		return [];
	}
	if (edge.route_layout === 'direct') {
		return [edge.points[0], edge.points[edge.points.length - 1]];
	}

	return edge.points;
}

export function rectCenter(bounds: ContentBounds): CanvasPoint {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2,
	};
}

export function nodeSelectionBounds(nodes: readonly DiagramNode[]): ContentBounds {
	const minX = Math.min(...nodes.map((node) => node.x));
	const minY = Math.min(...nodes.map((node) => node.y));
	const maxX = Math.max(...nodes.map((node) => node.x + node.width));
	const maxY = Math.max(...nodes.map((node) => node.y + node.height));

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

export function edgeSelectionBounds(edges: readonly DiagramEdge[]): ContentBounds | undefined {
	const points = edges.flatMap((edge) => [...edgeRoutePoints(edge)]);
	if (points.length === 0) {
		return undefined;
	}

	const minX = Math.min(...points.map((point) => point.x));
	const minY = Math.min(...points.map((point) => point.y));
	const maxX = Math.max(...points.map((point) => point.x));
	const maxY = Math.max(...points.map((point) => point.y));

	return {
		x: minX,
		y: minY,
		width: Math.max(1, maxX - minX),
		height: Math.max(1, maxY - minY),
	};
}

export function edgeToolbarPoint(edge: DiagramEdge): CanvasPoint | undefined {
	const points = edgeRoutePoints(edge);
	if (points.length === 0) {
		return undefined;
	}
	if (points.length === 1) {
		return points[0];
	}

	const totalLength = points.slice(1).reduce((sum, point, index) => sum + pointDistance(points[index], point), 0);
	if (totalLength <= 0) {
		return {
			x: (points[0].x + points[points.length - 1].x) / 2,
			y: (points[0].y + points[points.length - 1].y) / 2,
		};
	}

	let traversedLength = 0;
	const targetLength = totalLength / 2;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = pointDistance(start, end);
		if (traversedLength + segmentLength >= targetLength) {
			const ratio = segmentLength === 0 ? 0 : (targetLength - traversedLength) / segmentLength;
			return {
				x: start.x + ((end.x - start.x) * ratio),
				y: start.y + ((end.y - start.y) * ratio),
			};
		}

		traversedLength += segmentLength;
	}

	return points[points.length - 1];
}

export function pointDistance(left: CanvasPoint, right: CanvasPoint): number {
	return Math.hypot(right.x - left.x, right.y - left.y);
}
