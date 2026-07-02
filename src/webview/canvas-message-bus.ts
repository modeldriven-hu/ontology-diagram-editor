import type { CanvasEditorEvent } from '../shared/canvas-editor-events';
import type { WebviewCommand } from '../shared/webview-commands';

export type CanvasMessage = PublishedEvent | PublishedCommand;
export type CanvasMessageListener = (message: CanvasMessage) => void;

export interface PublishedEvent {
	readonly kind: 'event';
	readonly payload: CanvasEditorEvent;
}

export interface PublishedCommand {
	readonly kind: 'command';
	readonly payload: WebviewCommand;
}

export class CanvasMessageBus {
	private readonly listeners = new Set<CanvasMessageListener>();

	public publishEvent(payload: CanvasEditorEvent): void {
		this.publish({
			kind: 'event',
			payload,
		});
	}

	public publishCommand(payload: WebviewCommand): void {
		this.publish({
			kind: 'command',
			payload,
		});
	}

	private publish(event: CanvasMessage): void {
		
		console.debug('CanvasMessageBus.publish', event);

		for (const listener of this.listeners) {
			listener(event);
		}
	}

	public subscribe(listener: CanvasMessageListener): () => void {
		this.listeners.add(listener);

		return () => {
			this.listeners.delete(listener);
		};
	}
}
