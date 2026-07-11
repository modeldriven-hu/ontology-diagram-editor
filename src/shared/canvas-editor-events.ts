import type { BoundsUpdate } from './canvas-geometry';

export type CanvasElementType = 'diagram' | 'node' | 'edge' | 'note' | 'image' | 'label' | 'metadata';

export type CanvasEditorEvent =
	| CanvasRenderedEvent
	| CanvasSelectionChangedEvent
	| CanvasViewportChangedEvent
	| CanvasDragCompletedEvent
	| CanvasUndoRequestedEvent
	| CanvasRedoRequestedEvent
	| CanvasPropertyEditedEvent
	| CanvasPropertyPanelVisibilityChangedEvent;

export class CanvasRenderedEvent {
	public readonly type = 'canvasRendered';
	public readonly diagramFilePath?: string;
	public readonly renderedElementIdentifiers: readonly string[];
	public readonly warnings: readonly string[];

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly renderedElementIdentifiers: readonly string[];
		readonly warnings: readonly string[];
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.renderedElementIdentifiers = options.renderedElementIdentifiers;
		this.warnings = options.warnings;
	}
}

export class CanvasSelectionChangedEvent {
	public readonly type = 'canvasSelectionChanged';
	public readonly diagramFilePath?: string;
	public readonly selectedElementIdentifier?: string;
	public readonly selectedElementType?: CanvasElementType;
	public readonly selectedElementIdentifiers: readonly string[];

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly selectedElementIdentifier?: string;
		readonly selectedElementType?: CanvasElementType;
		readonly selectedElementIdentifiers?: readonly string[];
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.selectedElementIdentifier = options.selectedElementIdentifier;
		this.selectedElementType = options.selectedElementType;
		this.selectedElementIdentifiers = options.selectedElementIdentifiers ?? [];
	}
}

export class CanvasViewportChangedEvent {
	public readonly type = 'canvasViewportChanged';
	public readonly diagramFilePath?: string;
	public readonly panX: number;
	public readonly panY: number;
	public readonly zoom: number;
	public readonly changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom';

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly panX: number;
		readonly panY: number;
		readonly zoom: number;
		readonly changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom';
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.panX = options.panX;
		this.panY = options.panY;
		this.zoom = options.zoom;
		this.changeSource = options.changeSource;
	}
}

export class CanvasDragCompletedEvent {
	public readonly type = 'canvasDragCompleted';
	public readonly diagramFilePath?: string;
	public readonly elementIdentifier: string;
	public readonly elementType: CanvasElementType;
	public readonly dragKind: 'move' | 'resize';
	public readonly changedBounds: BoundsUpdate;

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly elementIdentifier: string;
		readonly elementType: CanvasElementType;
		readonly dragKind: 'move' | 'resize';
		readonly changedBounds: BoundsUpdate;
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.elementIdentifier = options.elementIdentifier;
		this.elementType = options.elementType;
		this.dragKind = options.dragKind;
		this.changedBounds = options.changedBounds;
	}
}

export class CanvasUndoRequestedEvent {
	public readonly type = 'canvasUndoRequested';
	public readonly diagramFilePath?: string;

	public constructor(options: {
		readonly diagramFilePath?: string;
	}) {
		this.diagramFilePath = options.diagramFilePath;
	}
}

export class CanvasRedoRequestedEvent {
	public readonly type = 'canvasRedoRequested';
	public readonly diagramFilePath?: string;

	public constructor(options: {
		readonly diagramFilePath?: string;
	}) {
		this.diagramFilePath = options.diagramFilePath;
	}
}

export class CanvasPropertyEditedEvent {
	public readonly type = 'canvasPropertyEdited';
	public readonly diagramFilePath?: string;
	public readonly elementIdentifier: string;
	public readonly elementType: CanvasElementType;
	public readonly changedFields: readonly string[];

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly elementIdentifier: string;
		readonly elementType: CanvasElementType;
		readonly changedFields: readonly string[];
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.elementIdentifier = options.elementIdentifier;
		this.elementType = options.elementType;
		this.changedFields = options.changedFields;
	}
}

export class CanvasPropertyPanelVisibilityChangedEvent {
	public readonly type = 'canvasPropertyPanelVisibilityChanged';
	public readonly diagramFilePath?: string;
	public readonly visible: boolean;
	public readonly collapsed: boolean;
	public readonly panelHeight: number;

	public constructor(options: {
		readonly diagramFilePath?: string;
		readonly visible: boolean;
		readonly collapsed: boolean;
		readonly panelHeight: number;
	}) {
		this.diagramFilePath = options.diagramFilePath;
		this.visible = options.visible;
		this.collapsed = options.collapsed;
		this.panelHeight = options.panelHeight;
	}
}
