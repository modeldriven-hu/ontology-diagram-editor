import { LetterText, createElement as createIconElement } from 'lucide';

import type { LabelBoundsUpdate } from '../../shared/canvas-geometry';
import type { DiagramLabel } from '../ontology-diagram-types';

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
