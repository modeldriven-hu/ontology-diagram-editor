import type { ContainmentDirection, EdgeRenderAs, EdgeRouteLayout, IndividualTypeDisplay, NodeLabelTextOverflow, OntologyColorBy, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, DiagramLinkBoundsUpdate, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, LegendBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import type { CanvasViewport } from './canvas-viewport';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from './diagram-layout';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, DiagramThemeMode, EdgeStylePatch, ElementStylePatch, ElementStyleUpdate, LabelStylePatch, ModelTreeItemDropPayload, StyledCanvasElementType } from './webview-command-types';

export class CreateNodeCommand {
	public readonly type = 'createNode';
	public readonly payload?: ModelTreeItemDropPayload;
	public readonly payloads?: readonly ModelTreeItemDropPayload[];
	public readonly position: CanvasPoint;

	public constructor(options: {
		readonly payload?: ModelTreeItemDropPayload;
		readonly payloads?: readonly ModelTreeItemDropPayload[];
		readonly position: CanvasPoint;
	}) {
		this.payload = options.payload;
		this.payloads = options.payloads;
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

export class UpdateElementBoundsCommand {
	public readonly type = 'updateElementBounds';
	public readonly nodeUpdates: readonly NodeBoundsUpdate[];
	public readonly noteUpdates: readonly NoteBoundsUpdate[];
	public readonly imageUpdates: readonly ImageBoundsUpdate[];
	public readonly labelUpdates: readonly LabelBoundsUpdate[];
	public readonly metadataUpdates: readonly MetadataBoundsUpdate[];
	public readonly legendUpdates: readonly LegendBoundsUpdate[];
	public readonly diagramLinkUpdates: readonly DiagramLinkBoundsUpdate[];

	public constructor(options: {
		readonly nodeUpdates?: readonly NodeBoundsUpdate[];
		readonly noteUpdates?: readonly NoteBoundsUpdate[];
		readonly imageUpdates?: readonly ImageBoundsUpdate[];
		readonly labelUpdates?: readonly LabelBoundsUpdate[];
		readonly metadataUpdates?: readonly MetadataBoundsUpdate[];
		readonly legendUpdates?: readonly LegendBoundsUpdate[];
		readonly diagramLinkUpdates?: readonly DiagramLinkBoundsUpdate[];
	}) {
		this.nodeUpdates = options.nodeUpdates ?? [];
		this.noteUpdates = options.noteUpdates ?? [];
		this.imageUpdates = options.imageUpdates ?? [];
		this.labelUpdates = options.labelUpdates ?? [];
		this.metadataUpdates = options.metadataUpdates ?? [];
		this.legendUpdates = options.legendUpdates ?? [];
		this.diagramLinkUpdates = options.diagramLinkUpdates ?? [];
	}
}

export class CreateDiagramLinkCommand {
	public readonly type = 'createDiagramLink';
	public constructor(public readonly position: CanvasPoint) {}
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
	public readonly source: string | undefined;
	public readonly pickFile: boolean;

	public constructor(position: CanvasPoint, source?: string, pickFile = false) {
		this.position = position;
		this.source = source;
		this.pickFile = pickFile;
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

export class CreateLegendElementCommand {
	public readonly type = 'createLegendElement';
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

export class DeleteLegendElementCommand {
	public readonly type = 'deleteLegendElement';
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

export class UpdateLegendBoundsCommand {
	public readonly type = 'updateLegendBounds';
	public constructor(public readonly updates: readonly LegendBoundsUpdate[]) {}
}

