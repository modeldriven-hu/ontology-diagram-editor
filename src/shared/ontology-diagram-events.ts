import type { EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';

export interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

export interface ModelTreeItemDropPayload {
	readonly sourceOntologyFilePath?: string;
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
	readonly ontologyItemMetadata?: unknown;
}

export type WebviewMessage =
	| CreateNodeMessage
	| CreateNoteMessage
	| CreateImageMessage
	| CreateLabelMessage
	| SaveDiagramExportMessage
	| DeleteNodeMessage
	| DeleteNoteMessage
	| DeleteImageMessage
	| DeleteLabelMessage
	| UpdateNodeBoundsMessage
	| UpdateEdgeRouteMessage
	| UpdateNoteBoundsMessage
	| UpdateImageBoundsMessage
	| UpdateLabelBoundsMessage
	| UpdateNodeImageMessage
	| UpdateImageSourceMessage
	| PickNodeImageMessage
	| PickImageSourceMessage
	| UpdateLabelTextMessage
	| UpdateNoteTextMessage;

export interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDropPayload;
	readonly position: CanvasPoint;
}

export interface UpdateNodeBoundsMessage {
	readonly type: 'updateNodeBounds';
	readonly updates: readonly NodeBoundsUpdate[];
}

export interface UpdateEdgeRouteMessage {
	readonly type: 'updateEdgeRoute';
	readonly updates: readonly EdgeRouteUpdate[];
}

export interface CreateNoteMessage {
	readonly type: 'createNote';
	readonly text: string;
	readonly position: CanvasPoint;
}

export interface CreateImageMessage {
	readonly type: 'createImage';
	readonly position: CanvasPoint;
}

export interface CreateLabelMessage {
	readonly type: 'createLabel';
	readonly text: string;
	readonly position: CanvasPoint;
}

export interface SaveDiagramExportMessage {
	readonly type: 'saveDiagramExport';
	readonly format: 'svg' | 'png';
	readonly defaultFileName: string;
	readonly content: string;
	readonly encoding: 'utf8' | 'base64';
}

export interface DeleteNodeMessage {
	readonly type: 'deleteNode';
	readonly id: string;
}

export interface DeleteNoteMessage {
	readonly type: 'deleteNote';
	readonly id: string;
}

export interface DeleteImageMessage {
	readonly type: 'deleteImage';
	readonly id: string;
}

export interface DeleteLabelMessage {
	readonly type: 'deleteLabel';
	readonly id: string;
}

export interface UpdateNoteBoundsMessage {
	readonly type: 'updateNoteBounds';
	readonly updates: readonly NoteBoundsUpdate[];
}

export interface UpdateImageBoundsMessage {
	readonly type: 'updateImageBounds';
	readonly updates: readonly ImageBoundsUpdate[];
}

export interface UpdateLabelBoundsMessage {
	readonly type: 'updateLabelBounds';
	readonly updates: readonly LabelBoundsUpdate[];
}

export interface UpdateNodeImageMessage {
	readonly type: 'updateNodeImage';
	readonly id: string;
	readonly image?: string;
}

export interface UpdateImageSourceMessage {
	readonly type: 'updateImageSource';
	readonly id: string;
	readonly source: string;
}

export interface PickNodeImageMessage {
	readonly type: 'pickNodeImage';
	readonly id: string;
}

export interface PickImageSourceMessage {
	readonly type: 'pickImageSource';
	readonly id: string;
}

export interface UpdateNoteTextMessage {
	readonly type: 'updateNoteText';
	readonly id: string;
	readonly text: string;
}

export interface UpdateLabelTextMessage {
	readonly type: 'updateLabelText';
	readonly id: string;
	readonly text: string;
}
