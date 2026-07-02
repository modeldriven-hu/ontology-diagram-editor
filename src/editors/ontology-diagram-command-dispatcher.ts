import * as vscode from 'vscode';
import * as path from 'path';

import {
	CreateEdgeUseCase,
	CreateImageUseCase,
	CreateLabelUseCase,
	CreateNodeUseCase,
	CreateNoteUseCase,
	DeleteEdgeUseCase,
	DeleteImageUseCase,
	DeleteLabelUseCase,
	DeleteNodeUseCase,
	DeleteNoteUseCase,
	SaveDiagramExportUseCase,
	UpdateEdgeRouteUseCase,
	UpdateImageBoundsUseCase,
	UpdateImageSourceUseCase,
	UpdateLabelBoundsUseCase,
	UpdateLabelTextUseCase,
	UpdateNodeBoundsUseCase,
	UpdateNodeImageUseCase,
	UpdateNoteBoundsUseCase,
	UpdateNoteTextUseCase,
} from '../application/diagram-editor';
import type { DiagramExportSavePort, DiagramMutationResult } from '../application/diagram-editor';
import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree';
import type { ModelTreeItemDropPayload, WebviewCommand } from '../shared/commands/webview-commands';
import { embeddedImageSourceFromFile } from './image-source-embedding';
import { OntologyDiagramDocumentRepository } from './ontology-diagram-document-repository';

interface DiagramEditorUseCases {
	readonly createNode: CreateNodeUseCase;
	readonly createEdge: CreateEdgeUseCase;
	readonly createNote: CreateNoteUseCase;
	readonly createImage: CreateImageUseCase;
	readonly createLabel: CreateLabelUseCase;
	readonly deleteNode: DeleteNodeUseCase;
	readonly deleteEdge: DeleteEdgeUseCase;
	readonly deleteNote: DeleteNoteUseCase;
	readonly deleteImage: DeleteImageUseCase;
	readonly deleteLabel: DeleteLabelUseCase;
	readonly updateEdgeRoute: UpdateEdgeRouteUseCase;
	readonly updateNodeBounds: UpdateNodeBoundsUseCase;
	readonly updateNodeImage: UpdateNodeImageUseCase;
	readonly updateNoteBounds: UpdateNoteBoundsUseCase;
	readonly updateImageBounds: UpdateImageBoundsUseCase;
	readonly updateImageSource: UpdateImageSourceUseCase;
	readonly updateLabelBounds: UpdateLabelBoundsUseCase;
	readonly updateNoteText: UpdateNoteTextUseCase;
	readonly updateLabelText: UpdateLabelTextUseCase;
	readonly saveDiagramExport: SaveDiagramExportUseCase;
}

export class OntologyDiagramCommandDispatcher {
	private readonly useCases: DiagramEditorUseCases;

	public constructor(
		private readonly repository: OntologyDiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
		useCases: DiagramEditorUseCases = createDefaultUseCases(),
	) {
		this.useCases = useCases;
	}

	public async dispatch(command: WebviewCommand): Promise<void> {
		switch (command.type) {
			case 'createNode':
				await this.createNode(command);
				return;
			case 'updateNodeBounds':
				await this.handleResult(this.useCases.updateNodeBounds.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateEdgeRoute':
				await this.handleResult(this.useCases.updateEdgeRoute.execute(
					this.repository.load(),
					command.updates,
				));
				return;
			case 'updateNodeImage':
				await this.handleResult(this.useCases.updateNodeImage.execute(
					this.repository.load(),
					command.id,
					command.image,
				));
				return;
			case 'createNote':
				await this.handleResult(this.useCases.createNote.execute(
					this.repository.load(),
					command.text,
					command.position,
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
		}
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
		));
	}

	private async deleteImage(command: Extract<WebviewCommand, { readonly type: 'deleteImage' }>): Promise<void> {
		const confirmed = await vscode.window.showWarningMessage(
			'Delete this image from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteImage.execute(
			this.repository.load(),
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
		const confirmed = await vscode.window.showWarningMessage(
			'Delete this note from the diagram?',
			{ modal: true },
			'Delete',
		);
		if (confirmed !== 'Delete') {
			return;
		}

		await this.handleResult(this.useCases.deleteNote.execute(
			this.repository.load(),
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
		createNode: new CreateNodeUseCase(),
		createEdge: new CreateEdgeUseCase(),
		createNote: new CreateNoteUseCase(),
		createImage: new CreateImageUseCase(),
		createLabel: new CreateLabelUseCase(),
		deleteNode: new DeleteNodeUseCase(),
		deleteEdge: new DeleteEdgeUseCase(),
		deleteNote: new DeleteNoteUseCase(),
		deleteImage: new DeleteImageUseCase(),
		deleteLabel: new DeleteLabelUseCase(),
		updateEdgeRoute: new UpdateEdgeRouteUseCase(),
		updateNodeBounds: new UpdateNodeBoundsUseCase(),
		updateNodeImage: new UpdateNodeImageUseCase(),
		updateNoteBounds: new UpdateNoteBoundsUseCase(),
		updateImageBounds: new UpdateImageBoundsUseCase(),
		updateImageSource: new UpdateImageSourceUseCase(),
		updateLabelBounds: new UpdateLabelBoundsUseCase(),
		updateNoteText: new UpdateNoteTextUseCase(),
		updateLabelText: new UpdateLabelTextUseCase(),
		saveDiagramExport: new SaveDiagramExportUseCase(new VsCodeDiagramExportSavePort()),
	};
}

function isConnectionCapableOntologyItem(type: string): boolean {
	return type === 'objectProperty' || type === 'dataProperty' || type === 'subclassRelationship';
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
