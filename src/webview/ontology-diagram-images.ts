import type { CellStyle } from '@maxgraph/core';
import { ImagePlus, createElement as createIconElement } from 'lucide';

import type { ImageBoundsUpdate } from '../shared/canvas-geometry';
import { escapeHtml } from '../shared/html';
import type { DiagramImage } from './ontology-diagram-types';
import type { DiagramVertex } from './ontology-diagram-nodes';
import type { WebviewTheme } from './webview-theme';

export function renderImageToolbarIcon(addImageButton: HTMLButtonElement): void {
	addImageButton.replaceChildren(createIconElement(ImagePlus, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
}

export function imageBounds(image: DiagramImage): ImageBoundsUpdate {
	return {
		id: image.id,
		x: image.x,
		y: image.y,
		width: image.width,
		height: image.height,
	};
}

export function imageVertex(image: DiagramImage, theme: WebviewTheme): DiagramVertex {
	return {
		id: image.id,
		value: imageLabelHtml(image),
		position: [image.x, image.y],
		size: [image.width, image.height],
		style: imageStyle(theme),
	};
}

function imageStyle(theme: WebviewTheme): CellStyle {
	return {
		align: 'center',
		verticalAlign: 'middle',
		whiteSpace: 'wrap',
		overflow: 'hidden',
		rounded: false,
		shadow: true,
		fillColor: theme.editorBackground,
		strokeColor: theme.nodeBorder,
		strokeWidth: 1,
	};
}

function imageLabelHtml(image: DiagramImage): string {
	return [
		'<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;">',
		`<img src="${escapeHtml(image.webview_src)}" alt="${escapeHtml(image.source)}" title="${escapeHtml(image.source)}" style="display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;">`,
		'</div>',
	].join('');
}
