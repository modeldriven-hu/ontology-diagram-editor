import type { ContainmentDirection, DiagramCanvasBackground, EdgeRenderAs, EdgeRouteLayout, IndividualTypeDisplay, NodeLabelTextOverflow, OntologyColorBy, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, LegendBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import type { CanvasViewport } from './canvas-viewport';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from './diagram-layout';

export interface ModelTreeItemDropPayload {
	readonly sourceOntologyFilePath?: string;
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
	readonly ontologyItemMetadata?: unknown;
}

export type StyledCanvasElementType = 'node' | 'edge' | 'note' | 'image' | 'label' | 'metadata' | 'legend';
export type DiagramThemeMode = 'light' | 'dark';

export interface DiagramMetadataPatch {
	readonly title?: string;
	readonly authors?: readonly string[];
	readonly diagram_version?: string;
	readonly theme_file?: string;
	readonly show_ontology_information?: boolean;
	readonly canvas_background?: DiagramCanvasBackground;
	readonly show_grid?: boolean;
}

export interface FontStylePatch {
	readonly family?: string;
	readonly bold?: boolean;
	readonly italic?: boolean;
	readonly size?: number;
}

export interface BorderStylePatch {
	readonly type?: 'solid' | 'dashed' | 'dotted' | 'none';
	readonly weight?: number;
	readonly color?: string;
}

export interface CommonStylePatch {
	readonly bg_color?: string;
	readonly text_color?: string;
	readonly font?: FontStylePatch;
	readonly border?: BorderStylePatch;
	readonly corner_radius?: number;
	readonly shadow?: boolean;
	readonly image_fit?: 'contain' | 'cover' | 'match_width' | 'match_height';
}

export interface EdgeStylePatch {
	readonly color?: string;
	readonly line_style?: 'solid' | 'dashed' | 'dotted' | 'none';
	readonly weight?: number;
	readonly text_color?: string;
	readonly font?: FontStylePatch;
}

export interface LabelStylePatch {
	readonly text_color?: string;
	readonly font?: FontStylePatch;
}

export type ElementStylePatch = CommonStylePatch | EdgeStylePatch | LabelStylePatch;

export interface ElementStyleUpdate {
	readonly elementType: StyledCanvasElementType;
	readonly id: string;
	readonly style?: ElementStylePatch;
}

