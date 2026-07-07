import * as vscode from 'vscode';
import * as path from 'path';
import { readFile } from 'fs/promises';

import {
	AlignSubclassEndpointsUseCase,
	ArrangeDiagramUseCase,
	CreateEdgeUseCase,
	CreateCommentNoteUseCase,
	CreateImageUseCase,
	CreateLabelUseCase,
	CreateNodeUseCase,
	CreateNoteConnectionUseCase,
	CreateNoteUseCase,
	DeleteElementsUseCase,
	DeleteEdgeUseCase,
	DeleteImageUseCase,
	DeleteLabelUseCase,
	DeleteNodeUseCase,
	DeleteNoteUseCase,
	OptimizeEdgeRouteUseCase,
	SaveDiagramExportUseCase,
	ShowRelatedElementsUseCase,
	StraightenEdgeRouteUseCase,
	UpdateEdgeRouteUseCase,
	UpdateEdgeRouteLayoutUseCase,
	UpdateElementBoundsUseCase,
	UpdateElementStyleUseCase,
	UpdateImageBoundsUseCase,
	UpdateImageSourceUseCase,
	UpdateLabelBoundsUseCase,
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
import { isConnectionCapableOntologyItem } from './use-cases/ontology-edge-endpoints';
import { loadReferencedOntologies, type LoadedOntology, type OntologyItem } from '../ui/model-tree/ontology-model';

interface DiagramEditorUseCases {
	readonly alignSubclassEndpoints: AlignSubclassEndpointsUseCase;
	readonly arrangeDiagram: ArrangeDiagramUseCase;
	readonly createNode: CreateNodeUseCase;
	readonly createEdge: CreateEdgeUseCase;
	readonly createCommentNote: CreateCommentNoteUseCase;
	readonly createNote: CreateNoteUseCase;
	readonly createNoteConnection: CreateNoteConnectionUseCase;
	readonly createImage: CreateImageUseCase;
	readonly createLabel: CreateLabelUseCase;
	readonly deleteNode: DeleteNodeUseCase;
	readonly deleteElements: DeleteElementsUseCase;
	readonly deleteEdge: DeleteEdgeUseCase;
	readonly deleteNote: DeleteNoteUseCase;
	readonly deleteImage: DeleteImageUseCase;
	readonly deleteLabel: DeleteLabelUseCase;
	readonly optimizeEdgeRoute: OptimizeEdgeRouteUseCase;
	readonly straightenEdgeRoute: StraightenEdgeRouteUseCase;
	readonly showRelatedElements: ShowRelatedElementsUseCase;
	readonly updateEdgeRoute: UpdateEdgeRouteUseCase;
	readonly updateEdgeRouteLayout: UpdateEdgeRouteLayoutUseCase;
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
	readonly updateNoteText: UpdateNoteTextUseCase;
	readonly updateLabelText: UpdateLabelTextUseCase;
	readonly updateThemeMode: UpdateThemeModeUseCase;
	readonly saveDiagramExport: SaveDiagramExportUseCase;
}

export class DiagramCommandDispatcher {
	private readonly useCases: DiagramEditorUseCases;

	public constructor(
		private readonly repository: DiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
		private readonly revealModelTreeItem: (diagramElementId: string) => Promise<boolean> = async () => false,
		useCases: DiagramEditorUseCases = createDefaultUseCases(),
	) {
		this.useCases = useCases;
	}

	public async dispatch(command: WebviewCommand): Promise<void> {
		switch (command.type) {
			case 'alignSubclassEndpoints':
				await this.handleResult(this.useCases.alignSubclassEndpoints.execute(
					this.repository.load(),
					command.nodeIds,
				));
				return;
			case 'arrangeDiagram':
				await this.handleResult(this.useCases.arrangeDiagram.execute(
					this.repository.load(),
				));
				return;
			case 'undoDiagram':
				await this.undoOrRedo('undo');
				return;
			case 'redoDiagram':
				await this.undoOrRedo('redo');
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
			case 'updateImageSource':
				await this.handleResult(this.useCases.updateImageSource.execute(
					this.repository.load(),
					command.id,
					command.source,
				));
				return;
			case 'pickNodeImage':
				await this.pickNodeImage(command.id);
				return;
			case 'pickImageSource':
				await this.pickImageSource(command.id);
				return;
			case 'updateLabelBounds':
				await this.handleResult(this.useCases.updateLabelBounds.execute(
					this.repository.load(),
					command.updates,
				));
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

	private async undoOrRedo(command: 'undo' | 'redo'): Promise<void> {
		await vscode.commands.executeCommand(command);
		await this.repository.saveCurrentDocument();
	}

	private async createNode(command: Extract<WebviewCommand, { readonly type: 'createNode' }>): Promise<void> {
		const resolvedPayload = command.payload ?? this.getLastDraggedModelTreeItem();
		if (resolvedPayload === undefined) {
			await vscode.window.showInformationMessage('Drag a model-tree item onto the canvas while holding Shift.');
			return;
		}

		if (isConnectionCapableOntologyItem(resolvedPayload.ontologyItemType)) {
			await this.handleResult(this.useCases.createEdge.execute(
				this.repository.load(),
				resolvedPayload,
				command.position,
			));
			return;
		}

		await this.handleResult(this.useCases.createNode.execute(
			this.repository.load(),
			resolvedPayload,
			command.position,
			command.size,
		));
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
		const selectedEdgeIds = diagram.edges.filter((edge) => ids.has(edge.id.value)).map((edge) => edge.id.value);
		const selectedElementCount = selectedNodeIds.length + selectedNoteIds.length + selectedImageIds.length + selectedLabelIds.length + selectedEdgeIds.length;
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

	private async createImage(command: Extract<WebviewCommand, { readonly type: 'createImage' }>): Promise<void> {
		const imageUri = await pickImageFile('Add Image', 'Add image to ontology diagram');
		if (imageUri === undefined) {
			return;
		}

		await this.handleResult(this.useCases.createImage.execute(
			this.repository.load(),
			await embeddedImageSourceFromFile(imageUri.fsPath),
			command.position,
		));
	}

	private async pickNodeImage(id: string): Promise<void> {
		const imageUri = await pickImageFile('Set Image', 'Set node image');
		if (imageUri === undefined) {
			return;
		}

		await this.handleResult(this.useCases.updateNodeImage.execute(
			this.repository.load(),
			id,
			await embeddedImageSourceFromFile(imageUri.fsPath),
		));
	}

	private async pickImageSource(id: string): Promise<void> {
		const imageUri = await pickImageFile('Set Image', 'Set standalone image source');
		if (imageUri === undefined) {
			return;
		}

		await this.handleResult(this.useCases.updateImageSource.execute(
			this.repository.load(),
			id,
			await embeddedImageSourceFromFile(imageUri.fsPath),
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
			await this.repository.save(result.diagram);
		}
	}
}

function createDefaultUseCases(): DiagramEditorUseCases {
	return {
		alignSubclassEndpoints: new AlignSubclassEndpointsUseCase(),
		arrangeDiagram: new ArrangeDiagramUseCase(),
		createNode: new CreateNodeUseCase(),
		createEdge: new CreateEdgeUseCase(),
		createCommentNote: new CreateCommentNoteUseCase(),
		createNote: new CreateNoteUseCase(),
		createNoteConnection: new CreateNoteConnectionUseCase(),
		createImage: new CreateImageUseCase(),
		createLabel: new CreateLabelUseCase(),
		deleteNode: new DeleteNodeUseCase(),
		deleteElements: new DeleteElementsUseCase(),
		deleteEdge: new DeleteEdgeUseCase(),
		deleteNote: new DeleteNoteUseCase(),
		deleteImage: new DeleteImageUseCase(),
		deleteLabel: new DeleteLabelUseCase(),
		optimizeEdgeRoute: new OptimizeEdgeRouteUseCase(),
		straightenEdgeRoute: new StraightenEdgeRouteUseCase(),
		showRelatedElements: new ShowRelatedElementsUseCase(),
		updateEdgeRoute: new UpdateEdgeRouteUseCase(),
		updateEdgeRouteLayout: new UpdateEdgeRouteLayoutUseCase(),
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
