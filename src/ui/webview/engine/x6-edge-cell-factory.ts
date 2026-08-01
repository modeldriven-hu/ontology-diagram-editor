import type { CanvasPoint } from '../../../shared/canvas-geometry';
import { defaultSourceCardinalityLabel, defaultTargetCardinalityLabel, edgeCardinalityLabels } from '../components/edge-cardinality-labels';
import { edgeDisplayName } from '../components/ontology-diagram-edges';
import { ontologyColor } from '../components/ontology-legend';
import type { DiagramEdge, DiagramImage, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';
import type { X6Edge, X6EdgeView, X6LabelPosition } from './x6-browser';
import { canvasPoint, withoutRedundantPoints } from './x6-diagram-canvas-helpers';
import { isNoteConnection } from '../components/presentation/diagram-presentation';

type ElementBorder = NonNullable<NonNullable<DiagramNode['style']>['border']>;
type EdgeLineStyle = NonNullable<DiagramEdge['style']>['line_style'];
type ConnectableElement = Pick<DiagramNode | DiagramNote | DiagramImage, 'id' | 'x' | 'y' | 'width' | 'height'>;

export function x6Edge(
	edge: DiagramEdge,
	elementById: ReadonlyMap<string, ConnectableElement>,
	payload: DiagramPayload,
	theme: WebviewTheme,
): Record<string, unknown> {
	const persistedPoints = edge.points.length >= 2 ? edge.points : [{ x: 0, y: 0 }, { x: 0, y: 0 }];
	const points = displayPoints(edge, persistedPoints);
	const sourcePoint = points[0];
	const targetPoint = points[points.length - 1];
	const sourceElement = elementById.get(edge.source);
	const targetElement = elementById.get(edge.target);
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = lineStyle === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? ontologyColor(edge.ontology_ref, payload, edge.ontology_item_type) ?? theme.edgeColor;
	const label = isNoteConnection(edge) ? '' : edgeDisplayName(edge.ontology_ref, payload);
	const cardinalities = edgeCardinalityLabels(edge, payload);

	return {
		id: edge.id,
		shape: 'edge',
		source: sourceElement === undefined ? sourcePoint : {
			cell: edge.source,
			anchor: anchorFromPoint(sourcePoint, sourceElement),
		},
		target: targetElement === undefined ? targetPoint : {
			cell: edge.target,
			anchor: anchorFromPoint(targetPoint, targetElement),
		},
		vertices: points.slice(1, -1),
		router: edgeRouter(edge.route_layout),
		attrs: {
			line: {
				stroke,
				strokeWidth,
				strokeDasharray: edgeDashArray(lineStyle, strokeWidth),
				targetMarker: edgeTargetMarker(edge, stroke, strokeWidth, theme),
			},
			wrap: {
				stroke: 'transparent',
				strokeWidth: Math.max(14, strokeWidth + 10),
				cursor: 'pointer',
			},
		},
		labels: [
			...(label.length === 0 ? [] : [{
			position: labelPosition(edge.label, sourcePoint),
			attrs: {
				rect: {
					fill: theme.canvasBackground,
					stroke: 'none',
					fillOpacity: 0.85,
					rx: 3,
					ry: 3,
				},
				text: {
					text: label,
					fill: edge.style?.text_color ?? theme.edgeTextColor,
					fontFamily: edge.style?.font?.family ?? theme.fontFamily,
					fontSize: edge.style?.font?.size ?? Math.max(10, theme.fontSize - 1),
					fontWeight: edge.style?.font?.bold === true ? 700 : 400,
					fontStyle: edge.style?.font?.italic === true ? 'italic' : 'normal',
				},
			},
			}]),
			...edgeCardinalityX6Labels(edge, cardinalities, points, sourcePoint, theme),
		],
		zIndex: 30,
	};
}

export function edgeCardinalityX6Labels(
	edge: DiagramEdge,
	cardinalities: { readonly source?: string; readonly target?: string },
	points: readonly CanvasPoint[],
	sourcePoint: CanvasPoint,
	theme: WebviewTheme,
): readonly Record<string, unknown>[] {
	return [
		cardinalities.source === undefined ? undefined : x6CardinalityLabel(
			cardinalities.source,
			edge.source_cardinality_label ?? defaultSourceCardinalityLabel(points),
			sourcePoint,
			edge,
			theme,
		),
		cardinalities.target === undefined ? undefined : x6CardinalityLabel(
			cardinalities.target,
			edge.target_cardinality_label ?? defaultTargetCardinalityLabel(points),
			sourcePoint,
			edge,
			theme,
		),
	].filter((label): label is Record<string, unknown> => label !== undefined);
}

export function x6CardinalityLabel(
	text: string,
	position: CanvasPoint | undefined,
	sourcePoint: CanvasPoint,
	edge: DiagramEdge,
	theme: WebviewTheme,
): Record<string, unknown> {
	return {
		position: labelPosition(position ?? sourcePoint, sourcePoint),
		attrs: {
			rect: {
				fill: theme.canvasBackground,
				stroke: 'none',
				fillOpacity: 0.85,
				rx: 3,
				ry: 3,
			},
			text: {
				text,
				fill: edge.style?.text_color ?? theme.edgeTextColor,
				fontFamily: edge.style?.font?.family ?? theme.fontFamily,
				fontSize: Math.max(9, (edge.style?.font?.size ?? theme.fontSize) - 1),
				fontWeight: edge.style?.font?.bold === true ? 700 : 400,
				fontStyle: edge.style?.font?.italic === true ? 'italic' : 'normal',
			},
		},
	};
}

export function edgeCardinalityLabelsForEdge(edge: X6Edge, payload: DiagramPayload | undefined): { readonly source?: string; readonly target?: string } {
	if (payload === undefined) {
		return {};
	}

	const diagramEdge = payload.diagram?.edges?.find((candidate) => candidate.id === edge.id);
	return diagramEdge === undefined ? {} : edgeCardinalityLabels(diagramEdge, payload);
}

export function labelPosition(label: CanvasPoint, sourcePoint: CanvasPoint): X6LabelPosition {
	return {
		distance: 0,
		offset: {
			x: label.x - sourcePoint.x,
			y: label.y - sourcePoint.y,
		},
		options: {
			absoluteDistance: true,
			absoluteOffset: true,
		},
	};
}

export function labelPositionForPoint(label: CanvasPoint, view: X6EdgeView | undefined, sourcePoint: CanvasPoint): X6LabelPosition {
	return view?.getLabelPosition(label.x, label.y, {
		absoluteDistance: true,
		absoluteOffset: true,
	}) ?? labelPosition(label, sourcePoint);
}

export function resetLabelPoint(points: readonly CanvasPoint[]): CanvasPoint {
	if (points.length > 2) {
		const lastSegment = lastNonZeroSegment(points);
		if (lastSegment !== undefined) {
			return offsetLabelPoint(segmentMiddlePoint(lastSegment.start, lastSegment.end), lastSegment.start, lastSegment.end);
		}
	}

	return routeMiddleLabelPoint(points);
}

export function routeMiddleLabelPoint(points: readonly CanvasPoint[]): CanvasPoint {
	const totalLength = routeLength(points);
	if (totalLength === 0) {
		return points[0];
	}

	const targetLength = totalLength / 2;
	let traversedLength = 0;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = distance(start, end);
		if (segmentLength === 0) {
			continue;
		}
		if (traversedLength + segmentLength >= targetLength) {
			const ratio = (targetLength - traversedLength) / segmentLength;
			return offsetLabelPoint({
				x: start.x + (end.x - start.x) * ratio,
				y: start.y + (end.y - start.y) * ratio,
			}, start, end);
		}
		traversedLength += segmentLength;
	}

	return offsetLabelPoint(points[points.length - 1], points[points.length - 2], points[points.length - 1]);
}

export function lastNonZeroSegment(points: readonly CanvasPoint[]): { readonly start: CanvasPoint; readonly end: CanvasPoint } | undefined {
	for (let index = points.length - 1; index > 0; index -= 1) {
		const start = points[index - 1];
		const end = points[index];
		if (distance(start, end) > 0) {
			return { start, end };
		}
	}

	return undefined;
}

export function segmentMiddlePoint(start: CanvasPoint, end: CanvasPoint): CanvasPoint {
	return {
		x: start.x + (end.x - start.x) / 2,
		y: start.y + (end.y - start.y) / 2,
	};
}

export function routeLength(points: readonly CanvasPoint[]): number {
	return points.reduce((length, point, index) => {
		const previous = points[index - 1];
		return previous === undefined ? length : length + distance(previous, point);
	}, 0);
}

export function distance(start: CanvasPoint, end: CanvasPoint): number {
	return Math.hypot(end.x - start.x, end.y - start.y);
}

export function offsetLabelPoint(point: CanvasPoint, segmentStart: CanvasPoint, segmentEnd: CanvasPoint): CanvasPoint {
	const offset = 16;
	const dx = segmentEnd.x - segmentStart.x;
	const dy = segmentEnd.y - segmentStart.y;
	return canvasPoint(Math.abs(dx) >= Math.abs(dy)
		? { x: point.x, y: point.y - offset }
		: { x: point.x + offset, y: point.y });
}

export function edgeEditTools(): Record<string, unknown> {
	return {
		items: [
			{
				name: 'segments',
				args: {
					snapRadius: 0,
					attrs: {
						fill: '#444',
						stroke: '#fff',
						'stroke-width': 2,
					},
				},
			},
			{
				name: 'source-anchor',
				args: anchorToolArgs(),
			},
			{
				name: 'target-anchor',
				args: anchorToolArgs(),
			},
		],
	};
}

export function anchorToolArgs(): Record<string, unknown> {
	return {
		restrictArea: true,
		snapRadius: 0,
		areaPadding: 6,
		defaultAnchorAttrs: {
			fill: '#444',
			stroke: '#fff',
			'stroke-width': 2,
			r: 6,
		},
		customAnchorAttrs: {
			fill: '#444',
			stroke: '#fff',
			'stroke-width': 2,
			r: 6,
		},
	};
}

export function anchorFromPoint(point: CanvasPoint, element: ConnectableElement): Record<string, unknown> {
	return {
		name: 'topLeft',
		args: {
			dx: percentage(point.x - element.x, element.width),
			dy: percentage(point.y - element.y, element.height),
			rotate: true,
		},
	};
}

export function percentage(value: number, size: number): string {
	if (size === 0) {
		return '0%';
	}

	return `${roundPercentage((value / size) * 100)}%`;
}

export function roundPercentage(value: number): number {
	return Math.round(value * 1000) / 1000;
}

export function orthogonalDisplayPoints(points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	if (points.length < 2) {
		return points;
	}

	const result: CanvasPoint[] = [points[0]];
	for (let index = 1; index < points.length; index += 1) {
		const previous = result[result.length - 1];
		const next = points[index];
		if (previous.x !== next.x && previous.y !== next.y) {
			result.push({ x: next.x, y: previous.y });
		}
		result.push(next);
	}

	return withoutRedundantPoints(result);
}

export function displayPoints(edge: DiagramEdge, points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	if (edge.route_layout === 'direct') {
		return withoutRedundantPoints([points[0], points[points.length - 1]]);
	}
	if (edge.route_layout === undefined || edge.route_layout === 'orthogonal') {
		return orthogonalDisplayPoints(points);
	}

	return withoutRedundantPoints(points);
}

export function edgeRouter(routeLayout: DiagramEdge['route_layout']): string | Record<string, unknown> | undefined {
	switch (routeLayout) {
		case 'orthogonal':
			return undefined;
		case 'one_side':
			return { name: 'oneSide' };
		case 'manhattan':
			return { name: 'manhattan' };
		case 'metro':
			return { name: 'metro' };
		case 'entity_relation':
			return { name: 'er' };
		case 'direct':
		case undefined:
			return undefined;
	}
}

export function edgeDashArray(lineStyle: EdgeLineStyle | undefined, strokeWidth: number): string | undefined {
	return lineStyle === 'dotted'
		? `${strokeWidth} ${strokeWidth * 3}`
		: lineStyle === 'dashed'
			? `${strokeWidth * 4} ${strokeWidth * 3}`
			: undefined;
}

export function edgeTargetMarker(
	edge: DiagramEdge,
	stroke: string,
	strokeWidth: number,
	theme: WebviewTheme,
): Record<string, unknown> | undefined {
	if (stroke === 'none') {
		return undefined;
	}

	if (isNoteConnection(edge)) {
		return undefined;
	}

	if (edge.ontology_item_type === 'subclassRelationship') {
		return {
			tagName: 'path',
			d: 'M 12 -6 0 0 12 6 Z',
			fill: theme.canvasBackground,
			stroke,
			strokeWidth,
		};
	}

	return {
		tagName: 'path',
		d: 'M 10 -5 0 0 10 5',
		fill: 'none',
		stroke,
		strokeWidth,
	};
}
