import { FileSymlink, createElement as createIconElement } from 'lucide';

import type { DiagramLinkBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramLink } from '../ontology-diagram-types';

export function renderDiagramLinkToolbarIcon(button: HTMLButtonElement): void {
	button.replaceChildren(createIconElement(FileSymlink, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
}

export function diagramLinkBounds(link: DiagramLink): DiagramLinkBoundsUpdate {
	return { id: link.id, x: link.x, y: link.y, width: link.width, height: link.height };
}

export function diagramLinkName(reference: string): string {
	const fileName = reference.replaceAll('\\', '/').split('/').pop() ?? reference;
	return fileName.replace(/\.odiagram$/iu, '') || fileName;
}

export const defaultDiagramLinkIcon = `data:image/svg+xml,${encodeURIComponent([
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
	'<path d="M18 9h25l9 9v31a6 6 0 0 1-6 6H18a6 6 0 0 1-6-6V15a6 6 0 0 1 6-6Z" fill="#64748b"/>',
	'<path d="M43 9v10h9" fill="none" stroke="#e2e8f0" stroke-width="3" stroke-linejoin="round"/>',
	'<circle cx="25" cy="29" r="4" fill="#f8fafc"/><circle cx="40" cy="38" r="4" fill="#f8fafc"/>',
	'<path d="m28 31 9 5M25 33v9h15" fill="none" stroke="#f8fafc" stroke-width="3" stroke-linecap="round"/>',
	'</svg>',
].join(''))}`;
