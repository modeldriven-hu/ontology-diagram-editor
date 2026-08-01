import { defaultSourceCardinalityLabel, defaultTargetCardinalityLabel, edgeCardinalityLabels } from './edge-cardinality-labels';
import { edgeDisplayName } from './ontology-diagram-edges';
import { measuredTextWidth } from './node-data-properties';
import { isNoteConnection } from './presentation/diagram-presentation';
import type { DiagramEdge, DiagramLabel, DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';
import type { ExportBounds } from './canvas-export-types';
import { explicitLines } from './canvas-export-text-layout';

export function diagramContentBounds(elements: readonly ExportBounds[]): ExportBounds | undefined {
	if (elements.length === 0) {
		return undefined;
	}

	const minX = Math.min(...elements.map((element) => element.x));
	const minY = Math.min(...elements.map((element) => element.y));
	const maxX = Math.max(...elements.map((element) => element.x + element.width));
	const maxY = Math.max(...elements.map((element) => element.y + element.height));

	return {
		x: minX,
		y: minY,
		width: maxX - minX,
		height: maxY - minY,
	};
}

export function edgeExportBounds(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): readonly ExportBounds[] {
	const points = edgeRoutePoints(edge);
	if (points.length < 2) {
		return [];
	}

	const pointBounds = points.map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));
	if (isNoteConnection(edge)) {
		return pointBounds;
	}

	const cardinalities = edgeCardinalityLabels(edge, payload);
	return [
		...pointBounds,
		edgeTextExportBounds(edge, edgeDisplayName(edge.ontology_ref, payload), edge.label, false, theme),
		...cardinalityTextExportBounds(edge, cardinalities.source, edge.source_cardinality_label ?? defaultSourceCardinalityLabel(points), theme),
		...cardinalityTextExportBounds(edge, cardinalities.target, edge.target_cardinality_label ?? defaultTargetCardinalityLabel(points), theme),
	];
}

export function cardinalityTextExportBounds(
	edge: DiagramEdge,
	text: string | undefined,
	position: { readonly x: number; readonly y: number } | undefined,
	theme: WebviewTheme,
): readonly ExportBounds[] {
	return text === undefined || position === undefined
		? []
		: [edgeTextExportBounds(edge, text, position, true, theme)];
}

export function edgeTextExportBounds(
	edge: DiagramEdge,
	text: string,
	position: { readonly x: number; readonly y: number },
	cardinality: boolean,
	theme: WebviewTheme,
): ExportBounds {
	return centeredTextBounds({
		center: position,
		text,
		...edgeLabelAppearance(edge, cardinality, theme),
		minimumWidth: cardinality ? 28 : 80,
		minimumHeight: cardinality ? 20 : 24,
		padding: 2,
	});
}

export function edgeLabelAppearance(edge: DiagramEdge, cardinality: boolean, theme: WebviewTheme): {
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
} {
	return {
		fontFamily: edge.style?.font?.family ?? theme.fontFamily,
		fontSize: cardinality
			? Math.max(9, (edge.style?.font?.size ?? theme.fontSize) - 1)
			: edge.style?.font?.size ?? Math.max(10, theme.fontSize - 1),
		bold: edge.style?.font?.bold,
		italic: edge.style?.font?.italic,
	};
}

export function standaloneLabelExportBounds(label: DiagramLabel, theme: WebviewTheme): ExportBounds {
	return centeredTextBounds({
		center: {
			x: label.x + (label.width / 2),
			y: label.y + (label.height / 2),
		},
		text: label.text,
		fontFamily: label.style?.font?.family ?? theme.fontFamily,
		fontSize: label.style?.font?.size ?? theme.fontSize,
		bold: label.style?.font?.bold,
		italic: label.style?.font?.italic,
		minimumWidth: label.width,
		minimumHeight: label.height,
		padding: 4,
	});
}

export function centeredTextBounds(options: {
	readonly center: { readonly x: number; readonly y: number };
	readonly text: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly minimumWidth: number;
	readonly minimumHeight: number;
	readonly padding: number;
}): ExportBounds {
	const lines = explicitLines(options.text);
	const textWidth = Math.max(0, ...lines.map((line) => measuredTextWidth({
		text: line,
		fontFamily: options.fontFamily,
		fontSize: options.fontSize,
		bold: options.bold,
		italic: options.italic,
	})));
	const lineHeight = options.fontSize * 1.25;
	const width = Math.max(options.minimumWidth, textWidth + (options.padding * 2));
	const height = Math.max(options.minimumHeight, (lines.length * lineHeight) + (options.padding * 2));

	return {
		x: options.center.x - (width / 2),
		y: options.center.y - (height / 2),
		width,
		height,
	};
}

export function edgeRoutePoints(edge: DiagramEdge): readonly { readonly x: number; readonly y: number }[] {
	if (edge.points.length < 2) {
		return [];
	}
	if (edge.route_layout === 'direct') {
		return [edge.points[0], edge.points[edge.points.length - 1]];
	}

	return edge.points;
}

export function elementBounds(element: ExportBounds): ExportBounds {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
}


