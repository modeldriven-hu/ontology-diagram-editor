import type { ContainmentDirection, EdgeRenderAs, EdgeRouteLayout, IndividualTypeDisplay, NodeLabelTextOverflow, OntologyColorBy, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, LegendBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import type { CanvasViewport } from './canvas-viewport';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from './diagram-layout';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, DiagramThemeMode, EdgeStylePatch, ElementStylePatch, ElementStyleUpdate, LabelStylePatch, ModelTreeItemDropPayload, StyledCanvasElementType } from './webview-command-types';

export class ArrangeDiagramCommand {
	public readonly type = 'arrangeDiagram';
	public readonly algorithmId: DiagramLayoutAlgorithmId;
	public readonly elkLayeredOptions: ElkLayeredLayoutOptions | undefined;
	public readonly selectedNodeIds: readonly string[] | undefined;

	public constructor(
		algorithmId: DiagramLayoutAlgorithmId = defaultDiagramLayoutAlgorithmId,
		elkLayeredOptions?: ElkLayeredLayoutOptions,
		selectedNodeIds?: readonly string[],
	) {
		this.algorithmId = algorithmId;
		this.elkLayeredOptions = elkLayeredOptions;
		this.selectedNodeIds = selectedNodeIds;
	}
}

export class UpdateCanvasViewportCommand {
	public readonly type = 'updateCanvasViewport';
	public readonly viewport: CanvasViewport;

	public constructor(viewport: CanvasViewport) {
		this.viewport = viewport;
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

export class AddOntologyItemCommand {
	public readonly type = 'addOntologyItem';

	public constructor(public readonly position: CanvasPoint) {}
}


