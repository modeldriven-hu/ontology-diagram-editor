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
import type { DiagramEditorUseCases } from './diagram-editor-use-cases';
import { resolveEmbeddedImageSource } from './vscode-image-source-picker';
import { pickEdgeEndpointSelection, pickRelatedElementDepth } from './vscode-ontology-pickers';
import { relationshipPayloads } from './ontology-relationship-payloads';


export class DiagramCommandWorkflows {
	public constructor(
		private readonly repository: DiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItems: () => readonly ModelTreeItemDraggedEvent[],
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean>,
		private readonly useCases: DiagramEditorUseCases,
	) {}

	public async addModelTreeItems(items: readonly ModelTreeItemDropPayload[]): Promise<void> {
		if (items.length === 0) {
			return;
		}

		await this.createMultipleNodes(items, modelTreeBatchPosition(this.repository.load()));
	}

	public async revealSelectedModelTreeItem(diagramElementId: string): Promise<void> {
		if (!await this.revealModelTreeItem(diagramElementId)) {
			await vscode.window.showInformationMessage('No corresponding ontology item was found in the model tree.');
		}
	}

	public async showRelatedElements(nodeId: string): Promise<void> {
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

	public async showEdgesBetweenNodes(nodeIds: readonly string[]): Promise<void> {
		const diagram = this.repository.load();
		const loadedOntologies = await loadReferencedOntologies(this.repository.uri.fsPath, diagram);
		await this.handleResult(this.useCases.showRelatedElements.showEdgesBetweenNodes(
			diagram,
			nodeIds,
			relationshipPayloads(loadedOntologies),
		));
	}

	public async addOntologyItem(position: { readonly x: number; readonly y: number }): Promise<void> {
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

	public async undoOrRedo(command: 'undo' | 'redo'): Promise<void> {
		await vscode.commands.executeCommand(command);
		await this.repository.saveCurrentDocument();
	}

	public async createNode(command: Extract<WebviewCommand, { readonly type: 'createNode' }>): Promise<void> {
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
		));
	}

	public async createMultipleNodes(payloads: readonly ModelTreeItemDropPayload[], position: { readonly x: number; readonly y: number }): Promise<void> {
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

	public async createOntologyEdge(
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

	public async deleteImage(command: Extract<WebviewCommand, { readonly type: 'deleteImage' }>): Promise<void> {
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

	public async deleteNode(command: Extract<WebviewCommand, { readonly type: 'deleteNode' }>): Promise<void> {
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

	public async deleteElements(command: Extract<WebviewCommand, { readonly type: 'deleteElements' }>): Promise<void> {
		const diagram = this.repository.load();
		const ids = new Set(command.ids);
		const selectedNodeIds = diagram.nodes.filter((node) => ids.has(node.id.value)).map((node) => node.id.value);
		const selectedNoteIds = diagram.notes.filter((note) => ids.has(note.id.value)).map((note) => note.id.value);
		const selectedImageIds = diagram.images.filter((image) => ids.has(image.id.value)).map((image) => image.id.value);
		const selectedLabelIds = diagram.labels.filter((label) => ids.has(label.id.value)).map((label) => label.id.value);
		const selectedMetadataIds = diagram.metadataElements.filter((element) => ids.has(element.id.value)).map((element) => element.id.value);
		const selectedDiagramLinkIds = diagram.diagramLinks.filter((link) => ids.has(link.id.value)).map((link) => link.id.value);
		const selectedEdgeIds = diagram.edges.filter((edge) => ids.has(edge.id.value)).map((edge) => edge.id.value);
		const selectedElementCount = selectedNodeIds.length + selectedNoteIds.length + selectedImageIds.length + selectedLabelIds.length + selectedMetadataIds.length + selectedDiagramLinkIds.length + selectedEdgeIds.length;
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

	public async deleteEdge(command: Extract<WebviewCommand, { readonly type: 'deleteEdge' }>): Promise<void> {
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

	public async deleteNote(command: Extract<WebviewCommand, { readonly type: 'deleteNote' }>): Promise<void> {
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

	public async deleteLabel(command: Extract<WebviewCommand, { readonly type: 'deleteLabel' }>): Promise<void> {
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

	public async deleteMetadataElement(command: Extract<WebviewCommand, { readonly type: 'deleteMetadataElement' }>): Promise<void> {
		const confirmed = await vscode.window.showWarningMessage('Delete this diagram information element?', { modal: true }, 'Delete');
		if (confirmed === 'Delete') {
			await this.handleResult(this.useCases.deleteMetadataElement.execute(this.repository.load(), command.id));
		}
	}

	public async createImage(command: Extract<WebviewCommand, { readonly type: 'createImage' }>): Promise<void> {
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

	public async createDiagramLink(command: Extract<WebviewCommand, { readonly type: 'createDiagramLink' }>): Promise<void> {
		const reference = await this.pickDiagramReference('Add Linked Diagram');
		if (reference === undefined) {
			return;
		}
		await this.handleResult(this.useCases.createDiagramLink.execute(this.repository.load(), reference, command.position));
	}

	public async updateDiagramLinkReference(command: Extract<WebviewCommand, { readonly type: 'updateDiagramLinkReference' }>): Promise<void> {
		const reference = command.pickFile ? await this.pickDiagramReference('Change Linked Diagram') : command.reference;
		if (reference === undefined) {
			return;
		}
		await this.handleResult(this.useCases.updateDiagramLinkReference.execute(this.repository.load(), command.id, reference));
	}

	public async updateDiagramLinkIcon(command: Extract<WebviewCommand, { readonly type: 'updateDiagramLinkIcon' }>): Promise<void> {
		const icon = command.pickFile
			? await resolveEmbeddedImageSource(undefined, true, 'Set Icon', 'Set linked diagram icon')
			: command.icon;
		if (command.pickFile && icon === undefined) {
			return;
		}
		await this.handleResult(this.useCases.updateDiagramLinkIcon.execute(this.repository.load(), command.id, icon));
	}

	public async openDiagramLink(command: Extract<WebviewCommand, { readonly type: 'openDiagramLink' }>): Promise<void> {
		const link = this.repository.load().diagramLinks.find((candidate) => candidate.id.value === command.id);
		if (link === undefined) {
			return;
		}
		const target = vscode.Uri.file(path.resolve(path.dirname(this.repository.uri.fsPath), link.diagramRef));
		try {
			await vscode.workspace.fs.stat(target);
			await vscode.commands.executeCommand('vscode.open', target);
		} catch {
			await vscode.window.showErrorMessage(`Could not open linked diagram: ${link.diagramRef}`);
		}
	}

	private async pickDiagramReference(title: string): Promise<string | undefined> {
		const selected = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			defaultUri: vscode.Uri.file(path.dirname(this.repository.uri.fsPath)),
			filters: { 'Ontology diagrams': ['odiagram'] },
			openLabel: 'Select Diagram',
			title,
		});
		const target = selected?.[0];
		if (target === undefined) {
			return undefined;
		}
		if (target.toString() === this.repository.uri.toString()) {
			await vscode.window.showInformationMessage('A diagram cannot link to itself.');
			return undefined;
		}
		return path.relative(path.dirname(this.repository.uri.fsPath), target.fsPath).replaceAll(path.sep, '/');
	}

	public async pickNodeImage(command: Extract<WebviewCommand, { readonly type: 'pickNodeImage' }>): Promise<void> {
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

	public async pickImageSource(command: Extract<WebviewCommand, { readonly type: 'pickImageSource' }>): Promise<void> {
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

	public async updateLegendColors(command: Extract<WebviewCommand, { readonly type: 'updateLegendColors' }>): Promise<void> {
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

	public async updateLegendColorBy(command: Extract<WebviewCommand, { readonly type: 'updateLegendColorBy' }>): Promise<void> {
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

	public async saveDiagramExport(command: Extract<WebviewCommand, { readonly type: 'saveDiagramExport' }>): Promise<void> {
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

	public async handleResult(result: DiagramMutationResult): Promise<void> {
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


