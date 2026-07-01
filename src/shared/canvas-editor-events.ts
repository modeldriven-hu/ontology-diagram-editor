import type { BoundsUpdate } from './canvas-geometry';

export type CanvasElementType = 'node' | 'edge' | 'note' | 'image' | 'label';

export type CanvasEditorEvent =
	| CanvasRenderedEvent
	| CanvasSelectionChangedEvent
	| CanvasViewportChangedEvent
	| CanvasDragCompletedEvent
	| CanvasPropertyEditedEvent
	| CanvasPropertyPanelVisibilityChangedEvent;

export interface CanvasRenderedEvent {
	readonly type: 'canvasRendered';
	readonly diagramFilePath?: string;
	readonly renderedElementIdentifiers: readonly string[];
	readonly warnings: readonly string[];
}

export interface CanvasSelectionChangedEvent {
	readonly type: 'canvasSelectionChanged';
	readonly diagramFilePath?: string;
	readonly selectedElementIdentifier?: string;
	readonly selectedElementType?: CanvasElementType;
}

export interface CanvasViewportChangedEvent {
	readonly type: 'canvasViewportChanged';
	readonly diagramFilePath?: string;
	readonly panX: number;
	readonly panY: number;
	readonly zoom: number;
	readonly changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom';
}

export interface CanvasDragCompletedEvent {
	readonly type: 'canvasDragCompleted';
	readonly diagramFilePath?: string;
	readonly elementIdentifier: string;
	readonly elementType: CanvasElementType;
	readonly dragKind: 'move' | 'resize';
	readonly changedBounds: BoundsUpdate;
}

export interface CanvasPropertyEditedEvent {
	readonly type: 'canvasPropertyEdited';
	readonly diagramFilePath?: string;
	readonly elementIdentifier: string;
	readonly elementType: CanvasElementType;
	readonly changedFields: readonly string[];
}

export interface CanvasPropertyPanelVisibilityChangedEvent {
	readonly type: 'canvasPropertyPanelVisibilityChanged';
	readonly diagramFilePath?: string;
	readonly visible: boolean;
	readonly collapsed: boolean;
	readonly panelHeight: number;
}
