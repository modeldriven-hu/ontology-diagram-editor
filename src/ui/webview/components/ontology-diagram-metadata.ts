import type { MetadataBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramMetadataElement } from '../ontology-diagram-types';

export function renderMetadataToolbarIcon(button: HTMLButtonElement): void {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'canvas-action-icon');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.innerHTML = '<rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9 4v16M3 9h18M3 14h18" fill="none" stroke="currentColor" stroke-width="1.5"/>';
	button.replaceChildren(svg);
}

export function metadataBounds(element: DiagramMetadataElement): MetadataBoundsUpdate {
	return { id: element.id, x: element.x, y: element.y, width: element.width, height: element.height };
}
