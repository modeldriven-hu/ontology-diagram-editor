import {
	AlignEdgeEndPointsUseCase,
	AlignEdgeStartPointsUseCase,
	AlignSubclassEndpointsUseCase,
	ApplyLegendColoringUseCase,
	ArrangeDiagramUseCase,
	CreateEdgeUseCase,
	CreateCommentNoteUseCase,
	CreateImageUseCase,
	CreateLabelUseCase,
	CreateMetadataElementUseCase,
	CreateLegendElementUseCase,
	CreateDiagramLinkUseCase,
	CreateNodeUseCase,
	CreateNoteConnectionUseCase,
	CreateNoteUseCase,
	DeleteElementsUseCase,
	DeleteEdgeUseCase,
	DeleteImageUseCase,
	DeleteLabelUseCase,
	DeleteMetadataElementUseCase,
	DeleteLegendElementUseCase,
	DeleteNodeUseCase,
	DeleteNoteUseCase,
	OptimizeEdgeRouteUseCase,
	SaveDiagramExportUseCase,
	ShowRelatedElementsUseCase,
	StraightenEdgeRouteUseCase,
	UpdateEdgeRouteUseCase,
	UpdateEdgeRouteLayoutUseCase,
	UpdateEdgePresentationUseCase,
	UpdateDiagramMetadataUseCase,
	UpdateElementBoundsUseCase,
	UpdateElementStyleUseCase,
	UpdateImageBoundsUseCase,
	UpdateImageSourceUseCase,
	UpdateLabelBoundsUseCase,
	UpdateMetadataBoundsUseCase,
	UpdateLegendBoundsUseCase,
	UpdateLegendColorsUseCase,
	UpdateLegendColorByUseCase,
	UpdateLabelTextUseCase,
	UpdateNodeBoundsUseCase,
	UpdateNodeDataPropertiesVisibilityUseCase,
	UpdateNodeImageUseCase,
	UpdateNodeLabelTextOverflowUseCase,
	UpdateNodePropertyValueTextOverflowUseCase,
	UpdateNodePropertyValuesVisibilityUseCase,
	UpdateNodeTypeVisibilityUseCase,
	UpdateNodeTypeDisplayUseCase,
	UpdateNoteBoundsUseCase,
	UpdateNoteExportVisibilityUseCase,
	UpdateNoteTextUseCase,
	UpdateThemeModeUseCase,
	UpdateDiagramLinkIconUseCase,
	UpdateDiagramLinkReferenceUseCase,
} from './use-cases';
import type { DiagramExportSavePort, DiagramMutationResult } from './use-cases';

import { VsCodeDiagramExportSavePort } from './vscode-diagram-export-save-port';

export interface DiagramEditorUseCases {
	readonly alignEdgeEndPoints: AlignEdgeEndPointsUseCase;
	readonly alignEdgeStartPoints: AlignEdgeStartPointsUseCase;
	readonly alignSubclassEndpoints: AlignSubclassEndpointsUseCase;
	readonly applyLegendColoring: ApplyLegendColoringUseCase;
	readonly arrangeDiagram: ArrangeDiagramUseCase;
	readonly createNode: CreateNodeUseCase;
	readonly createEdge: CreateEdgeUseCase;
	readonly createCommentNote: CreateCommentNoteUseCase;
	readonly createNote: CreateNoteUseCase;
	readonly createNoteConnection: CreateNoteConnectionUseCase;
	readonly createImage: CreateImageUseCase;
	readonly createLabel: CreateLabelUseCase;
	readonly createMetadataElement: CreateMetadataElementUseCase;
	readonly createLegendElement: CreateLegendElementUseCase;
	readonly createDiagramLink: CreateDiagramLinkUseCase;
	readonly deleteNode: DeleteNodeUseCase;
	readonly deleteElements: DeleteElementsUseCase;
	readonly deleteEdge: DeleteEdgeUseCase;
	readonly deleteNote: DeleteNoteUseCase;
	readonly deleteImage: DeleteImageUseCase;
	readonly deleteLabel: DeleteLabelUseCase;
	readonly deleteMetadataElement: DeleteMetadataElementUseCase;
	readonly deleteLegendElement: DeleteLegendElementUseCase;
	readonly optimizeEdgeRoute: OptimizeEdgeRouteUseCase;
	readonly straightenEdgeRoute: StraightenEdgeRouteUseCase;
	readonly showRelatedElements: ShowRelatedElementsUseCase;
	readonly updateEdgeRoute: UpdateEdgeRouteUseCase;
	readonly updateEdgeRouteLayout: UpdateEdgeRouteLayoutUseCase;
	readonly updateEdgePresentation: UpdateEdgePresentationUseCase;
	readonly updateDiagramMetadata: UpdateDiagramMetadataUseCase;
	readonly updateElementBounds: UpdateElementBoundsUseCase;
	readonly updateElementStyle: UpdateElementStyleUseCase;
	readonly updateNodeBounds: UpdateNodeBoundsUseCase;
	readonly updateNodeDataPropertiesVisibility: UpdateNodeDataPropertiesVisibilityUseCase;
	readonly updateNodeImage: UpdateNodeImageUseCase;
	readonly updateNodeLabelTextOverflow: UpdateNodeLabelTextOverflowUseCase;
	readonly updateNodePropertyValueTextOverflow: UpdateNodePropertyValueTextOverflowUseCase;
	readonly updateNodePropertyValuesVisibility: UpdateNodePropertyValuesVisibilityUseCase;
	readonly updateNodeTypeVisibility: UpdateNodeTypeVisibilityUseCase;
	readonly updateNodeTypeDisplay: UpdateNodeTypeDisplayUseCase;
	readonly updateNoteBounds: UpdateNoteBoundsUseCase;
	readonly updateNoteExportVisibility: UpdateNoteExportVisibilityUseCase;
	readonly updateImageBounds: UpdateImageBoundsUseCase;
	readonly updateImageSource: UpdateImageSourceUseCase;
	readonly updateLabelBounds: UpdateLabelBoundsUseCase;
	readonly updateMetadataBounds: UpdateMetadataBoundsUseCase;
	readonly updateLegendBounds: UpdateLegendBoundsUseCase;
	readonly updateLegendColors: UpdateLegendColorsUseCase;
	readonly updateLegendColorBy: UpdateLegendColorByUseCase;
	readonly updateNoteText: UpdateNoteTextUseCase;
	readonly updateLabelText: UpdateLabelTextUseCase;
	readonly updateThemeMode: UpdateThemeModeUseCase;
	readonly updateDiagramLinkIcon: UpdateDiagramLinkIconUseCase;
	readonly updateDiagramLinkReference: UpdateDiagramLinkReferenceUseCase;
	readonly saveDiagramExport: SaveDiagramExportUseCase;
}


export function createDefaultUseCases(): DiagramEditorUseCases {
	return {
		alignEdgeEndPoints: new AlignEdgeEndPointsUseCase(),
		alignEdgeStartPoints: new AlignEdgeStartPointsUseCase(),
		alignSubclassEndpoints: new AlignSubclassEndpointsUseCase(),
		applyLegendColoring: new ApplyLegendColoringUseCase(),
		arrangeDiagram: new ArrangeDiagramUseCase(),
		createNode: new CreateNodeUseCase(),
		createEdge: new CreateEdgeUseCase(),
		createCommentNote: new CreateCommentNoteUseCase(),
		createNote: new CreateNoteUseCase(),
		createNoteConnection: new CreateNoteConnectionUseCase(),
		createImage: new CreateImageUseCase(),
		createLabel: new CreateLabelUseCase(),
		createMetadataElement: new CreateMetadataElementUseCase(),
		createLegendElement: new CreateLegendElementUseCase(),
		createDiagramLink: new CreateDiagramLinkUseCase(),
		deleteNode: new DeleteNodeUseCase(),
		deleteElements: new DeleteElementsUseCase(),
		deleteEdge: new DeleteEdgeUseCase(),
		deleteNote: new DeleteNoteUseCase(),
		deleteImage: new DeleteImageUseCase(),
		deleteLabel: new DeleteLabelUseCase(),
		deleteMetadataElement: new DeleteMetadataElementUseCase(),
		deleteLegendElement: new DeleteLegendElementUseCase(),
		optimizeEdgeRoute: new OptimizeEdgeRouteUseCase(),
		straightenEdgeRoute: new StraightenEdgeRouteUseCase(),
		showRelatedElements: new ShowRelatedElementsUseCase(),
		updateEdgeRoute: new UpdateEdgeRouteUseCase(),
		updateEdgeRouteLayout: new UpdateEdgeRouteLayoutUseCase(),
		updateEdgePresentation: new UpdateEdgePresentationUseCase(),
		updateDiagramMetadata: new UpdateDiagramMetadataUseCase(),
		updateElementBounds: new UpdateElementBoundsUseCase(),
		updateElementStyle: new UpdateElementStyleUseCase(),
		updateNodeBounds: new UpdateNodeBoundsUseCase(),
		updateNodeDataPropertiesVisibility: new UpdateNodeDataPropertiesVisibilityUseCase(),
		updateNodeImage: new UpdateNodeImageUseCase(),
		updateNodeLabelTextOverflow: new UpdateNodeLabelTextOverflowUseCase(),
		updateNodePropertyValueTextOverflow: new UpdateNodePropertyValueTextOverflowUseCase(),
		updateNodePropertyValuesVisibility: new UpdateNodePropertyValuesVisibilityUseCase(),
		updateNodeTypeVisibility: new UpdateNodeTypeVisibilityUseCase(),
		updateNodeTypeDisplay: new UpdateNodeTypeDisplayUseCase(),
		updateNoteBounds: new UpdateNoteBoundsUseCase(),
		updateNoteExportVisibility: new UpdateNoteExportVisibilityUseCase(),
		updateImageBounds: new UpdateImageBoundsUseCase(),
		updateImageSource: new UpdateImageSourceUseCase(),
		updateLabelBounds: new UpdateLabelBoundsUseCase(),
		updateMetadataBounds: new UpdateMetadataBoundsUseCase(),
		updateLegendBounds: new UpdateLegendBoundsUseCase(),
		updateLegendColors: new UpdateLegendColorsUseCase(),
		updateLegendColorBy: new UpdateLegendColorByUseCase(),
		updateNoteText: new UpdateNoteTextUseCase(),
		updateLabelText: new UpdateLabelTextUseCase(),
		updateThemeMode: new UpdateThemeModeUseCase(),
		updateDiagramLinkIcon: new UpdateDiagramLinkIconUseCase(),
		updateDiagramLinkReference: new UpdateDiagramLinkReferenceUseCase(),
		saveDiagramExport: new SaveDiagramExportUseCase(new VsCodeDiagramExportSavePort()),
	};
}

