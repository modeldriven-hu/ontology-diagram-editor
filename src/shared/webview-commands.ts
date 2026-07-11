import type { EdgeRouteLayout, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId } from './diagram-layout';

export interface ModelTreeItemDropPayload {
	readonly sourceOntologyFilePath?: string;
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
	readonly ontologyItemMetadata?: unknown;
}

export type StyledCanvasElementType = 'node' | 'edge' | 'note' | 'image' | 'label' | 'metadata';
export type DiagramThemeMode = 'light' | 'dark';

export interface DiagramMetadataPatch {
	readonly title?: string;
	readonly authors?: readonly string[];
	readonly diagram_version?: string;
	readonly theme_file?: string;
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

export type WebviewCommand =
	| ArrangeDiagramCommand
	| AlignSubclassEndpointsCommand
	| AlignEdgeStartPointsCommand
	| AlignEdgeEndPointsCommand
	| UndoDiagramCommand
	| RedoDiagramCommand
	| CreateNodeCommand
	| CreateNoteCommand
	| CreateCommentNoteCommand
	| CreateNoteConnectionCommand
	| CreateImageCommand
	| CreateLabelCommand
	| CreateMetadataElementCommand
	| SaveDiagramExportCommand
	| DeleteElementsCommand
	| DeleteEdgeCommand
	| DeleteNodeCommand
	| DeleteNoteCommand
	| DeleteImageCommand
	| DeleteLabelCommand
	| DeleteMetadataElementCommand
	| UpdateElementBoundsCommand
	| UpdateNodeBoundsCommand
	| UpdateEdgeRouteCommand
	| OptimizeEdgeRouteCommand
	| StraightenEdgeRouteCommand
	| UpdateEdgeRouteLayoutCommand
	| ShowRelatedElementsCommand
	| UpdateNoteBoundsCommand
	| UpdateImageBoundsCommand
	| UpdateLabelBoundsCommand
	| UpdateMetadataBoundsCommand
	| UpdateNodeImageCommand
	| UpdateNodeDataPropertiesVisibilityCommand
	| UpdateNodeTypeVisibilityCommand
	| UpdateNodePropertyValuesVisibilityCommand
	| UpdateNodePropertyValueTextOverflowCommand
	| UpdateNoteExportVisibilityCommand
	| UpdateImageSourceCommand
	| PickNodeImageCommand
	| PickImageSourceCommand
	| UpdateLabelTextCommand
	| UpdateDiagramMetadataCommand
	| UpdateNoteTextCommand
	| UpdateThemeModeCommand
	| RevealModelTreeItemCommand
	| UpdateElementStyleCommand;

export class ArrangeDiagramCommand {
	public readonly type = 'arrangeDiagram';
	public readonly algorithmId: DiagramLayoutAlgorithmId;

	public constructor(algorithmId: DiagramLayoutAlgorithmId = defaultDiagramLayoutAlgorithmId) {
		this.algorithmId = algorithmId;
	}
}

export class AlignSubclassEndpointsCommand {
	public readonly type = 'alignSubclassEndpoints';
	public readonly nodeIds: readonly string[];

	public constructor(nodeIds: readonly string[]) {
		this.nodeIds = nodeIds;
	}
}

export class AlignEdgeStartPointsCommand {
	public readonly type = 'alignEdgeStartPoints';
	public readonly edgeIds: readonly string[];

	public constructor(edgeIds: readonly string[]) {
		this.edgeIds = edgeIds;
	}
}

export class AlignEdgeEndPointsCommand {
	public readonly type = 'alignEdgeEndPoints';
	public readonly edgeIds: readonly string[];

	public constructor(edgeIds: readonly string[]) {
		this.edgeIds = edgeIds;
	}
}

export class UndoDiagramCommand {
	public readonly type = 'undoDiagram';
}

export class RedoDiagramCommand {
	public readonly type = 'redoDiagram';
}

export class CreateNodeCommand {
	public readonly type = 'createNode';
	public readonly payload?: ModelTreeItemDropPayload;
	public readonly position: CanvasPoint;
	public readonly size?: {
		readonly width: number;
		readonly height: number;
	};

	public constructor(options: {
		readonly payload?: ModelTreeItemDropPayload;
		readonly position: CanvasPoint;
		readonly size?: {
			readonly width: number;
			readonly height: number;
		};
	}) {
		this.payload = options.payload;
		this.position = options.position;
		this.size = options.size;
	}
}

export class UpdateNodeBoundsCommand {
	public readonly type = 'updateNodeBounds';
	public readonly updates: readonly NodeBoundsUpdate[];

	public constructor(updates: readonly NodeBoundsUpdate[]) {
		this.updates = updates;
	}
}

export class UpdateElementBoundsCommand {
	public readonly type = 'updateElementBounds';
	public readonly nodeUpdates: readonly NodeBoundsUpdate[];
	public readonly noteUpdates: readonly NoteBoundsUpdate[];
	public readonly imageUpdates: readonly ImageBoundsUpdate[];
	public readonly labelUpdates: readonly LabelBoundsUpdate[];
	public readonly metadataUpdates: readonly MetadataBoundsUpdate[];

	public constructor(options: {
		readonly nodeUpdates?: readonly NodeBoundsUpdate[];
		readonly noteUpdates?: readonly NoteBoundsUpdate[];
		readonly imageUpdates?: readonly ImageBoundsUpdate[];
		readonly labelUpdates?: readonly LabelBoundsUpdate[];
		readonly metadataUpdates?: readonly MetadataBoundsUpdate[];
	}) {
		this.nodeUpdates = options.nodeUpdates ?? [];
		this.noteUpdates = options.noteUpdates ?? [];
		this.imageUpdates = options.imageUpdates ?? [];
		this.labelUpdates = options.labelUpdates ?? [];
		this.metadataUpdates = options.metadataUpdates ?? [];
	}
}

export class UpdateEdgeRouteCommand {
	public readonly type = 'updateEdgeRoute';
	public readonly updates: readonly EdgeRouteUpdate[];

	public constructor(updates: readonly EdgeRouteUpdate[]) {
		this.updates = updates;
	}
}

export class OptimizeEdgeRouteCommand {
	public readonly type = 'optimizeEdgeRoute';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class StraightenEdgeRouteCommand {
	public readonly type = 'straightenEdgeRoute';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class UpdateEdgeRouteLayoutCommand {
	public readonly type = 'updateEdgeRouteLayout';
	public readonly id: string;
	public readonly routeLayout?: EdgeRouteLayout;

	public constructor(id: string, routeLayout?: EdgeRouteLayout) {
		this.id = id;
		this.routeLayout = routeLayout;
	}
}

export class ShowRelatedElementsCommand {
	public readonly type = 'showRelatedElements';
	public readonly nodeId: string;

	public constructor(nodeId: string) {
		this.nodeId = nodeId;
	}
}

export class CreateNoteCommand {
	public readonly type = 'createNote';
	public readonly text: string;
	public readonly position: CanvasPoint;

	public constructor(text: string, position: CanvasPoint) {
		this.text = text;
		this.position = position;
	}
}

export class CreateCommentNoteCommand {
	public readonly type = 'createCommentNote';
	public readonly nodeId: string;
	public readonly comment: string;

	public constructor(nodeId: string, comment: string) {
		this.nodeId = nodeId;
		this.comment = comment;
	}
}

export class CreateNoteConnectionCommand {
	public readonly type = 'createNoteConnection';
	public readonly noteId: string;
	public readonly targetId: string;

	public constructor(noteId: string, targetId: string) {
		this.noteId = noteId;
		this.targetId = targetId;
	}
}

export class CreateImageCommand {
	public readonly type = 'createImage';
	public readonly position: CanvasPoint;

	public constructor(position: CanvasPoint) {
		this.position = position;
	}
}

export class CreateLabelCommand {
	public readonly type = 'createLabel';
	public readonly text: string;
	public readonly position: CanvasPoint;

	public constructor(text: string, position: CanvasPoint) {
		this.text = text;
		this.position = position;
	}
}

export class CreateMetadataElementCommand {
	public readonly type = 'createMetadataElement';

	public constructor(public readonly position: CanvasPoint) {}
}

export class SaveDiagramExportCommand {
	public readonly type = 'saveDiagramExport';
	public readonly format: 'svg' | 'png';
	public readonly defaultFileName: string;
	public readonly content: string;
	public readonly encoding: 'utf8' | 'base64';

	public constructor(options: {
		readonly format: 'svg' | 'png';
		readonly defaultFileName: string;
		readonly content: string;
		readonly encoding: 'utf8' | 'base64';
	}) {
		this.format = options.format;
		this.defaultFileName = options.defaultFileName;
		this.content = options.content;
		this.encoding = options.encoding;
	}
}

export class DeleteNodeCommand {
	public readonly type = 'deleteNode';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class DeleteElementsCommand {
	public readonly type = 'deleteElements';
	public readonly ids: readonly string[];

	public constructor(ids: readonly string[]) {
		this.ids = ids;
	}
}

export class DeleteEdgeCommand {
	public readonly type = 'deleteEdge';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class DeleteNoteCommand {
	public readonly type = 'deleteNote';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class DeleteImageCommand {
	public readonly type = 'deleteImage';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class DeleteLabelCommand {
	public readonly type = 'deleteLabel';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class DeleteMetadataElementCommand {
	public readonly type = 'deleteMetadataElement';

	public constructor(public readonly id: string) {}
}

export class UpdateNoteBoundsCommand {
	public readonly type = 'updateNoteBounds';
	public readonly updates: readonly NoteBoundsUpdate[];

	public constructor(updates: readonly NoteBoundsUpdate[]) {
		this.updates = updates;
	}
}

export class UpdateImageBoundsCommand {
	public readonly type = 'updateImageBounds';
	public readonly updates: readonly ImageBoundsUpdate[];

	public constructor(updates: readonly ImageBoundsUpdate[]) {
		this.updates = updates;
	}
}

export class UpdateLabelBoundsCommand {
	public readonly type = 'updateLabelBounds';
	public readonly updates: readonly LabelBoundsUpdate[];

	public constructor(updates: readonly LabelBoundsUpdate[]) {
		this.updates = updates;
	}
}

export class UpdateMetadataBoundsCommand {
	public readonly type = 'updateMetadataBounds';

	public constructor(public readonly updates: readonly MetadataBoundsUpdate[]) {}
}

export class UpdateNodeImageCommand {
	public readonly type = 'updateNodeImage';
	public readonly id: string;
	public readonly image?: string;

	public constructor(id: string, image?: string) {
		this.id = id;
		this.image = image;
	}
}

export class UpdateNodeDataPropertiesVisibilityCommand {
	public readonly type = 'updateNodeDataPropertiesVisibility';
	public readonly id: string;
	public readonly showDataProperties: boolean;

	public constructor(id: string, showDataProperties: boolean) {
		this.id = id;
		this.showDataProperties = showDataProperties;
	}
}

export class UpdateNodeTypeVisibilityCommand {
	public readonly type = 'updateNodeTypeVisibility';
	public readonly id: string;
	public readonly showType: boolean;

	public constructor(id: string, showType: boolean) {
		this.id = id;
		this.showType = showType;
	}
}

export class UpdateNodePropertyValuesVisibilityCommand {
	public readonly type = 'updateNodePropertyValuesVisibility';
	public readonly id: string;
	public readonly showPropertyValues: boolean;

	public constructor(id: string, showPropertyValues: boolean) {
		this.id = id;
		this.showPropertyValues = showPropertyValues;
	}
}

export class UpdateNodePropertyValueTextOverflowCommand {
	public readonly type = 'updateNodePropertyValueTextOverflow';
	public readonly id: string;
	public readonly textOverflow: PropertyValueTextOverflow;

	public constructor(id: string, textOverflow: PropertyValueTextOverflow) {
		this.id = id;
		this.textOverflow = textOverflow;
	}
}

export class UpdateNoteExportVisibilityCommand {
	public readonly type = 'updateNoteExportVisibility';
	public readonly id: string;
	public readonly exported: boolean;

	public constructor(id: string, exported: boolean) {
		this.id = id;
		this.exported = exported;
	}
}

export class UpdateImageSourceCommand {
	public readonly type = 'updateImageSource';
	public readonly id: string;
	public readonly source: string;

	public constructor(id: string, source: string) {
		this.id = id;
		this.source = source;
	}
}

export class PickNodeImageCommand {
	public readonly type = 'pickNodeImage';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class PickImageSourceCommand {
	public readonly type = 'pickImageSource';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class UpdateNoteTextCommand {
	public readonly type = 'updateNoteText';
	public readonly id: string;
	public readonly text: string;

	public constructor(id: string, text: string) {
		this.id = id;
		this.text = text;
	}
}

export class UpdateLabelTextCommand {
	public readonly type = 'updateLabelText';
	public readonly id: string;
	public readonly text: string;

	public constructor(id: string, text: string) {
		this.id = id;
		this.text = text;
	}
}

export class UpdateDiagramMetadataCommand {
	public readonly type = 'updateDiagramMetadata';
	public readonly metadata: DiagramMetadataPatch;

	public constructor(metadata: DiagramMetadataPatch) {
		this.metadata = metadata;
	}
}

export class UpdateThemeModeCommand {
	public readonly type = 'updateThemeMode';
	public readonly themeMode: DiagramThemeMode;

	public constructor(themeMode: DiagramThemeMode) {
		this.themeMode = themeMode;
	}
}

export class RevealModelTreeItemCommand {
	public readonly type = 'revealModelTreeItem';
	public readonly id: string;

	public constructor(id: string) {
		this.id = id;
	}
}

export class UpdateElementStyleCommand {
	public readonly type = 'updateElementStyle';
	public readonly elementType: StyledCanvasElementType;
	public readonly id: string;
	public readonly style?: ElementStylePatch;

	public constructor(elementType: StyledCanvasElementType, id: string, style?: ElementStylePatch) {
		this.elementType = elementType;
		this.id = id;
		this.style = style;
	}
}
