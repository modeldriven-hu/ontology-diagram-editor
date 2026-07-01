import * as vscode from 'vscode';

import {
	CreateNodeUseCase,
	CreateNoteUseCase,
	UpdateNodeBoundsUseCase,
	UpdateNoteBoundsUseCase,
	UpdateNoteTextUseCase,
} from '../application/diagram-editor';
import type { DiagramMutationResult } from '../application/diagram-editor';
import type { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import type { ModelTreeItemDropPayload, WebviewMessage } from '../shared/ontology-diagram-events';
import { OntologyDiagramDocumentRepository } from './ontology-diagram-document-repository';

interface DiagramEditorUseCases {
	readonly createNode: CreateNodeUseCase;
	readonly createNote: CreateNoteUseCase;
	readonly updateNodeBounds: UpdateNodeBoundsUseCase;
	readonly updateNoteBounds: UpdateNoteBoundsUseCase;
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
			case 'updateNoteBounds':
				await this.handleResult(this.useCases.updateNoteBounds.execute(
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
		updateNodeBounds: new UpdateNodeBoundsUseCase(),
		updateNoteBounds: new UpdateNoteBoundsUseCase(),
		updateNoteText: new UpdateNoteTextUseCase(),
	};
}
