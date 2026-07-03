import type { CanvasEditorEvent } from '../../../shared/canvas-editor-events';
import type { WebviewCommand } from '../../../shared/webview-commands';

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
		console.log('[ontology-diagram-editor] message-bus publish', event.kind, event.payload);

		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.error('[ontology-diagram-editor] message-bus listener failed', error, event);
			}
		}
	}

	public subscribe(listener: CanvasMessageListener): () => void {
		this.listeners.add(listener);
		console.log('[ontology-diagram-editor] message-bus subscribe', {
			listenerCount: this.listeners.size,
		});

		return () => {
			this.listeners.delete(listener);
			console.log('[ontology-diagram-editor] message-bus unsubscribe', {
				listenerCount: this.listeners.size,
			});
		};
	}
}
