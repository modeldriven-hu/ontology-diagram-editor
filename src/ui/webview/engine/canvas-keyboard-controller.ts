import { CanvasRedoRequestedEvent, CanvasUndoRequestedEvent } from '../../../shared/canvas-editor-events';
import type { CanvasPoint } from '../../../shared/canvas-geometry';
import { DeleteEdgeCommand, DeleteElementsCommand, DeleteImageCommand, DeleteLabelCommand, DeleteLegendElementCommand, DeleteMetadataElementCommand, DeleteNodeCommand, DeleteNoteCommand, RedoDiagramCommand, UndoDiagramCommand } from '../../../shared/webview-commands';
import type { CanvasElementRegistry } from '../components/canvas-element-registry';
import type { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { isKeyboardInputTarget, isTextEditingTarget } from './canvas-dom';
import { isSelectAllShortcut } from './canvas-keyboard-shortcuts';
import type { CanvasMessageBus } from './canvas-message-bus';
import type { DiagramCanvasEngine } from './diagram-canvas-engine';

interface CanvasKeyboardControllerOptions {
	readonly canvas: DiagramCanvasEngine;
	readonly elementRegistry: CanvasElementRegistry;
	readonly geometryPersistence: CanvasGeometryPersistence;
	readonly messageBus: CanvasMessageBus;
	readonly noteEditorIsOpen: () => boolean;
	readonly diagramFilePath?: string;
	readonly showStatus: (message: string) => void;
}

export class CanvasKeyboardController {
	public constructor(private readonly options: CanvasKeyboardControllerOptions) {}

	public register(): void {
		this.registerUndoRedoHandlers();
		this.registerSelectAllHandler();
		this.registerKeyboardNudgeHandlers();
		this.registerDeleteHandlers();
	}

private registerUndoRedoHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (this.options.noteEditorIsOpen() || isTextEditingTarget(event.target)) {
			return;
		}

		const action = this.undoRedoAction(event);
		if (action === undefined) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (action === 'undo') {
			this.requestDiagramUndo();
		} else {
			this.requestDiagramRedo();
		}
	});
}

private requestDiagramUndo(): void {
	this.options.messageBus.publishEvent(new CanvasUndoRequestedEvent({
		diagramFilePath: this.options.diagramFilePath,
	}));
	this.options.messageBus.publishCommand(new UndoDiagramCommand());
	this.options.showStatus('Undoing diagram edit.');
}

private requestDiagramRedo(): void {
	this.options.messageBus.publishEvent(new CanvasRedoRequestedEvent({
		diagramFilePath: this.options.diagramFilePath,
	}));
	this.options.messageBus.publishCommand(new RedoDiagramCommand());
	this.options.showStatus('Redoing diagram edit.');
}

private undoRedoAction(event: KeyboardEvent): 'undo' | 'redo' | undefined {
	const key = event.key.toLowerCase();
	const commandModifier = event.metaKey || event.ctrlKey;
	if (!commandModifier || event.altKey) {
		return undefined;
	}

	if (key === 'z') {
		return event.shiftKey ? 'redo' : 'undo';
	}
	if (key === 'y' && event.ctrlKey && !event.metaKey && !event.shiftKey) {
		return 'redo';
	}

	return undefined;
}

private registerSelectAllHandler(): void {
	document.addEventListener('keydown', (event) => {
		if (this.options.noteEditorIsOpen() || isTextEditingTarget(event.target) || !isSelectAllShortcut(event)) {
			return;
		}

		this.options.canvas.selectElements(this.options.elementRegistry.renderedElementIdentifiers());
		event.preventDefault();
		event.stopPropagation();
	}, { capture: true });
}

private registerKeyboardNudgeHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (this.options.noteEditorIsOpen() || isKeyboardInputTarget(event.target)) {
			return;
		}
		if (event.ctrlKey || event.metaKey) {
			return;
		}

		const delta = this.keyboardNudgeDelta(event);
		if (delta === undefined) {
			return;
		}

		const selectedElementIds = this.options.canvas.selectedElementIds();
		if (selectedElementIds.length > 1 && this.options.canvas.nudgeSelectedElements(delta)) {
			this.consumeKeyboardNudgeEvent(event);
			return;
		}

		const selectedElementId = this.options.canvas.selectedElementId();
		if (selectedElementId === undefined) {
			return;
		}
		if (event.altKey) {
			if (this.options.geometryPersistence.hasEdge(selectedElementId) && this.options.canvas.nudgeEdgeRoute(selectedElementId, delta)) {
				this.consumeKeyboardNudgeEvent(event);
			}
			return;
		}

		if (this.options.geometryPersistence.hasEdge(selectedElementId) && this.options.canvas.nudgeEdgeLabel(selectedElementId, delta)) {
			this.consumeKeyboardNudgeEvent(event);
			return;
		}

		const selectedElementKind = this.options.elementRegistry.element(selectedElementId)?.kind;
		if (this.isKeyboardNudgeableElement(selectedElementKind) && this.options.canvas.nudgeElement(selectedElementId, delta)) {
			this.consumeKeyboardNudgeEvent(event);
		}
	}, { capture: true });
}

private consumeKeyboardNudgeEvent(event: KeyboardEvent): void {
	event.preventDefault();
	event.stopImmediatePropagation();
}

private keyboardNudgeDelta(event: KeyboardEvent): CanvasPoint | undefined {
	const step = event.shiftKey ? 10 : 1;
	if (event.key === 'ArrowLeft') {
		return { x: -step, y: 0 };
	}
	if (event.key === 'ArrowRight') {
		return { x: step, y: 0 };
	}
	if (event.key === 'ArrowUp') {
		return { x: 0, y: -step };
	}
	if (event.key === 'ArrowDown') {
		return { x: 0, y: step };
	}

	return undefined;
}

private isKeyboardNudgeableElement(kind: string | undefined): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image' || kind === 'label' || kind === 'metadata' || kind === 'link';
}

private registerDeleteHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (this.options.noteEditorIsOpen()) {
			return;
		}
		if (event.key !== 'Delete' && event.key !== 'Backspace') {
			return;
		}
		if (isKeyboardInputTarget(event.target)) {
			return;
		}

		if (this.deleteSelectedElements()) {
			event.preventDefault();
			event.stopPropagation();
		}
	});
}

public deleteElement(id: string): boolean {
	const element = this.options.elementRegistry.element(id);
	if (element?.kind === 'node') {
		this.options.messageBus.publishCommand(new DeleteNodeCommand(id));

		return true;
	}

	if (element?.kind === 'edge') {
		this.options.messageBus.publishCommand(new DeleteEdgeCommand(id));

		return true;
	}

	if (this.options.geometryPersistence.hasNote(id)) {
		this.options.messageBus.publishCommand(new DeleteNoteCommand(id));

		return true;
	}

	if (this.options.geometryPersistence.hasImage(id)) {
		this.options.messageBus.publishCommand(new DeleteImageCommand(id));

		return true;
	}

	if (this.options.geometryPersistence.hasLabel(id)) {
		this.options.messageBus.publishCommand(new DeleteLabelCommand(id));

		return true;
	}
	if (this.options.geometryPersistence.hasMetadata(id)) {
		this.options.messageBus.publishCommand(new DeleteMetadataElementCommand(id));
		return true;
	}
	if (this.options.geometryPersistence.hasLegend(id)) {
		this.options.messageBus.publishCommand(new DeleteLegendElementCommand(id));
		return true;
	}
	if (this.options.geometryPersistence.hasDiagramLink(id)) {
		this.options.messageBus.publishCommand(new DeleteElementsCommand([id]));
		return true;
	}

	return false;
}

private deleteSelectedElements(): boolean {
	const selectedElementIds = this.deletableElementIds(this.options.canvas.selectedElementIds());
	if (selectedElementIds.length > 1) {
		this.options.messageBus.publishCommand(new DeleteElementsCommand(selectedElementIds));

		return true;
	}

	return selectedElementIds.length === 1 && this.deleteElement(selectedElementIds[0]);
}

private deletableElementIds(ids: readonly string[]): readonly string[] {
	return [...new Set(ids)].filter((id) => {
		const element = this.options.elementRegistry.element(id);
		return element?.kind === 'node'
			|| element?.kind === 'edge'
			|| this.options.geometryPersistence.hasNote(id)
			|| this.options.geometryPersistence.hasImage(id)
			|| this.options.geometryPersistence.hasLabel(id)
			|| this.options.geometryPersistence.hasMetadata(id)
			|| this.options.geometryPersistence.hasLegend(id)
			|| this.options.geometryPersistence.hasDiagramLink(id);
	});
}
}
