import { ImagePlus, createElement as createIconElement } from 'lucide';

import type { ImageBoundsUpdate } from '../../shared/canvas-geometry';
import type { DiagramImage } from '../ontology-diagram-types';

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
