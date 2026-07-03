import type { CanvasPoint } from '../../shared/canvas-geometry';

export interface DiagramPayload {
	readonly file?: {
		readonly fsPath: string;
		readonly uri: string;
		readonly directory: string;
	};
	readonly diagram?: {
		readonly metadata?: {
			readonly title?: string;
			readonly theme_file?: string;
			readonly theme_mode?: 'light' | 'dark';
		};
		readonly ontologies?: readonly unknown[];
		readonly namespaces?: Record<string, string>;
		readonly nodes?: readonly DiagramNode[];
		readonly edges?: readonly DiagramEdge[];
		readonly notes?: readonly DiagramNote[];
		readonly images?: readonly DiagramImage[];
		readonly labels?: readonly DiagramLabel[];
	};
	readonly error?: string;
}

export interface DiagramNode {
	readonly id: string;
	readonly ontology_ref: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly ontology_item_type?: string;
	readonly image?: string;
	readonly style?: DiagramElementStyle;
}

export interface DiagramEdge {
	readonly id: string;
	readonly source: string;
	readonly target: string;
	readonly ontology_ref: string;
	readonly label: CanvasPoint;
	readonly points: readonly CanvasPoint[];
	readonly ontology_item_type?: string;
	readonly style?: DiagramEdgeStyle;
}

export interface DiagramNote {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text: string;
	readonly style?: DiagramElementStyle;
}

export interface DiagramImage {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly source: string;
	readonly webview_src: string;
}

export interface DiagramLabel {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text: string;
	readonly style?: DiagramLabelStyle;
}

export interface DiagramElementStyle {
	readonly bg_color?: string;
	readonly text_color?: string;
	readonly font?: {
		readonly family?: string;
		readonly bold?: boolean;
		readonly italic?: boolean;
		readonly size?: number;
	};
	readonly border?: {
		readonly type?: 'solid' | 'dashed' | 'dotted' | 'none';
		readonly weight?: number;
		readonly color?: string;
	};
	readonly corner_radius?: number;
	readonly shadow?: boolean;
}

export interface DiagramLabelStyle {
	readonly text_color?: string;
	readonly font?: {
		readonly family?: string;
		readonly bold?: boolean;
		readonly italic?: boolean;
		readonly size?: number;
	};
}

export interface DiagramEdgeStyle {
	readonly color?: string;
	readonly line_style?: 'solid' | 'dashed' | 'dotted' | 'none';
	readonly weight?: number;
	readonly text_color?: string;
	readonly font?: {
		readonly family?: string;
		readonly bold?: boolean;
		readonly italic?: boolean;
		readonly size?: number;
	};
}
