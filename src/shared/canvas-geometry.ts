export const minimumNodeWidth = 96;
export const minimumNodeHeight = 44;
export const minimumNoteWidth = 120;
export const minimumNoteHeight = 64;

export interface BoundsUpdate {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export type NodeBoundsUpdate = BoundsUpdate;
export type NoteBoundsUpdate = BoundsUpdate;
