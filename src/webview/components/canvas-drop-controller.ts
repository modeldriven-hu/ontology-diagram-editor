import type { CanvasPoint } from '../../shared/canvas-geometry';
import { CreateNodeCommand, type ModelTreeItemDropPayload } from '../../shared/webview-commands';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';

interface CanvasDropControllerOptions {
	readonly scrollElement: HTMLElement;
	readonly contentElement: HTMLElement;
	readonly modelTreeDragMimeType: string;
	readonly messageBus: CanvasMessageBus;
	readonly showStatus: (message: string) => void;
}

export class CanvasDropController {
	public constructor(private readonly options: CanvasDropControllerOptions) {}

	public register(): void {
		this.options.scrollElement.addEventListener('dragover', (event) => {
			event.preventDefault();
			if (event.dataTransfer !== null) {
				event.dataTransfer.dropEffect = 'copy';
			}
			this.options.scrollElement.classList.add('drop-active');
			this.options.scrollElement.classList.remove('drop-rejected');
		});

		this.options.scrollElement.addEventListener('dragleave', (event) => {
			if (event.relatedTarget instanceof Node && this.options.scrollElement.contains(event.relatedTarget)) {
				return;
			}

			this.options.scrollElement.classList.remove('drop-active', 'drop-rejected');
		});

		this.options.scrollElement.addEventListener('drop', (event) => {
			event.preventDefault();
			this.options.scrollElement.classList.remove('drop-active', 'drop-rejected');

			const dragPayload = this.readDragPayload(event.dataTransfer);
			this.options.messageBus.publishCommand(new CreateNodeCommand({
				payload: dragPayload,
				position: this.dropPosition(event),
			}));
		});
	}

	private dropPosition(event: DragEvent): CanvasPoint {
		const rect = this.options.contentElement.getBoundingClientRect();

		return {
			x: Math.max(0, event.clientX - rect.left),
			y: Math.max(0, event.clientY - rect.top),
		};
	}

	private readDragPayload(dataTransfer: DataTransfer | null): ModelTreeItemDropPayload | undefined {
		if (dataTransfer === null) {
			return undefined;
		}

		const raw = dataTransfer.getData(this.options.modelTreeDragMimeType)
			|| dataTransfer.getData('application/vnd.code.tree.ontology-diagram-editor.model-tree')
			|| dataTransfer.getData('text/plain');
		if (raw.length === 0) {
			return undefined;
		}

		try {
			return JSON.parse(raw) as ModelTreeItemDropPayload;
		} catch {
			return undefined;
		}
	}
}
