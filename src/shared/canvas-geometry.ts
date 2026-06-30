export const minimumNodeWidth = 96;
export const minimumNodeHeight = 44;

export interface NodeBoundsUpdate {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}
