import { Graph, HandleConfig, InternalEvent, StyleDefaultsConfig, VertexHandlerConfig, type EventObject, type SelectionHandler } from '@maxgraph/core';

import type { CanvasPoint, WebviewMessage } from '../shared/ontology-diagram-events';
import { CanvasDropController } from './canvas-drop-controller';
import { CanvasGeometryPersistence, isGraphCell } from './canvas-geometry-persistence';
import { imageBounds, imageVertex, renderImageToolbarIcon } from './ontology-diagram-images';
import { nodeBounds, nodeVertex } from './ontology-diagram-nodes';
import { NoteEditorController, noteBounds, noteVertex, renderNoteToolbarIcon } from './ontology-diagram-notes';
import type { DiagramPayload } from './ontology-diagram-types';
import { readTheme } from './webview-theme';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewMessage): void;
};

declare global {
	interface Window {
		ontologyDiagramEditorConfig?: WebviewConfig;
	}
}

interface WebviewConfig {
	readonly payload: DiagramPayload;
	readonly modelTreeDragMimeType: string;
}

const config = window.ontologyDiagramEditorConfig;

if (config === undefined) {
	throw new Error('Missing ontology diagram webview configuration.');
}

const vscode = acquireVsCodeApi();
const canvasScroll = requiredElement('canvasScroll');
const canvasContent = requiredElement('canvasContent');
const status = requiredElement('status');
const addNoteButton = requiredElement('addNoteButton') as HTMLButtonElement;
const addImageButton = requiredElement('addImageButton') as HTMLButtonElement;
const noteEditor = requiredElement('noteEditor') as HTMLFormElement;
const noteEditorText = requiredElement('noteEditorText') as HTMLTextAreaElement;
const saveNoteButton = requiredElement('saveNoteButton') as HTMLButtonElement;
const cancelNoteButton = requiredElement('cancelNoteButton') as HTMLButtonElement;
const theme = readTheme();
const graph = new Graph(canvasContent);
const geometryPersistence = new CanvasGeometryPersistence({
	graph,
	postMessage: (message) => vscode.postMessage(message),
	showStatus,
});
const noteEditorController = new NoteEditorController({
	addNoteButton,
	noteEditor,
	noteEditorText,
	saveNoteButton,
	cancelNoteButton,
	getNoteText: (noteId) => geometryPersistence.getNoteText(noteId),
	createNote: (text) => {
		vscode.postMessage({
			type: 'createNote',
			text,
			position: insertionPosition(),
		});
	},
	updateNoteText: (noteId, text) => {
		geometryPersistence.setNoteText(noteId, text);
		vscode.postMessage({
			type: 'updateNoteText',
			id: noteId,
			text,
		});
	},
	showStatus,
	focusAfterClose: () => {
		canvasScroll.focus();
	},
});

configureGraph(graph);
renderNoteToolbarIcon(addNoteButton);
renderImageToolbarIcon(addImageButton);
render();
noteEditorController.register();
addImageButton.addEventListener('click', () => {
	vscode.postMessage({
		type: 'createImage',
		position: insertionPosition(),
	});
});
new CanvasDropController({
	scrollElement: canvasScroll,
	contentElement: canvasContent,
	modelTreeDragMimeType: config.modelTreeDragMimeType,
	postMessage: (message) => vscode.postMessage(message),
	showStatus,
}).register();
geometryPersistence.register();
registerNoteEditHandlers();

function configureGraph(graph: Graph): void {
	VertexHandlerConfig.selectionColor = theme.focusBorder;
	VertexHandlerConfig.selectionStrokeWidth = 2;
	VertexHandlerConfig.selectionDashed = false;
	VertexHandlerConfig.cursorMovable = 'move';
	HandleConfig.fillColor = theme.editorBackground;
	HandleConfig.strokeColor = theme.focusBorder;
	HandleConfig.size = 7;
	StyleDefaultsConfig.shadowColor = theme.shadowColor;
	StyleDefaultsConfig.shadowOffsetX = 0;
	StyleDefaultsConfig.shadowOffsetY = 2;
	StyleDefaultsConfig.shadowOpacity = 0.18;

	const selectionHandler = graph.getPlugin<SelectionHandler>('SelectionHandler');
	if (selectionHandler !== undefined) {
		selectionHandler.previewColor = theme.focusBorder;
	}

	graph.setHtmlLabels(true);
	graph.setPanning(true);
	graph.setCellsCloneable(false);
	graph.setCellsDeletable(false);
	graph.setCellsDisconnectable(false);
	graph.setCellsEditable(false);
	graph.setConnectable(false);
	graph.setTooltips(true);
	graph.setCellsResizable(true);
	graph.setCellsMovable(true);
}

function render(): void {
	if (config?.payload.error !== undefined) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement('error-state', config.payload.error));
		return;
	}

	const nodes = config?.payload.diagram?.nodes ?? [];
	const notes = config?.payload.diagram?.notes ?? [];
	const images = config?.payload.diagram?.images ?? [];
	if (nodes.length === 0 && notes.length === 0 && images.length === 0) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement(
			'empty-state',
			'Drag a class, individual, or datatype from the model tree, or add a note or image from the canvas toolbar.',
		));
		return;
	}

	graph.batchUpdate(() => {
		for (const node of nodes) {
			geometryPersistence.trackNodeBounds(nodeBounds(node));
			const vertex = nodeVertex(node, theme);
			graph.insertVertex(
				graph.getDefaultParent(),
				vertex.id,
				vertex.value,
				vertex.position[0],
				vertex.position[1],
				vertex.size[0],
				vertex.size[1],
				vertex.style,
			);
		}
		for (const note of notes) {
			geometryPersistence.trackNote(noteBounds(note), note.text);
			const vertex = noteVertex(note, theme);
			graph.insertVertex(
				graph.getDefaultParent(),
				vertex.id,
				vertex.value,
				vertex.position[0],
				vertex.position[1],
				vertex.size[0],
				vertex.size[1],
				vertex.style,
			);
		}
		for (const image of images) {
			geometryPersistence.trackImageBounds(imageBounds(image));
			const vertex = imageVertex(image, theme);
			graph.insertVertex(
				graph.getDefaultParent(),
				vertex.id,
				vertex.value,
				vertex.position[0],
				vertex.position[1],
				vertex.size[0],
				vertex.size[1],
				vertex.style,
			);
		}
	});
}

function registerNoteEditHandlers(): void {
	canvasScroll.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen()) {
			return;
		}
		if (event.key !== 'Enter' || event.shiftKey || event.altKey || event.metaKey || event.ctrlKey) {
			return;
		}
		if (event.target instanceof HTMLButtonElement || event.target instanceof HTMLTextAreaElement) {
			return;
		}

		if (editNoteCell(graph.getSelectionCell())) {
			event.preventDefault();
		}
	});
	graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: unknown, event: EventObject) => {
		if (editNoteCell(event.getProperty('cell'))) {
			event.consume();
		}
	});
}

function editNoteCell(cell: unknown): boolean {
	if (!isGraphCell(cell)) {
		return false;
	}

	const id = cell.getId();
	if (id === null || !geometryPersistence.hasNote(id)) {
		return false;
	}

	noteEditorController.open(id);

	return true;
}

function insertionPosition(): CanvasPoint {
	return {
		x: Math.max(0, Math.round(canvasScroll.scrollLeft + 80)),
		y: Math.max(0, Math.round(canvasScroll.scrollTop + 80)),
	};
}

function messageElement(className: string, text: string): HTMLElement {
	const element = document.createElement('div');
	element.className = className;
	element.textContent = text;
	return element;
}

function showStatus(message: string): void {
	status.textContent = message;
	status.classList.add('visible');
	setTimeout(() => {
		status.classList.remove('visible');
	}, 3500);
}

function requiredElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing required element #${id}.`);
	}

	return element;
}
