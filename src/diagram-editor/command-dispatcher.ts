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
	UpdateNodePropertyValueTextOverflowUseCase,
	UpdateNodePropertyValuesVisibilityUseCase,
	UpdateNodeTypeVisibilityUseCase,
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

interface DiagramEditorUseCases {
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
	readonly updateDiagramMetadata: UpdateDiagramMetadataUseCase;
	readonly updateElementBounds: UpdateElementBoundsUseCase;
	readonly updateElementStyle: UpdateElementStyleUseCase;
	readonly updateNodeBounds: UpdateNodeBoundsUseCase;
	readonly updateNodeDataPropertiesVisibility: UpdateNodeDataPropertiesVisibilityUseCase;
	readonly updateNodeImage: UpdateNodeImageUseCase;
	readonly updateNodePropertyValueTextOverflow: UpdateNodePropertyValueTextOverflowUseCase;
	readonly updateNodePropertyValuesVisibility: UpdateNodePropertyValuesVisibilityUseCase;
	readonly updateNodeTypeVisibility: UpdateNodeTypeVisibilityUseCase;
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
	readonly saveDiagramExport: SaveDiagramExportUseCase;
}

export class DiagramCommandDispatcher {
	private readonly useCases: DiagramEditorUseCases;

	public constructor(
		private readonly repository: DiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItems: () => readonly ModelTreeItemDraggedEvent[],
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean> = async () => false,
		useCases: DiagramEditorUseCases = createDefaultUseCases(),
	) {
		this.useCases = useCases;
	}

	public async dispatch(command: WebviewCommand): Promise<void> {
		switch (command.type) {
			case 'updateCanvasViewport':
				return;
			case 'alignEdgeEndPoints':
				await this.handleResult(this.useCases.alignEdgeEndPoints.execute(
					this.repository.load(),
					command.edgeIds,
				));
				return;
			case 'alignEdgeStartPoints':
				await this.handleResult(this.useCases.alignEdgeStartPoints.execute(
					this.repository.load(),
					command.edgeIds,
				));
				return;
			case 'alignSubclassEndpoints':
				await this.handleResult(this.useCases.alignSubclassEndpoints.execute(
					this.repository.load(),
					command.nodeIds,
				));
				return;
			case 'arrangeDiagram':
				await this.handleResult(await this.useCases.arrangeDiagram.execute(
					this.repository.load(),
					command.algorithmId,
					command.elkLayeredOptions,
					command.selectedNodeIds,
				));
				return;
			case 'undoDiagram':
				await this.undoOrRedo('undo');
				return;
			case 'redoDiagram':
				await this.undoOrRedo('redo');
				return;
			case 'addOntologyItem':
				await this.addOntologyItem(command.position);
				return;
			case 'createNode':
				await this.createNode(command);
				return;
			case 'updateNodeBounds':
				await this.handleResult(this.useCases.updateNodeBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateElementBounds':
				await this.handleResult(this.useCases.updateElementBounds.execute(
					this.repository.load(),
					command,
				));
				return;
			case 'updateEdgeRoute':
				await this.handleResult(this.useCases.updateEdgeRoute.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'optimizeEdgeRoute':
				await this.handleResult(this.useCases.optimizeEdgeRoute.execute(
					this.repository.load(),
					command.id,
				));
				return;
			case 'straightenEdgeRoute':
				await this.handleResult(this.useCases.straightenEdgeRoute.execute(
					this.repository.load(),
					command.id,
				));
				return;
			case 'showRelatedElements':
				await this.showRelatedElements(command.nodeId);
				return;
			case 'showEdgesBetweenNodes':
				await this.showEdgesBetweenNodes(command.nodeIds);
				return;
			case 'updateEdgeRouteLayout':
				await this.handleResult(this.useCases.updateEdgeRouteLayout.execute(
					this.repository.load(),
					command.id,
					command.routeLayout,
				));
				return;
			case 'updateNodeImage':
				await this.handleResult(this.useCases.updateNodeImage.execute(
					this.repository.load(),
					command.id,
					command.image,
				));
				return;
			case 'updateNodeDataPropertiesVisibility':
				await this.handleResult(this.useCases.updateNodeDataPropertiesVisibility.execute(
					this.repository.load(),
					command.id,
					command.showDataProperties,
				));
				return;
			case 'updateNodeTypeVisibility':
				await this.handleResult(this.useCases.updateNodeTypeVisibility.execute(
					this.repository.load(),
					command.id,
					command.showType,
				));
				return;
			case 'updateNodePropertyValuesVisibility':
				await this.handleResult(this.useCases.updateNodePropertyValuesVisibility.execute(
					this.repository.load(),
					command.id,
					command.showPropertyValues,
				));
				return;
			case 'updateNodePropertyValueTextOverflow':
				await this.handleResult(this.useCases.updateNodePropertyValueTextOverflow.execute(
					this.repository.load(),
					command.id,
					command.textOverflow,
				));
				return;
			case 'createNote':
				await this.handleResult(this.useCases.createNote.execute(
					this.repository.load(),
					command.text,
					command.position,
				));
				return;
			case 'createCommentNote':
				await this.handleResult(this.useCases.createCommentNote.execute(
					this.repository.load(),
					command.nodeId,
					command.comment,
				));
				return;
			case 'createNoteConnection':
				await this.handleResult(this.useCases.createNoteConnection.execute(
					this.repository.load(),
					command.noteId,
					command.targetId,
				));
				return;
			case 'createImage':
				await this.createImage(command);
				return;
			case 'createLabel':
				await this.handleResult(this.useCases.createLabel.execute(
					this.repository.load(),
					command.text,
					command.position,
				));
				return;
			case 'createMetadataElement':
				await this.handleResult(this.useCases.createMetadataElement.execute(this.repository.load(), command.position));
				return;
			case 'createLegendElement':
				await this.handleResult(this.useCases.createLegendElement.execute(this.repository.load(), command.position));
				return;
			case 'saveDiagramExport':
				await this.saveDiagramExport(command);
				return;
			case 'deleteNode':
				await this.deleteNode(command);
				return;
			case 'deleteElements':
				await this.deleteElements(command);
				return;
			case 'deleteEdge':
				await this.deleteEdge(command);
				return;
			case 'deleteNote':
				await this.deleteNote(command);
				return;
			case 'deleteImage':
				await this.deleteImage(command);
				return;
			case 'deleteLabel':
				await this.deleteLabel(command);
				return;
			case 'deleteMetadataElement':
				await this.deleteMetadataElement(command);
				return;
			case 'deleteLegendElement':
				await this.handleResult(this.useCases.deleteLegendElement.execute(this.repository.load(), command.id));
				return;
			case 'updateNoteBounds':
				await this.handleResult(this.useCases.updateNoteBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateNoteExportVisibility':
				await this.handleResult(this.useCases.updateNoteExportVisibility.execute(
					this.repository.load(),
					command.id,
					command.exported,
				));
				return;
			case 'updateImageBounds':
				await this.handleResult(this.useCases.updateImageBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'pickNodeImage':
				await this.pickNodeImage(command);
				return;
			case 'pickImageSource':
				await this.pickImageSource(command);
				return;
			case 'updateLabelBounds':
				await this.handleResult(this.useCases.updateLabelBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateMetadataBounds':
				await this.handleResult(this.useCases.updateMetadataBounds.execute(this.repository.load(), command.updates));
				return;
			case 'updateLegendBounds':
				await this.handleResult(this.useCases.updateLegendBounds.execute(this.repository.load(), command.updates));
				return;
			case 'updateLegendColors':
				await this.updateLegendColors(command);
				return;
			case 'updateLegendColorBy':
				await this.updateLegendColorBy(command);
				return;
			case 'updateNoteText':
				await this.handleResult(this.useCases.updateNoteText.execute(
					this.repository.load(),
					command.id,
					command.text,
				));
				return;
			case 'updateLabelText':
				await this.handleResult(this.useCases.updateLabelText.execute(
					this.repository.load(),
					command.id,
					command.text,
				));
				return;
			case 'updateDiagramMetadata':
				await this.handleResult(this.useCases.updateDiagramMetadata.execute(
					this.repository.load(),
					command.metadata,
				));
				return;
			case 'updateElementStyle':
				await this.handleResult(this.useCases.updateElementStyle.execute(
					this.repository.load(),
					command.elementType,
					command.id,
					command.style,
				));
				return;
			case 'updateThemeMode':
				await this.handleResult(this.useCases.updateThemeMode.execute(
					this.repository.load(),
					command.themeMode,
				));
				return;
			case 'revealModelTreeItem':
				await this.revealSelectedModelTreeItem(command.id);
				return;
		}
	}

	public async addModelTreeItems(items: readonly ModelTreeItemDropPayload[]): Promise<void> {
		if (items.length === 0) {
			return;
		}

		await this.createMultipleNodes(items, modelTreeBatchPosition(this.repository.load()));
	}

	private async revealSelectedModelTreeItem(diagramElementId: string): Promise<void> {
		if (!await this.revealModelTreeItem(diagramElementId)) {
			await vscode.window.showInformationMessage('No corresponding ontology item was found in the model tree.');
		}
	}

	private async showRelatedElements(nodeId: string): Promise<void> {
		const depth = await pickRelatedElementDepth();
		if (depth === undefined) {
			return;
		}

		const diagram = this.repository.load();
		const loadedOntologies = await loadReferencedOntologies(this.repository.uri.fsPath, diagram);
		await this.handleResult(this.useCases.showRelatedElements.execute(
			diagram,
			nodeId,
			depth,
			relationshipPayloads(loadedOntologies),
		));
	}

	private async showEdgesBetweenNodes(nodeIds: readonly string[]): Promise<void> {
		const diagram = this.repository.load();
		const loadedOntologies = await loadReferencedOntologies(this.repository.uri.fsPath, diagram);
		await this.handleResult(this.useCases.showRelatedElements.showEdgesBetweenNodes(
			diagram,
			nodeIds,
			relationshipPayloads(loadedOntologies),
		));
	}

	private async addOntologyItem(position: { readonly x: number; readonly y: number }): Promise<void> {
		const diagram = this.repository.load();
		const entries = availableOntologyItemPickerEntries(await loadReferencedOntologies(this.repository.uri.fsPath, diagram), diagram);
		const pickerItems: readonly OntologyItemQuickPickItem[] = entries.length === 0
			? []
			: ontologyItemPickerGroups(entries).flatMap((group) => [
				{ label: group.label, kind: vscode.QuickPickItemKind.Separator },
				...group.entries,
			]);

		const selected = await vscode.window.showQuickPick(pickerItems, {
			title: 'Add Ontology Item to Diagram',
			placeHolder: entries.length === 0
				? 'All supported ontology items are already on the diagram.'
				: 'Search by name, reference, type, or ontology file.',
			matchOnDescription: true,
			matchOnDetail: true,
		});
		if (selected === undefined || !isOntologyItemPickerEntry(selected)) {
			return;
		}

		if (isConnectionCapableOntologyItem(selected.payload.ontologyItemType)) {
			await this.createOntologyEdge(diagram, selected.payload, position);
			return;
		}

		await this.handleResult(this.useCases.createNode.execute(diagram, selected.payload, position));
	}

	private async undoOrRedo(command: 'undo' | 'redo'): Promise<void> {
		await vscode.commands.executeCommand(command);
		await this.repository.saveCurrentDocument();
	}

	private async createNode(command: Extract<WebviewCommand, { readonly type: 'createNode' }>): Promise<void> {
		const resolvedPayloads = command.payloads ?? (command.payload === undefined ? this.getLastDraggedModelTreeItems() : [command.payload]);
		if (resolvedPayloads.length === 0) {
			await vscode.window.showInformationMessage('Drag a model-tree item onto the canvas while holding Shift.');
			return;
		}
		if (resolvedPayloads.length > 1) {
			await this.createMultipleNodes(resolvedPayloads, command.position);
			return;
		}

		const resolvedPayload = resolvedPayloads[0];

		if (isConnectionCapableOntologyItem(resolvedPayload.ontologyItemType)) {
			await this.createOntologyEdge(this.repository.load(), resolvedPayload, command.position);
			return;
		}

		await this.handleResult(this.useCases.createNode.execute(
			this.repository.load(),
			resolvedPayload,
			command.position,
			command.size,
		));
	}

	private async createMultipleNodes(payloads: readonly ModelTreeItemDropPayload[], position: { readonly x: number; readonly y: number }): Promise<void> {
		let diagram = this.repository.load();
		let changed = false;
		let skipped = 0;
		for (const [index, payload] of payloads.entries()) {
			if (isConnectionCapableOntologyItem(payload.ontologyItemType)) {
				continue;
			}
			const result = this.useCases.createNode.execute(diagram, payload, batchPosition(position, index));
			if (result.diagram === undefined) {
				skipped += 1;
				continue;
			}
			diagram = result.diagram;
			changed = true;
		}
		if (changed) {
			const legendResult = this.useCases.applyLegendColoring.execute(diagram);
			await this.repository.save(legendResult.diagram ?? diagram);
		}

		for (const [index, payload] of payloads.entries()) {
			if (isConnectionCapableOntologyItem(payload.ontologyItemType)) {
				await this.createOntologyEdge(this.repository.load(), payload, batchPosition(position, index));
			}
		}
		if (skipped > 0) {
			await vscode.window.showInformationMessage(`${skipped} selected item${skipped === 1 ? ' was' : 's were'} already present or cannot be rendered as nodes.`);
		}
	}

	private async createOntologyEdge(
		diagram: ReturnType<DiagramDocumentRepository['load']>,
		payload: ModelTreeItemDropPayload,
		position: { readonly x: number; readonly y: number },
	): Promise<void> {
		const resolved = resolveEdgeEndpoints(payload);
		if (resolved !== 'ambiguous') {
			await this.handleResult(this.useCases.createEdge.execute(diagram, payload, position));
			return;
		}

		const candidates = edgeEndpointCandidates(payload);
		if (candidates === undefined || (candidates.sourceOntologyRefs.length < 2 && candidates.targetOntologyRefs.length < 2)) {
			await this.handleResult(this.useCases.createEdge.execute(diagram, payload, position));
			return;
		}

		const selection = await pickEdgeEndpointSelection(payload.displayLabel, candidates.sourceOntologyRefs, candidates.targetOntologyRefs);
		if (selection === undefined) {
			return;
		}

		await this.handleResult(this.useCases.createEdge.execute(diagram, payload, position, selection));
	}

	private async deleteImage(command: Extract<WebviewCommand, { readonly type: 'deleteImage' }>): Promise<void> {
		const diagram = this.repository.load();
		const connectedEdgeCount = diagram.edges.filter((edge) => edge.source.value === command.id || edge.target.value === command.id).length;
		const confirmed = await vscode.window.showWarningMessage(
			connectedEdgeCount > 0
				? `Delete this image and ${connectedEdgeCount} connected edge${connectedEdgeCount === 1 ? '' : 's'} from the diagram?`
				: 'Delete this image from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteImage.execute(
			diagram,
			command.id,
		));
	}

	private async deleteNode(command: Extract<WebviewCommand, { readonly type: 'deleteNode' }>): Promise<void> {
		const diagram = this.repository.load();
		const connectedEdgeCount = diagram.edges.filter((edge) => edge.source.value === command.id || edge.target.value === command.id).length;
		const confirmed = await vscode.window.showWarningMessage(
			connectedEdgeCount > 0
				? `Delete this node and ${connectedEdgeCount} connected edge${connectedEdgeCount === 1 ? '' : 's'} from the diagram?`
				: 'Delete this node from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteNode.execute(
			diagram,
			command.id,
		));
	}

	private async deleteElements(command: Extract<WebviewCommand, { readonly type: 'deleteElements' }>): Promise<void> {
		const diagram = this.repository.load();
		const ids = new Set(command.ids);
		const selectedNodeIds = diagram.nodes.filter((node) => ids.has(node.id.value)).map((node) => node.id.value);
		const selectedNoteIds = diagram.notes.filter((note) => ids.has(note.id.value)).map((note) => note.id.value);
		const selectedImageIds = diagram.images.filter((image) => ids.has(image.id.value)).map((image) => image.id.value);
		const selectedLabelIds = diagram.labels.filter((label) => ids.has(label.id.value)).map((label) => label.id.value);
		const selectedMetadataIds = diagram.metadataElements.filter((element) => ids.has(element.id.value)).map((element) => element.id.value);
		const selectedEdgeIds = diagram.edges.filter((edge) => ids.has(edge.id.value)).map((edge) => edge.id.value);
		const selectedElementCount = selectedNodeIds.length + selectedNoteIds.length + selectedImageIds.length + selectedLabelIds.length + selectedMetadataIds.length + selectedEdgeIds.length;
		if (selectedElementCount === 0) {
			return;
		}

		const selectedEndpointIds = new Set([
			...selectedNodeIds,
			...selectedNoteIds,
			...selectedImageIds,
		]);
		const connectedEdgeCount = diagram.edges.filter((edge) =>
			!ids.has(edge.id.value)
			&& (selectedEndpointIds.has(edge.source.value) || selectedEndpointIds.has(edge.target.value)),
		).length;
		const confirmed = await vscode.window.showWarningMessage(
			connectedEdgeCount > 0
				? `Delete ${selectedElementCount} selected element${selectedElementCount === 1 ? '' : 's'} and ${connectedEdgeCount} connected edge${connectedEdgeCount === 1 ? '' : 's'} from the diagram?`
				: `Delete ${selectedElementCount} selected element${selectedElementCount === 1 ? '' : 's'} from the diagram?`,
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteElements.execute(
			diagram,
			command.ids,
		));
	}

	private async deleteEdge(command: Extract<WebviewCommand, { readonly type: 'deleteEdge' }>): Promise<void> {
		const confirmed = await vscode.window.showWarningMessage(
			'Delete this edge from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteEdge.execute(
			this.repository.load(),
			command.id,
		));
	}

	private async deleteNote(command: Extract<WebviewCommand, { readonly type: 'deleteNote' }>): Promise<void> {
		const diagram = this.repository.load();
		const connectedEdgeCount = diagram.edges.filter((edge) => edge.source.value === command.id || edge.target.value === command.id).length;
		const confirmed = await vscode.window.showWarningMessage(
			connectedEdgeCount > 0
				? `Delete this note and ${connectedEdgeCount} connected edge${connectedEdgeCount === 1 ? '' : 's'} from the diagram?`
				: 'Delete this note from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteNote.execute(
			diagram,
			command.id,
		));
	}

	private async deleteLabel(command: Extract<WebviewCommand, { readonly type: 'deleteLabel' }>): Promise<void> {
		const confirmed = await vscode.window.showWarningMessage(
			'Delete this label from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteLabel.execute(
			this.repository.load(),
			command.id,
		));
	}

	private async deleteMetadataElement(command: Extract<WebviewCommand, { readonly type: 'deleteMetadataElement' }>): Promise<void> {
		const confirmed = await vscode.window.showWarningMessage('Delete this diagram information element?', { modal: true }, 'Delete');
		if (confirmed === 'Delete') {
			await this.handleResult(this.useCases.deleteMetadataElement.execute(this.repository.load(), command.id));
		}
	}

	private async createImage(command: Extract<WebviewCommand, { readonly type: 'createImage' }>): Promise<void> {
		const source = await resolveEmbeddedImageSource(command.source, command.pickFile, 'Add Image', 'Add image to ontology diagram');
		if (source === undefined) {
			return;
		}

		await this.handleResult(this.useCases.createImage.execute(
			this.repository.load(),
			source,
			command.position,
		));
	}

	private async pickNodeImage(command: Extract<WebviewCommand, { readonly type: 'pickNodeImage' }>): Promise<void> {
		const source = await resolveEmbeddedImageSource(command.source, command.pickFile, 'Set Image', 'Set node image');
		if (source === undefined) {
			return;
		}

		await this.handleResult(this.useCases.updateNodeImage.execute(
			this.repository.load(),
			command.id,
			source,
		));
	}

	private async pickImageSource(command: Extract<WebviewCommand, { readonly type: 'pickImageSource' }>): Promise<void> {
		const source = await resolveEmbeddedImageSource(command.source, command.pickFile, 'Set Image', 'Set standalone image source');
		if (source === undefined) {
			return;
		}

		await this.handleResult(this.useCases.updateImageSource.execute(
			this.repository.load(),
			command.id,
			source,
		));
	}

	private async updateLegendColors(command: Extract<WebviewCommand, { readonly type: 'updateLegendColors' }>): Promise<void> {
		const diagram = this.repository.load();
		const currentLegend = diagram.legendElements.find((element) => element.id.value === command.id);
		const colorBy = command.colorBy ?? currentLegend?.colorBy ?? 'ontologySource';
		const ontologySourcePaths = colorBy === 'ontologySource'
			? ontologySourcePathsFor(await loadReferencedOntologies(this.repository.uri.fsPath, diagram))
			: undefined;
		await this.handleResult(this.useCases.updateLegendColors.execute(
			diagram,
			command.id,
			command.colors,
			command.colorMode,
			command.colorBy,
			ontologySourcePaths,
		));
	}

	private async updateLegendColorBy(command: Extract<WebviewCommand, { readonly type: 'updateLegendColorBy' }>): Promise<void> {
		const diagram = this.repository.load();
		const ontologySourcePaths = command.colorBy === 'ontologySource'
			? ontologySourcePathsFor(await loadReferencedOntologies(this.repository.uri.fsPath, diagram))
			: undefined;
		await this.handleResult(this.useCases.updateLegendColorBy.execute(
			diagram,
			command.id,
			command.colorBy,
			ontologySourcePaths,
		));
	}

	private async saveDiagramExport(command: Extract<WebviewCommand, { readonly type: 'saveDiagramExport' }>): Promise<void> {
		const result = await this.useCases.saveDiagramExport.execute({
			format: command.format,
			defaultDirectory: path.dirname(this.repository.uri.fsPath),
			defaultFileName: command.defaultFileName,
			content: command.content,
			encoding: command.encoding,
		});
		if (result.notification !== undefined) {
			await vscode.window.showInformationMessage(result.notification);
		}
	}

	private async handleResult(result: DiagramMutationResult): Promise<void> {
		if (result.notification !== undefined) {
			await vscode.window.showInformationMessage(result.notification);
		}
		if (result.diagram !== undefined) {
			const legendResult = this.useCases.applyLegendColoring.execute(result.diagram);
			await this.repository.save(legendResult.diagram ?? result.diagram);
		}
	}
}

function ontologySourcePathsFor(ontologies: readonly LoadedOntology[]): ReadonlyMap<string, string> {
	const paths = new Map<string, string>();
	for (const ontology of ontologies) {
		for (const item of ontology.items) {
			if (!paths.has(item.reference)) {
				paths.set(item.reference, ontology.relativePath);
			}
		}
	}
	return paths;
}

function batchPosition(position: { readonly x: number; readonly y: number }, index: number): { readonly x: number; readonly y: number } {
	const columnCount = 3;
	return {
		x: position.x + (index % columnCount) * 220,
		y: position.y + Math.floor(index / columnCount) * 132,
	};
}

function modelTreeBatchPosition(diagram: ReturnType<DiagramDocumentRepository['load']>): { readonly x: number; readonly y: number } {
	const maximumRight = Math.max(0, ...diagram.nodes.map((node) => node.bounds.x + node.bounds.width));
	return { x: maximumRight + 80, y: 80 };
}


type OntologyItemQuickPickItem = OntologyItemPickerEntry | vscode.QuickPickItem;

function isOntologyItemPickerEntry(item: OntologyItemQuickPickItem): item is OntologyItemPickerEntry {
	return 'payload' in item;
}

function createDefaultUseCases(): DiagramEditorUseCases {
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
		updateDiagramMetadata: new UpdateDiagramMetadataUseCase(),
		updateElementBounds: new UpdateElementBoundsUseCase(),
		updateElementStyle: new UpdateElementStyleUseCase(),
		updateNodeBounds: new UpdateNodeBoundsUseCase(),
		updateNodeDataPropertiesVisibility: new UpdateNodeDataPropertiesVisibilityUseCase(),
		updateNodeImage: new UpdateNodeImageUseCase(),
		updateNodePropertyValueTextOverflow: new UpdateNodePropertyValueTextOverflowUseCase(),
		updateNodePropertyValuesVisibility: new UpdateNodePropertyValuesVisibilityUseCase(),
		updateNodeTypeVisibility: new UpdateNodeTypeVisibilityUseCase(),
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
		saveDiagramExport: new SaveDiagramExportUseCase(new VsCodeDiagramExportSavePort()),
	};
}

class VsCodeDiagramExportSavePort implements DiagramExportSavePort {
	public async chooseTarget(request: Parameters<DiagramExportSavePort['chooseTarget']>[0]): Promise<string | undefined> {
		const targetUri = await vscode.window.showSaveDialog({
			defaultUri: vscode.Uri.joinPath(
				vscode.Uri.file(request.defaultDirectory),
				request.defaultFileName,
			),
			filters: {
				[request.formatLabel]: [request.extension],
			},
			saveLabel: request.saveLabel,
			title: request.title,
		});

		return targetUri?.fsPath;
	}

	public async writeFile(targetPath: string, content: Uint8Array): Promise<void> {
		await vscode.workspace.fs.writeFile(vscode.Uri.file(targetPath), content);
	}
}

async function pickImageFile(openLabel: string, title: string): Promise<vscode.Uri | undefined> {
	const selectedImage = await vscode.window.showOpenDialog({
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: {
			Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
		},
		openLabel,
		title,
	});

	return selectedImage?.[0];
}

async function resolveEmbeddedImageSource(
	source: string | undefined,
	pickFile: boolean,
	openLabel: string,
	title: string,
): Promise<string | undefined> {
	if (source !== undefined) {
		return source;
	}
	if (!pickFile) {
		return undefined;
	}

	const imageUri = await pickImageFile(openLabel, title);
	return imageUri === undefined ? undefined : embeddedImageSourceFromFile(imageUri.fsPath);
}

async function embeddedImageSourceFromFile(filePath: string): Promise<string> {
	const content = await readFile(filePath);

	return `data:${imageMimeType(filePath)};base64,${content.toString('base64')}`;
}

function imageMimeType(filePath: string): string {
	switch (path.extname(filePath).toLowerCase()) {
		case '.png':
			return 'image/png';
		case '.jpg':
		case '.jpeg':
			return 'image/jpeg';
		case '.gif':
			return 'image/gif';
		case '.webp':
			return 'image/webp';
		case '.bmp':
			return 'image/bmp';
		case '.svg':
			return 'image/svg+xml';
		default:
			return 'application/octet-stream';
	}
}

async function pickRelatedElementDepth(): Promise<number | undefined> {
	const selected = await vscode.window.showQuickPick([
		{ label: 'Depth 1', description: 'Directly connected elements', depth: 1 },
		{ label: 'Depth 2', description: 'Two relationship steps', depth: 2 },
		{ label: 'Depth 3', description: 'Three relationship steps', depth: 3 },
		{ label: 'Depth 4', description: 'Four relationship steps', depth: 4 },
		{ label: 'Depth 5', description: 'Five relationship steps', depth: 5 },
	], {
		title: 'Show Related Elements',
		placeHolder: 'Select how deep to add related ontology elements.',
	});

	return selected?.depth;
}

async function pickEdgeEndpointSelection(
	edgeLabel: string,
	sourceOntologyRefs: readonly string[],
	targetOntologyRefs: readonly string[],
): Promise<EdgeEndpointSelection | undefined> {
	const sourceOntologyRef = await pickEdgeEndpoint('source', edgeLabel, sourceOntologyRefs);
	if (sourceOntologyRef === undefined) {
		return undefined;
	}

	const targetOntologyRef = await pickEdgeEndpoint('target', edgeLabel, targetOntologyRefs);
	if (targetOntologyRef === undefined) {
		return undefined;
	}

	return { sourceOntologyRef, targetOntologyRef };
}

async function pickEdgeEndpoint(
	endpoint: 'source' | 'target',
	edgeLabel: string,
	candidates: readonly string[],
): Promise<string | undefined> {
	if (candidates.length === 1) {
		return candidates[0];
	}

	if (candidates.length === 0) {
		return undefined;
	}

	const selected = await vscode.window.showQuickPick(
		candidates.map((reference) => ({
			label: endpointDisplayLabel(reference),
			description: endpointDisplayLabel(reference) === reference ? undefined : reference,
			reference,
		})),
		{
			title: `Select ${endpoint} for ${edgeLabel}`,
			placeHolder: `Choose the ontology ${endpoint} for this relationship.`,
		},
	);
	return selected?.reference;
}

function endpointDisplayLabel(reference: string): string {
	const separatorIndex = Math.max(reference.lastIndexOf('#'), reference.lastIndexOf('/'));
	return separatorIndex >= 0 && separatorIndex < reference.length - 1
		? reference.slice(separatorIndex + 1)
		: reference;
}

function relationshipPayloads(loadedOntologies: readonly LoadedOntology[]): readonly ModelTreeItemDropPayload[] {
	return loadedOntologies.flatMap((ontology) =>
		ontology.items
			.filter((item) => isConnectionCapableOntologyItem(item.type))
			.map((item) => relationshipPayload(ontology, item)),
	);
}

function relationshipPayload(ontology: LoadedOntology, item: OntologyItem): ModelTreeItemDropPayload {
	return {
		sourceOntologyFilePath: ontology.relativePath,
		ontologyItemType: item.type,
		ontologyItemReference: item.reference,
		displayLabel: item.displayLabel,
		ontologyItemMetadata: item.metadata,
	};
}
