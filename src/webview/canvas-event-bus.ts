import type { CanvasEditorEvent } from '../shared/canvas-editor-events';

export type CanvasEventListener = (event: CanvasEditorEvent) => void;

export interface CanvasEventPublisher {
	publish(event: CanvasEditorEvent): void;
}

export class CanvasEventBus implements CanvasEventPublisher {
	private readonly listeners = new Set<CanvasEventListener>();

	public publish(event: CanvasEditorEvent): void {
		for (const listener of this.listeners) {
			listener(event);
		}
	}

	public subscribe(listener: CanvasEventListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}
}
