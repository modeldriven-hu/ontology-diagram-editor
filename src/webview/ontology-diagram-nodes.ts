import type { CellStyle } from '@maxgraph/core';

import { getOntologyItemIcon, isOntologyItemType } from '../model-tree/ontology-item-icons';
import type { NodeBoundsUpdate } from '../shared/canvas-geometry';
import { escapeHtml } from '../shared/html';
import type { DiagramNode } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';

export interface DiagramVertex {
	readonly id: string;
	readonly value: string;
	readonly position: readonly [number, number];
	readonly size: readonly [number, number];
	readonly style: CellStyle;
}

export function nodeBounds(node: DiagramNode): NodeBoundsUpdate {
	return {
		id: node.id,
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
	};
}

export function nodeVertex(node: DiagramNode, theme: WebviewTheme): DiagramVertex {
	return {
		id: node.id,
		value: nodeLabelHtml(node, theme),
		position: [node.x, node.y],
		size: [node.width, node.height],
		style: nodeStyle(node, theme),
	};
}

function nodeStyle(node: DiagramNode, theme: WebviewTheme): CellStyle {
	const borderType = node.style?.border?.type;
	const borderWeight = node.style?.border?.weight;
	const style: CellStyle = {
		align: 'center',
		verticalAlign: 'middle',
		whiteSpace: 'wrap',
		overflow: 'hidden',
		rounded: true,
		absoluteArcSize: true,
		arcSize: 8,
		spacing: 10,
		shadow: true,
		fillColor: node.style?.bg_color ?? theme.nodeBackground,
		fontColor: node.style?.text_color ?? theme.editorForeground,
		fontFamily: node.style?.font?.family ?? theme.fontFamily,
		fontSize: node.style?.font?.size ?? theme.fontSize,
		strokeColor: node.style?.border?.color ?? theme.nodeBorder,
		strokeWidth: borderWeight ?? 1,
	};

	if (node.style?.font?.bold === true || node.style?.font?.italic === true) {
		style.fontStyle = (node.style.font.bold === true ? 1 : 0) + (node.style.font.italic === true ? 2 : 0);
	}
	if (borderType === 'dashed' || borderType === 'dotted') {
		style.dashed = true;
		style.dashPattern = borderType === 'dotted' ? '1 4' : '3 3';
	}
	if (borderType === 'none' || borderWeight === 0) {
		style.strokeColor = 'none';
		style.strokeWidth = 0;
	}

	return style;
}

function nodeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}

function nodeLabelHtml(node: DiagramNode, theme: WebviewTheme): string {
	const displayName = escapeHtml(nodeDisplayName(node.ontology_ref));
	if (node.ontology_item_type === undefined || !isOntologyItemType(node.ontology_item_type)) {
		return displayName;
	}

	const icon = getOntologyItemIcon(node.ontology_item_type);

	return [
		'<span style="display:inline-flex;align-items:center;justify-content:center;gap:8px;max-width:100%;min-width:0;">',
		`<span style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:18px;height:18px;border-radius:4px;border:1px solid ${escapeHtml(theme.nodeBorder)};background:${escapeHtml(theme.iconBackground)};color:${escapeHtml(theme.focusBorder)};font-size:11px;font-weight:600;line-height:1;">${escapeHtml(icon.canvasGlyph)}</span>`,
		`<span style="display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</span>`,
		'</span>',
	].join('');
}
