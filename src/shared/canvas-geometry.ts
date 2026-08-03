export const minimumNodeWidth = 96;
export const minimumNodeHeight = 44;
export const minimumNoteWidth = 120;
export const minimumNoteHeight = 64;
export const minimumImageWidth = 32;
export const minimumImageHeight = 32;
export const nodeImageInset = 8;
export const nodeImageReservedHeight = 56;
export const minimumNodeWithImageWidth = Math.max(minimumNodeWidth, minimumImageWidth + (nodeImageInset * 2));
export const minimumNodeWithImageHeight = Math.max(minimumNodeHeight, minimumImageHeight + nodeImageReservedHeight);
export const minimumLabelWidth = 48;
export const minimumLabelHeight = 24;
export const minimumMetadataWidth = 180;
export const minimumMetadataHeight = 84;
export const minimumLegendWidth = 180;
export const minimumLegendHeight = 72;
export const minimumDiagramLinkWidth = 120;
export const minimumDiagramLinkHeight = 88;

export interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

export interface BoundsUpdate {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export type NodeBoundsUpdate = BoundsUpdate;
export type NoteBoundsUpdate = BoundsUpdate;
export type ImageBoundsUpdate = BoundsUpdate;
export type LabelBoundsUpdate = BoundsUpdate;
export type MetadataBoundsUpdate = BoundsUpdate;
export type LegendBoundsUpdate = BoundsUpdate;
export type DiagramLinkBoundsUpdate = BoundsUpdate;

export interface EdgeRouteUpdate {
	readonly id: string;
	readonly points: readonly CanvasPoint[];
	readonly label: CanvasPoint;
	readonly sourceCardinalityLabel?: CanvasPoint;
	readonly targetCardinalityLabel?: CanvasPoint;
}
