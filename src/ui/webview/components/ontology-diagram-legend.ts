import type { LegendBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramLegendElement } from '../ontology-diagram-types';

export function renderLegendToolbarIcon(button: HTMLButtonElement): void {
	const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'canvas-action-icon');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.innerHTML = '<rect x="3" y="4" width="18" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><rect x="6" y="7" width="3" height="3" fill="currentColor"/><path d="M11 8.5h7M6 13h3M11 14.5h7" stroke="currentColor" stroke-width="1.5"/>';
	button.replaceChildren(svg);
}

export function legendBounds(element: DiagramLegendElement): LegendBoundsUpdate {
	return { id: element.id, x: element.x, y: element.y, width: element.width, height: element.height };
}
