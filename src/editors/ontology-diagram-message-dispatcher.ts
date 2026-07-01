import * as vscode from 'vscode';

import {
	CreateImageUseCase,
	CreateNodeUseCase,
	CreateNoteUseCase,
	DeleteImageUseCase,
	DeleteNoteUseCase,
	UpdateImageBoundsUseCase,
	UpdateNodeBoundsUseCase,
	UpdateNoteBoundsUseCase,
	UpdateNoteTextUseCase,
} from '../application/diagram-editor';
import type { DiagramMutationResult } from '../application/diagram-editor';
import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import type { ModelTreeItemDropPayload, WebviewMessage } from '../shared/ontology-diagram-events';
import { embeddedImageSourceFromFile } from './image-source-embedding';
import { OntologyDiagramDocumentRepository } from './ontology-diagram-document-repository';

interface DiagramEditorUseCases {
	readonly createNode: CreateNodeUseCase;
	readonly createNote: CreateNoteUseCase;
	readonly createImage: CreateImageUseCase;
	readonly deleteNote: DeleteNoteUseCase;
	readonly deleteImage: DeleteImageUseCase;
	readonly updateNodeBounds: UpdateNodeBoundsUseCase;
	readonly updateNoteBounds: UpdateNoteBoundsUseCase;
	readonly updateImageBounds: UpdateImageBoundsUseCase;
	readonly updateNoteText: UpdateNoteTextUseCase;
}

export class OntologyDiagramMessageDispatcher {
	private readonly useCases: DiagramEditorUseCases;

	public constructor(
		private readonly repository: OntologyDiagramDocumentRepository,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
		useCases: DiagramEditorUseCases = createDefaultUseCases(),
	) {
		this.useCases = useCases;
	}

	public async dispatch(message: WebviewMessage): Promise<void> {
		switch (message.type) {
			case 'createNode':
				await this.createNode(message);
				return;
			case 'updateNodeBounds':
				await this.handleResult(this.useCases.updateNodeBounds.execute(
					this.repository.load(),
					message.updates,
				));
				return;
			case 'createNote':
				await this.handleResult(this.useCases.createNote.execute(
					this.repository.load(),
					message.text,
					message.position,
				));
				return;
			case 'createImage':
				await this.createImage(message);
				return;
			case 'deleteNote':
				await this.deleteNote(message);
				return;
			case 'deleteImage':
				await this.deleteImage(message);
				return;
			case 'updateNoteBounds':
				await this.handleResult(this.useCases.updateNoteBounds.execute(
					this.repository.load(),
					message.updates,
				));
				return;
			case 'updateImageBounds':
				await this.handleResult(this.useCases.updateImageBounds.execute(
					this.repository.load(),
					message.updates,
				));
				return;
			case 'updateNoteText':
				await this.handleResult(this.useCases.updateNoteText.execute(
					this.repository.load(),
					message.id,
					message.text,
				));
				return;
		}
	}

	private async createNode(message: Extract<WebviewMessage, { readonly type: 'createNode' }>): Promise<void> {
		const resolvedPayload = message.payload ?? this.getLastDraggedModelTreeItem();
		if (resolvedPayload === undefined) {
			await vscode.window.showInformationMessage('Drag a model-tree item onto the canvas while holding Shift.');
			return;
		}

		await this.handleResult(this.useCases.createNode.execute(
			this.repository.load(),
			resolvedPayload,
			message.position,
		));
	}

	private async deleteImage(message: Extract<WebviewMessage, { readonly type: 'deleteImage' }>): Promise<void> {
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
			message.id,
		));
	}

	private async deleteNote(message: Extract<WebviewMessage, { readonly type: 'deleteNote' }>): Promise<void> {
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
			message.id,
		));
	}

	private async createImage(message: Extract<WebviewMessage, { readonly type: 'createImage' }>): Promise<void> {
		const selectedImage = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
			},
			openLabel: 'Add Image',
			title: 'Add image to ontology diagram',
		});
		const imageUri = selectedImage?.[0];
		if (imageUri === undefined) {
			return;
		}

		await this.handleResult(this.useCases.createImage.execute(
			this.repository.load(),
			await embeddedImageSourceFromFile(imageUri.fsPath),
			message.position,
		));
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
		createNote: new CreateNoteUseCase(),
		createImage: new CreateImageUseCase(),
		deleteNote: new DeleteNoteUseCase(),
		deleteImage: new DeleteImageUseCase(),
		updateNodeBounds: new UpdateNodeBoundsUseCase(),
		updateNoteBounds: new UpdateNoteBoundsUseCase(),
		updateImageBounds: new UpdateImageBoundsUseCase(),
		updateNoteText: new UpdateNoteTextUseCase(),
	};
}
