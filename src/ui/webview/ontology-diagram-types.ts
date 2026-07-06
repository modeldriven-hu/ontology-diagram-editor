import type { CanvasPoint } from '../../shared/canvas-geometry';
import type { WebviewThemeOverrideMap } from './webview-theme';

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
	readonly ontology?: {
		readonly items?: readonly DiagramOntologyItem[];
		readonly data_properties?: readonly DiagramDataProperty[];
		readonly individuals?: readonly DiagramOntologyIndividual[];
		readonly comments?: readonly DiagramOntologyComment[];
	};
	readonly theme?: WebviewThemeOverrideMap;
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
	readonly show_data_properties?: boolean;
	readonly show_type?: boolean;
	readonly show_property_values?: boolean;
	readonly style?: DiagramElementStyle;
}

export interface DiagramOntologyItem {
	readonly reference: string;
	readonly displayLabel: string;
	readonly type: string;
}

export interface DiagramDataProperty {
	readonly reference: string;
	readonly displayLabel: string;
	readonly domainReferences: readonly string[];
	readonly rangeReferences: readonly string[];
}

export interface DiagramOntologyIndividual {
	readonly reference: string;
	readonly displayLabel: string;
	readonly assertedClassReferences: readonly string[];
	readonly propertyAssertions: readonly DiagramPropertyAssertion[];
}

export interface DiagramPropertyAssertion {
	readonly propertyReference: string;
	readonly value: string;
	readonly valueType: 'literal' | 'resource';
	readonly datatypeReference?: string;
	readonly language?: string;
}

export interface DiagramOntologyComment {
	readonly reference: string;
	readonly comments: readonly string[];
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
	readonly route_layout?: 'orthogonal' | 'direct' | 'one_side' | 'manhattan' | 'metro' | 'entity_relation';
}

export interface DiagramNote {
	readonly id: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly text: string;
	readonly export?: boolean;
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
	readonly style?: DiagramElementStyle;
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
