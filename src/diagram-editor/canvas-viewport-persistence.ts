import type { CanvasViewport } from '../shared/canvas-viewport';

export interface CanvasViewportStorage {
	get<T>(key: string): T | undefined;
	update(key: string, value: unknown): Thenable<void>;
}

export class CanvasViewportPersistence {
	private readonly key: string;
	private currentViewport?: CanvasViewport;

	public constructor(
		diagramUri: string,
		private readonly storage: CanvasViewportStorage,
	) {
		this.key = `ontologyDiagramEditor.viewport.${diagramUri}`;
		this.currentViewport = storage.get<CanvasViewport>(this.key);
	}

	public current(): CanvasViewport | undefined {
		return this.currentViewport;
	}

	public capture(viewport: CanvasViewport): void {
		this.currentViewport = viewport;
	}

	public async save(): Promise<void> {
		if (this.currentViewport !== undefined) {
			await this.storage.update(this.key, this.currentViewport);
		}
	}
}
