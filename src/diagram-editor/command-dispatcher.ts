import * as vscode from 'vscode';
import * as path from 'path';
import { readFile } from 'fs/promises';

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
} from './use-cases';
import type { DiagramExportSavePort, DiagramMutationResult } from './use-cases';
import type { ModelTreeItemDraggedEvent } from '../ui/model-tree/model-tree';
import type { ModelTreeItemDropPayload, WebviewCommand } from '../shared/webview-commands';
import { DiagramDocumentRepository } from './document-repository';
import { edgeEndpointCandidates, isConnectionCapableOntologyItem, resolveEdgeEndpoints, type EdgeEndpointSelection } from './use-cases/ontology-edge-endpoints';
import { loadReferencedOntologies, type LoadedOntology, type OntologyItem } from '../ui/model-tree/ontology-model';
import { availableOntologyItemPickerEntries, ontologyItemPickerGroups, type OntologyItemPickerEntry } from './ontology-item-picker';
import { createDefaultUseCases, type DiagramEditorUseCases } from './diagram-editor-use-cases';
import { resolveEmbeddedImageSource } from './vscode-image-source-picker';
import { pickEdgeEndpointSelection, pickRelatedElementDepth } from './vscode-ontology-pickers';
import { relationshipPayloads } from './ontology-relationship-payloads';
import { DiagramCommandWorkflows } from './diagram-command-workflows';

export class DiagramCommandDispatcher {
	private readonly useCases: DiagramEditorUseCases;
	private readonly workflows: DiagramCommandWorkflows;

	public constructor(
		private readonly repository: DiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItems: () => readonly ModelTreeItemDraggedEvent[],
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean> = async () => false,
		useCases: DiagramEditorUseCases = createDefaultUseCases(),
	) {
		this.useCases = useCases;
		this.workflows = new DiagramCommandWorkflows(repository, getLastDraggedModelTreeItems, revealModelTreeItem, useCases);
	}

	public async dispatch(command: WebviewCommand): Promise<void> {
		switch (command.type) {
			case 'updateCanvasViewport':
				return;
			case 'alignEdgeEndPoints':
				await this.workflows.handleResult(this.useCases.alignEdgeEndPoints.execute(
					this.repository.load(),
					command.edgeIds,
				));
				return;
			case 'alignEdgeStartPoints':
				await this.workflows.handleResult(this.useCases.alignEdgeStartPoints.execute(
					this.repository.load(),
					command.edgeIds,
				));
				return;
			case 'alignSubclassEndpoints':
				await this.workflows.handleResult(this.useCases.alignSubclassEndpoints.execute(
					this.repository.load(),
					command.nodeIds,
				));
				return;
			case 'arrangeDiagram':
				await this.workflows.handleResult(await this.useCases.arrangeDiagram.execute(
					this.repository.load(),
					command.algorithmId,
					command.elkLayeredOptions,
					command.selectedNodeIds,
				));
				return;
			case 'undoDiagram':
				await this.workflows.undoOrRedo('undo');
				return;
			case 'redoDiagram':
				await this.workflows.undoOrRedo('redo');
				return;
			case 'addOntologyItem':
				await this.workflows.addOntologyItem(command.position);
				return;
			case 'createNode':
				await this.workflows.createNode(command);
				return;
			case 'updateNodeBounds':
				await this.workflows.handleResult(this.useCases.updateNodeBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateElementBounds':
				await this.workflows.handleResult(this.useCases.updateElementBounds.execute(
					this.repository.load(),
					command,
				));
				return;
			case 'updateEdgeRoute':
				await this.workflows.handleResult(this.useCases.updateEdgeRoute.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'optimizeEdgeRoute':
				await this.workflows.handleResult(this.useCases.optimizeEdgeRoute.execute(
					this.repository.load(),
					command.id,
				));
				return;
			case 'optimizeEdgeRoutes':
				await this.workflows.handleResult(this.useCases.optimizeEdgeRoute.executeMany(
					this.repository.load(),
					command.ids,
				));
				return;
			case 'straightenEdgeRoute':
				await this.workflows.handleResult(this.useCases.straightenEdgeRoute.execute(
					this.repository.load(),
					command.id,
				));
				return;
			case 'showRelatedElements':
				await this.workflows.showRelatedElements(command.nodeId);
				return;
			case 'showEdgesBetweenNodes':
				await this.workflows.showEdgesBetweenNodes(command.nodeIds);
				return;
			case 'updateEdgeRouteLayout':
				await this.workflows.handleResult(this.useCases.updateEdgeRouteLayout.execute(
					this.repository.load(),
					command.id,
					command.routeLayout,
				));
				return;
			case 'updateEdgeRouteLayouts':
				await this.workflows.handleResult(this.useCases.updateEdgeRouteLayout.executeMany(
					this.repository.load(),
					command.ids,
					command.routeLayout,
				));
				return;
			case 'updateEdgePresentation':
				await this.workflows.handleResult(this.useCases.updateEdgePresentation.execute(
					this.repository.load(),
					command.id,
					command.renderAs,
					command.containmentDirection,
				));
				return;
			case 'updateNodeImage':
				await this.workflows.handleResult(this.useCases.updateNodeImage.execute(
					this.repository.load(),
					command.id,
					command.image,
				));
				return;
			case 'updateNodeDataPropertiesVisibility':
				await this.workflows.handleResult(this.useCases.updateNodeDataPropertiesVisibility.execute(
					this.repository.load(),
					command.id,
					command.showDataProperties,
				));
				return;
			case 'updateNodeTypeVisibility':
				await this.workflows.handleResult(this.useCases.updateNodeTypeVisibility.execute(
					this.repository.load(),
					command.id,
					command.showType,
				));
				return;
			case 'updateNodeTypeDisplay':
				await this.workflows.handleResult(this.useCases.updateNodeTypeDisplay.executeMany(
					this.repository.load(),
					command.ids,
					command.typeDisplay,
				));
				return;
			case 'updateNodePropertyValuesVisibility':
				await this.workflows.handleResult(this.useCases.updateNodePropertyValuesVisibility.execute(
					this.repository.load(),
					command.id,
					command.showPropertyValues,
				));
				return;
			case 'updateNodePropertyValueTextOverflow':
				await this.workflows.handleResult(this.useCases.updateNodePropertyValueTextOverflow.execute(
					this.repository.load(),
					command.id,
					command.textOverflow,
				));
				return;
			case 'updateNodeLabelTextOverflow':
				await this.workflows.handleResult(this.useCases.updateNodeLabelTextOverflow.execute(
					this.repository.load(),
					command.id,
					command.textOverflow,
				));
				return;
			case 'createNote':
				await this.workflows.handleResult(this.useCases.createNote.execute(
					this.repository.load(),
					command.text,
					command.position,
				));
				return;
			case 'createCommentNote':
				await this.workflows.handleResult(this.useCases.createCommentNote.execute(
					this.repository.load(),
					command.nodeId,
					command.comment,
				));
				return;
			case 'createNoteConnection':
				await this.workflows.handleResult(this.useCases.createNoteConnection.execute(
					this.repository.load(),
					command.noteId,
					command.targetId,
				));
				return;
			case 'createImage':
				await this.workflows.createImage(command);
				return;
			case 'createLabel':
				await this.workflows.handleResult(this.useCases.createLabel.execute(
					this.repository.load(),
					command.text,
					command.position,
				));
				return;
			case 'createMetadataElement':
				await this.workflows.handleResult(this.useCases.createMetadataElement.execute(this.repository.load(), command.position));
				return;
			case 'createLegendElement':
				await this.workflows.handleResult(this.useCases.createLegendElement.execute(this.repository.load(), command.position));
				return;
			case 'saveDiagramExport':
				await this.workflows.saveDiagramExport(command);
				return;
			case 'deleteNode':
				await this.workflows.deleteNode(command);
				return;
			case 'deleteElements':
				await this.workflows.deleteElements(command);
				return;
			case 'deleteEdge':
				await this.workflows.deleteEdge(command);
				return;
			case 'deleteNote':
				await this.workflows.deleteNote(command);
				return;
			case 'deleteImage':
				await this.workflows.deleteImage(command);
				return;
			case 'deleteLabel':
				await this.workflows.deleteLabel(command);
				return;
			case 'deleteMetadataElement':
				await this.workflows.deleteMetadataElement(command);
				return;
			case 'deleteLegendElement':
				await this.workflows.handleResult(this.useCases.deleteLegendElement.execute(this.repository.load(), command.id));
				return;
			case 'updateNoteBounds':
				await this.workflows.handleResult(this.useCases.updateNoteBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateNoteExportVisibility':
				await this.workflows.handleResult(this.useCases.updateNoteExportVisibility.execute(
					this.repository.load(),
					command.id,
					command.exported,
				));
				return;
			case 'updateImageBounds':
				await this.workflows.handleResult(this.useCases.updateImageBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'pickNodeImage':
				await this.workflows.pickNodeImage(command);
				return;
			case 'pickImageSource':
				await this.workflows.pickImageSource(command);
				return;
			case 'updateLabelBounds':
				await this.workflows.handleResult(this.useCases.updateLabelBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateMetadataBounds':
				await this.workflows.handleResult(this.useCases.updateMetadataBounds.execute(this.repository.load(), command.updates));
				return;
			case 'updateLegendBounds':
				await this.workflows.handleResult(this.useCases.updateLegendBounds.execute(this.repository.load(), command.updates));
				return;
			case 'updateLegendColors':
				await this.workflows.updateLegendColors(command);
				return;
			case 'updateLegendColorBy':
				await this.workflows.updateLegendColorBy(command);
				return;
			case 'updateNoteText':
				await this.workflows.handleResult(this.useCases.updateNoteText.execute(
					this.repository.load(),
					command.id,
					command.text,
				));
				return;
			case 'updateLabelText':
				await this.workflows.handleResult(this.useCases.updateLabelText.execute(
					this.repository.load(),
					command.id,
					command.text,
				));
				return;
			case 'updateDiagramMetadata':
				await this.workflows.handleResult(this.useCases.updateDiagramMetadata.execute(
					this.repository.load(),
					command.metadata,
				));
				return;
			case 'updateElementStyle':
				await this.workflows.handleResult(this.useCases.updateElementStyle.execute(
					this.repository.load(),
					command.elementType,
					command.id,
					command.style,
				));
				return;
			case 'updateElementStyles':
				await this.workflows.handleResult(this.useCases.updateElementStyle.executeMany(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateNodeLabelTextOverflows':
				await this.workflows.handleResult(this.useCases.updateNodeLabelTextOverflow.executeMany(
					this.repository.load(),
					command.ids,
					command.textOverflow,
				));
				return;
			case 'updateThemeMode':
				await this.workflows.handleResult(this.useCases.updateThemeMode.execute(
					this.repository.load(),
					command.themeMode,
				));
				return;
			case 'revealModelTreeItem':
				await this.workflows.revealSelectedModelTreeItem(command.id);
				return;
		}
	}

	public async addModelTreeItems(items: readonly ModelTreeItemDropPayload[]): Promise<void> {
		await this.workflows.addModelTreeItems(items);
	}
}
