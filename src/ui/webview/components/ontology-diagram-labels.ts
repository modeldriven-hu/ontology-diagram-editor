import type { LabelBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramLabel } from '../ontology-diagram-types';

export function renderLabelToolbarIcon(addLabelButton: HTMLButtonElement): void {
	addLabelButton.replaceChildren(labelIcon());
}

function labelIcon(): SVGSVGElement {
	const svg = svgElement('svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'canvas-action-icon');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.append(
		svgElement('path', {
			d: 'M4 7h16v10H4z',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linejoin': 'round',
		}),
		svgElement('path', {
			d: 'M8 16l2.7-8h2.6L16 16M9.2 13.2h5.6',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linecap': 'round',
			'stroke-linejoin': 'round',
		}),
	);

	return svg;
}

function svgElement(tagName: 'svg'): SVGSVGElement;
function svgElement(tagName: string, attributes: Record<string, string>): SVGElement;
function svgElement(tagName: string, attributes?: Record<string, string>): SVGElement {
	const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
	for (const [name, value] of Object.entries(attributes ?? {})) {
		element.setAttribute(name, value);
	}

	return element;
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
