import type { NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';

export interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

export interface ModelTreeItemDropPayload {
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
}

export type WebviewMessage = CreateNodeMessage | CreateNoteMessage | UpdateNodeBoundsMessage | UpdateNoteBoundsMessage | UpdateNoteTextMessage;

export interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDropPayload;
	readonly position: CanvasPoint;
}

export interface UpdateNodeBoundsMessage {
	readonly type: 'updateNodeBounds';
	readonly updates: readonly NodeBoundsUpdate[];
}

export interface CreateNoteMessage {
	readonly type: 'createNote';
	readonly text: string;
	readonly position: CanvasPoint;
}

export interface UpdateNoteBoundsMessage {
	readonly type: 'updateNoteBounds';
	readonly updates: readonly NoteBoundsUpdate[];
}

export interface UpdateNoteTextMessage {
	readonly type: 'updateNoteText';
	readonly id: string;
	readonly text: string;
}
