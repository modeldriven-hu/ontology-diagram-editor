import type { ContainmentDirection, EdgeRenderAs, EdgeRouteLayout, IndividualTypeDisplay, NodeLabelTextOverflow, OntologyColorBy, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, LegendBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import type { CanvasViewport } from './canvas-viewport';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from './diagram-layout';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, DiagramThemeMode, EdgeStylePatch, ElementStylePatch, ElementStyleUpdate, LabelStylePatch, ModelTreeItemDropPayload, StyledCanvasElementType } from './webview-command-types';

export class UpdateLegendColorsCommand {
	public readonly type = 'updateLegendColors';
	public constructor(
		public readonly id: string,
		public readonly colors: Readonly<Record<string, string>>,
		public readonly colorMode?: 'border' | 'background',
		public readonly colorBy?: OntologyColorBy,
	) {}
}

export class UpdateLegendColorByCommand {
	public readonly type = 'updateLegendColorBy';
	public constructor(public readonly id: string, public readonly colorBy: OntologyColorBy) {}
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

export class UpdateNodeTypeDisplayCommand {
	public readonly type = 'updateNodeTypeDisplay';

	public constructor(
		public readonly ids: readonly string[],
		public readonly typeDisplay: IndividualTypeDisplay,
	) {}
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

export class UpdateNodeLabelTextOverflowCommand {
	public readonly type = 'updateNodeLabelTextOverflow';
	public readonly id: string;
	public readonly textOverflow: NodeLabelTextOverflow;

	public constructor(id: string, textOverflow: NodeLabelTextOverflow) {
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

export class PickNodeImageCommand {
	public readonly type = 'pickNodeImage';
	public readonly id: string;
	public readonly source: string | undefined;
	public readonly pickFile: boolean;

	public constructor(id: string, source?: string, pickFile = false) {
		this.id = id;
		this.source = source;
		this.pickFile = pickFile;
	}
}

export class PickImageSourceCommand {
	public readonly type = 'pickImageSource';
	public readonly id: string;
	public readonly source: string | undefined;
	public readonly pickFile: boolean;

	public constructor(id: string, source?: string, pickFile = false) {
		this.id = id;
		this.source = source;
		this.pickFile = pickFile;
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

export class UpdateElementStylesCommand {
	public readonly type = 'updateElementStyles';
	public readonly updates: readonly ElementStyleUpdate[];

	public constructor(updates: readonly ElementStyleUpdate[]) {
		this.updates = updates;
	}
}

export class UpdateNodeLabelTextOverflowsCommand {
	public readonly type = 'updateNodeLabelTextOverflows';
	public readonly ids: readonly string[];
	public readonly textOverflow: NodeLabelTextOverflow;

	public constructor(ids: readonly string[], textOverflow: NodeLabelTextOverflow) {
		this.ids = ids;
		this.textOverflow = textOverflow;
	}
}

export class OpenDiagramLinkCommand {
	public readonly type = 'openDiagramLink';
	public constructor(public readonly id: string) {}
}

export class UpdateDiagramLinkReferenceCommand {
	public readonly type = 'updateDiagramLinkReference';
	public constructor(
		public readonly id: string,
		public readonly reference?: string,
		public readonly pickFile = false,
	) {}
}

export class UpdateDiagramLinkIconCommand {
	public readonly type = 'updateDiagramLinkIcon';
	public constructor(
		public readonly id: string,
		public readonly icon?: string,
		public readonly pickFile = false,
	) {}
}
