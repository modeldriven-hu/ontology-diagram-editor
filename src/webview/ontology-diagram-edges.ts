import { Geometry, Point, type Cell, type CellStyle, type Graph } from '@maxgraph/core';

import { escapeHtml } from '../shared/html';
import type { DiagramEdge } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';

export function insertEdge(graph: Graph, edge: DiagramEdge, theme: WebviewTheme): Cell | undefined {
	const source = graph.getDataModel().getCell(edge.source);
	const target = graph.getDataModel().getCell(edge.target);
	if (source === null || target === null) {
		return undefined;
	}

	const cell = graph.insertEdge(
		graph.getDefaultParent(),
		edge.id,
		edgeLabelHtml(edge),
		source,
		target,
		edgeStyle(edge, theme, source, target),
	);
	const geometry = new Geometry();
	geometry.relative = true;
	geometry.offset = edgeLabelOffset(edge);
	geometry.points = edgeControlPoints(edge);
	cell.setGeometry(geometry);

	return cell;
}

function edgeLabelOffset(edge: DiagramEdge): Point {
	const firstPoint = edge.points[0];
	const lastPoint = edge.points.at(-1);
	if (firstPoint === undefined || lastPoint === undefined) {
		return new Point(0, 0);
	}

	return new Point(
		edge.label.x - ((firstPoint.x + lastPoint.x) / 2),
		edge.label.y - ((firstPoint.y + lastPoint.y) / 2),
	);
}

function edgeControlPoints(edge: DiagramEdge): Point[] {
	if (edge.source === edge.target) {
		const loopControlPoint = edge.points[2] ?? edge.points[1];
		return loopControlPoint === undefined ? [] : [new Point(loopControlPoint.x, loopControlPoint.y)];
	}

	return edge.points.slice(1, -1).map((point) => new Point(point.x, point.y));
}

export function edgeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}

function edgeStyle(edge: DiagramEdge, theme: WebviewTheme, source: Cell, target: Cell): CellStyle {
	const lineStyle = edge.style?.line_style;
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const strokeColor = edge.style?.color ?? theme.edgeColor;
	const style: CellStyle = {
		edgeStyle: edge.source === edge.target ? 'loopEdgeStyle' : undefined,
		noEdgeStyle: edge.source !== edge.target,
		orthogonal: false,
		rounded: false,
		strokeColor,
		strokeWidth,
		fontColor: edge.style?.text_color ?? theme.edgeTextColor,
		fontFamily: edge.style?.font?.family ?? theme.fontFamily,
		fontSize: edge.style?.font?.size ?? Math.max(10, theme.fontSize - 1),
		endArrow: edge.ontology_item_type === 'subclassRelationship' ? 'block' : 'open',
		endFill: edge.ontology_item_type === 'subclassRelationship' ? false : undefined,
		endSize: edge.ontology_item_type === 'subclassRelationship' ? 14 : 10,
		...edgeEndpointStyle(edge, source, true),
		...edgeEndpointStyle(edge, target, false),
	};

	if (edge.style?.font?.bold === true || edge.style?.font?.italic === true) {
		style.fontStyle = (edge.style.font.bold === true ? 1 : 0) + (edge.style.font.italic === true ? 2 : 0);
	}
	if (lineStyle === 'dashed' || lineStyle === 'dotted') {
		style.dashed = true;
		style.dashPattern = lineStyle === 'dotted' ? '1 4' : '6 4';
	}
	if (lineStyle === 'none' || strokeWidth === 0) {
		style.strokeColor = 'none';
		style.strokeWidth = 0;
		style.endArrow = 'none';
	}

	return style;
}

function edgeEndpointStyle(edge: DiagramEdge, terminal: Cell, source: boolean): CellStyle {
	const point = source ? edge.points[0] : edge.points.at(-1);
	const geometry = terminal.getGeometry();
	if (point === undefined || geometry === null || geometry.width === 0 || geometry.height === 0) {
		return {};
	}

	const x = clampRatio((point.x - geometry.x) / geometry.width);
	const y = clampRatio((point.y - geometry.y) / geometry.height);
	return source
		? { exitX: x, exitY: y, exitPerimeter: false }
		: { entryX: x, entryY: y, entryPerimeter: false };
}

function clampRatio(value: number): number {
	return Math.max(0, Math.min(1, Math.round(value * 1000) / 1000));
}

export function edgeLabelHtml(edge: DiagramEdge): string {
	return escapeHtml(edgeDisplayName(edge.ontology_ref));
}
