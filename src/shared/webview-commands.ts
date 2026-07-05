import type { EdgeRouteLayout } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';

export interface ModelTreeItemDropPayload {
	readonly sourceOntologyFilePath?: string;
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
	readonly ontologyItemMetadata?: unknown;
}

export type StyledCanvasElementType = 'node' | 'edge' | 'note' | 'image' | 'label';
export type DiagramThemeMode = 'light' | 'dark';

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
	| UndoDiagramCommand
	| RedoDiagramCommand
	| CreateNodeCommand
	| CreateNoteCommand
	| CreateCommentNoteCommand
	| CreateNoteConnectionCommand
	| CreateImageCommand
	| CreateLabelCommand
	| SaveDiagramExportCommand
	| DeleteEdgeCommand
	| DeleteNodeCommand
	| DeleteNoteCommand
	| DeleteImageCommand
	| DeleteLabelCommand
	| UpdateNodeBoundsCommand
	| UpdateEdgeRouteCommand
	| OptimizeEdgeRouteCommand
	| UpdateEdgeRouteLayoutCommand
	| UpdateNoteBoundsCommand
	| UpdateImageBoundsCommand
	| UpdateLabelBoundsCommand
	| UpdateNodeImageCommand
	| UpdateNodeDataPropertiesVisibilityCommand
	| UpdateNoteExportVisibilityCommand
	| UpdateImageSourceCommand
	| PickNodeImageCommand
	| PickImageSourceCommand
	| UpdateLabelTextCommand
	| UpdateNoteTextCommand
	| UpdateThemeModeCommand
	| RevealModelTreeItemCommand
	| UpdateElementStyleCommand;

export class ArrangeDiagramCommand {
	public readonly type = 'arrangeDiagram';
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

	public constructor(options: {
		readonly payload?: ModelTreeItemDropPayload;
		readonly position: CanvasPoint;
	}) {
		this.payload = options.payload;
		this.position = options.position;
	}
}

export class UpdateNodeBoundsCommand {
	public readonly type = 'updateNodeBounds';
	public readonly updates: readonly NodeBoundsUpdate[];

	public constructor(updates: readonly NodeBoundsUpdate[]) {
		this.updates = updates;
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

export class UpdateEdgeRouteLayoutCommand {
	public readonly type = 'updateEdgeRouteLayout';
	public readonly id: string;
	public readonly routeLayout?: EdgeRouteLayout;

	public constructor(id: string, routeLayout?: EdgeRouteLayout) {
		this.id = id;
		this.routeLayout = routeLayout;
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
