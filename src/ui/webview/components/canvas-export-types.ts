export type ExportFormat = 'svg' | 'png';

export interface DiagramExport {
	readonly svg: string;
	readonly width: number;
	readonly height: number;
	readonly defaultFileName: string;
}

export interface ExportBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

export interface TextBlockOptions {
	readonly id: string;
	readonly text: string;
	readonly bounds: ExportBounds;
	readonly color: string;
	readonly fontFamily: string;
	readonly fontSize: number;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly align: 'left' | 'center';
	readonly verticalAlign: 'top' | 'middle';
	readonly padding: number;
	readonly lineHeight?: number;
	readonly wrap?: boolean;
	readonly clip?: boolean;
	readonly limitLines?: boolean;
}


