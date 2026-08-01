import type { ContainmentDirection, EdgeRenderAs, EdgeRouteLayout, IndividualTypeDisplay, NodeLabelTextOverflow, OntologyColorBy, PropertyValueTextOverflow } from '../documents/odiagram';
import type { CanvasPoint, EdgeRouteUpdate, ImageBoundsUpdate, LabelBoundsUpdate, LegendBoundsUpdate, MetadataBoundsUpdate, NodeBoundsUpdate, NoteBoundsUpdate } from './canvas-geometry';
import type { CanvasViewport } from './canvas-viewport';
import { defaultDiagramLayoutAlgorithmId, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from './diagram-layout';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, DiagramThemeMode, EdgeStylePatch, ElementStylePatch, ElementStyleUpdate, LabelStylePatch, ModelTreeItemDropPayload, StyledCanvasElementType } from './webview-command-types';

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

export class OptimizeEdgeRoutesCommand {
	public readonly type = 'optimizeEdgeRoutes';
	public readonly ids: readonly string[];

	public constructor(ids: readonly string[]) {
		this.ids = ids;
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

export class UpdateEdgeRouteLayoutsCommand {
	public readonly type = 'updateEdgeRouteLayouts';
	public readonly ids: readonly string[];
	public readonly routeLayout?: EdgeRouteLayout;

	public constructor(ids: readonly string[], routeLayout?: EdgeRouteLayout) {
		this.ids = ids;
		this.routeLayout = routeLayout;
	}
}

export class UpdateEdgePresentationCommand {
	public readonly type = 'updateEdgePresentation';

	public constructor(
		public readonly id: string,
		public readonly renderAs?: EdgeRenderAs,
		public readonly containmentDirection?: ContainmentDirection,
	) {}
}

export class ShowRelatedElementsCommand {
	public readonly type = 'showRelatedElements';
	public readonly nodeId: string;

	public constructor(nodeId: string) {
		this.nodeId = nodeId;
	}
}

export class ShowEdgesBetweenNodesCommand {
	public readonly type = 'showEdgesBetweenNodes';
	public readonly nodeIds: readonly string[];

	public constructor(nodeIds: readonly string[]) {
		this.nodeIds = nodeIds;
	}
}


