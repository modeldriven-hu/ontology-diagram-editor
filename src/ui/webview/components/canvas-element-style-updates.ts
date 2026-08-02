import type { ElementStyleUpdate } from '../../../shared/webview-command-types';
import type { DiagramCanvasEngine } from '../engine/diagram-canvas-engine';
import type { CanvasElementRegistry } from './canvas-element-registry';

export function applyCanvasElementStyleUpdates(
	updates: readonly ElementStyleUpdate[],
	registry: CanvasElementRegistry,
	canvas: Pick<DiagramCanvasEngine, 'refreshNodePresentation'>,
): void {
	for (const update of updates) {
		registry.updateStyle(update.elementType, update.id, update.style);
		if (update.elementType === 'node') {
			canvas.refreshNodePresentation(update.id);
		}
	}
}
