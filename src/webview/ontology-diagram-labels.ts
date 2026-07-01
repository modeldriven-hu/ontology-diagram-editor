import type { CellStyle } from '@maxgraph/core';
import { LetterText, createElement as createIconElement } from 'lucide';

import type { LabelBoundsUpdate } from '../shared/canvas-geometry';
import { escapeHtml } from '../shared/html';
import type { DiagramLabel } from './ontology-diagram-types';
import type { DiagramVertex } from './ontology-diagram-nodes';
import type { WebviewTheme } from './webview-theme';

export function renderLabelToolbarIcon(addLabelButton: HTMLButtonElement): void {
	addLabelButton.replaceChildren(createIconElement(LetterText, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
}

export function labelBounds(label: DiagramLabel): LabelBoundsUpdate {
	return {
		id: label.id,
		x: label.x,
		y: label.y,
		width: label.width,
		height: label.height,
	};
}

export function labelVertex(label: DiagramLabel, theme: WebviewTheme): DiagramVertex {
	return {
		id: label.id,
		value: labelLabelHtml(label),
		position: [label.x, label.y],
		size: [label.width, label.height],
		style: labelStyle(label, theme),
	};
}

function labelStyle(label: DiagramLabel, theme: WebviewTheme): CellStyle {
	const style: CellStyle = {
		align: 'center',
		verticalAlign: 'middle',
		whiteSpace: 'wrap',
		overflow: 'hidden',
		rounded: false,
		fillColor: 'none',
		strokeColor: 'none',
		strokeWidth: 0,
		fontColor: label.style?.text_color ?? theme.editorForeground,
		fontFamily: label.style?.font?.family ?? theme.fontFamily,
		fontSize: label.style?.font?.size ?? theme.fontSize,
	};

	if (label.style?.font?.bold === true || label.style?.font?.italic === true) {
		style.fontStyle = (label.style.font.bold === true ? 1 : 0) + (label.style.font.italic === true ? 2 : 0);
	}

	return style;
}

function labelLabelHtml(label: DiagramLabel): string {
	const text = escapeHtml(label.text).replaceAll('\n', '<br>');

	return `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;overflow-wrap:anywhere;white-space:normal;">${text}</div>`;
}
