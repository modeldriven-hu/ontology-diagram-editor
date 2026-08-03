import type { ArrangeDiagramCommand, UpdateCanvasViewportCommand, AlignSubclassEndpointsCommand, AlignEdgeStartPointsCommand, AlignEdgeEndPointsCommand, UndoDiagramCommand, RedoDiagramCommand, AddOntologyItemCommand } from './diagram-commands';
import type { CreateNodeCommand, UpdateNodeBoundsCommand, UpdateElementBoundsCommand, CreateNoteCommand, CreateCommentNoteCommand, CreateNoteConnectionCommand, CreateImageCommand, CreateLabelCommand, CreateMetadataElementCommand, CreateLegendElementCommand, CreateDiagramLinkCommand, SaveDiagramExportCommand, DeleteNodeCommand, DeleteElementsCommand, DeleteEdgeCommand, DeleteNoteCommand, DeleteImageCommand, DeleteLabelCommand, DeleteMetadataElementCommand, DeleteLegendElementCommand, UpdateNoteBoundsCommand, UpdateImageBoundsCommand, UpdateLabelBoundsCommand, UpdateMetadataBoundsCommand, UpdateLegendBoundsCommand } from './lifecycle-commands';
import type { UpdateEdgeRouteCommand, OptimizeEdgeRouteCommand, OptimizeEdgeRoutesCommand, StraightenEdgeRouteCommand, UpdateEdgeRouteLayoutCommand, UpdateEdgeRouteLayoutsCommand, UpdateEdgePresentationCommand, ShowRelatedElementsCommand, ShowEdgesBetweenNodesCommand } from './edge-commands';
import type { UpdateLegendColorsCommand, UpdateLegendColorByCommand, UpdateNodeImageCommand, UpdateNodeDataPropertiesVisibilityCommand, UpdateNodeTypeVisibilityCommand, UpdateNodeTypeDisplayCommand, UpdateNodePropertyValuesVisibilityCommand, UpdateNodePropertyValueTextOverflowCommand, UpdateNodeLabelTextOverflowCommand, UpdateNoteExportVisibilityCommand, PickNodeImageCommand, PickImageSourceCommand, UpdateNoteTextCommand, UpdateLabelTextCommand, UpdateDiagramMetadataCommand, UpdateThemeModeCommand, RevealModelTreeItemCommand, UpdateElementStyleCommand, UpdateElementStylesCommand, UpdateNodeLabelTextOverflowsCommand, OpenDiagramLinkCommand, UpdateDiagramLinkReferenceCommand, UpdateDiagramLinkIconCommand } from './property-commands';

export * from './webview-command-types';
export * from './diagram-commands';
export * from './lifecycle-commands';
export * from './edge-commands';
export * from './property-commands';

export type WebviewCommand =
	| ArrangeDiagramCommand
	| AlignSubclassEndpointsCommand
	| AlignEdgeStartPointsCommand
	| AlignEdgeEndPointsCommand
	| UndoDiagramCommand
	| RedoDiagramCommand
	| AddOntologyItemCommand
	| CreateNodeCommand
	| CreateNoteCommand
	| CreateCommentNoteCommand
	| CreateNoteConnectionCommand
	| CreateImageCommand
	| CreateLabelCommand
	| CreateMetadataElementCommand
	| CreateLegendElementCommand
	| CreateDiagramLinkCommand
	| SaveDiagramExportCommand
	| DeleteElementsCommand
	| DeleteEdgeCommand
	| DeleteNodeCommand
	| DeleteNoteCommand
	| DeleteImageCommand
	| DeleteLabelCommand
	| DeleteMetadataElementCommand
	| DeleteLegendElementCommand
	| UpdateElementBoundsCommand
	| UpdateNodeBoundsCommand
	| UpdateEdgeRouteCommand
	| OptimizeEdgeRouteCommand
	| OptimizeEdgeRoutesCommand
	| StraightenEdgeRouteCommand
	| UpdateEdgeRouteLayoutCommand
	| UpdateEdgeRouteLayoutsCommand
	| UpdateEdgePresentationCommand
	| ShowRelatedElementsCommand
	| ShowEdgesBetweenNodesCommand
	| UpdateNoteBoundsCommand
	| UpdateImageBoundsCommand
	| UpdateLabelBoundsCommand
	| UpdateMetadataBoundsCommand
	| UpdateLegendBoundsCommand
	| UpdateLegendColorsCommand
	| UpdateLegendColorByCommand
	| UpdateNodeImageCommand
	| UpdateNodeDataPropertiesVisibilityCommand
	| UpdateNodeTypeVisibilityCommand
	| UpdateNodeTypeDisplayCommand
	| UpdateNodePropertyValuesVisibilityCommand
	| UpdateNodePropertyValueTextOverflowCommand
	| UpdateNodeLabelTextOverflowCommand
	| UpdateNoteExportVisibilityCommand
	| PickNodeImageCommand
	| PickImageSourceCommand
	| UpdateLabelTextCommand
	| UpdateDiagramMetadataCommand
	| UpdateNoteTextCommand
	| UpdateThemeModeCommand
	| UpdateCanvasViewportCommand
	| RevealModelTreeItemCommand
	| UpdateElementStyleCommand
	| UpdateElementStylesCommand
	| UpdateNodeLabelTextOverflowsCommand
	| OpenDiagramLinkCommand
	| UpdateDiagramLinkReferenceCommand
	| UpdateDiagramLinkIconCommand;
