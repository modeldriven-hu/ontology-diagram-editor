import { Graph, HandleConfig, InternalEvent, StyleDefaultsConfig, VertexHandlerConfig, type EventObject, type SelectionHandler } from '@maxgraph/core';

import type { CanvasPoint, WebviewMessage } from '../shared/ontology-diagram-events';
import { CanvasDropController } from './canvas-drop-controller';
import { CanvasElementRegistry } from './canvas-element-registry';
import { CanvasEventBus } from './canvas-event-bus';
import { createPngExportMessage, createSvgExportMessage, renderDiagramExportToolbarIcons } from './canvas-export';
import { CanvasGeometryPersistence, isGraphCell } from './canvas-geometry-persistence';
import { CanvasPropertyPanel } from './canvas-property-panel';
import { insertEdge } from './ontology-diagram-edges';
import { imageBounds, imageVertex, renderImageToolbarIcon } from './ontology-diagram-images';
import { labelBounds, labelVertex, renderLabelToolbarIcon } from './ontology-diagram-labels';
import { nodeBounds, nodeVertex } from './ontology-diagram-nodes';
import { NoteEditorController, noteBounds, noteVertex, renderNoteToolbarIcon } from './ontology-diagram-notes';
import type { DiagramPayload } from './ontology-diagram-types';
import { readTheme } from './webview-theme';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewMessage): void;
	getState(): WebviewState | undefined;
	setState(state: WebviewState): void;
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

interface WebviewState {
	readonly selectedCellId?: string;
	readonly propertyPanelCollapsed?: boolean;
	readonly viewportPanX?: number;
	readonly viewportPanY?: number;
}

const config = window.ontologyDiagramEditorConfig;

if (config === undefined) {
	throw new Error('Missing ontology diagram webview configuration.');
}

const webviewConfig = config;
const vscode = acquireVsCodeApi();
const canvasScroll = requiredElement('canvasScroll');
const canvasContent = requiredElement('canvasContent');
const status = requiredElement('status');
const addNoteButton = requiredElement('addNoteButton') as HTMLButtonElement;
const addLabelButton = requiredElement('addLabelButton') as HTMLButtonElement;
const addImageButton = requiredElement('addImageButton') as HTMLButtonElement;
const exportSvgButton = requiredElement('exportSvgButton') as HTMLButtonElement;
const exportPngButton = requiredElement('exportPngButton') as HTMLButtonElement;
const noteEditor = requiredElement('noteEditor') as HTMLFormElement;
const noteEditorText = requiredElement('noteEditorText') as HTMLTextAreaElement;
const saveNoteButton = requiredElement('saveNoteButton') as HTMLButtonElement;
const cancelNoteButton = requiredElement('cancelNoteButton') as HTMLButtonElement;
const propertyPanel = requiredElement('propertyPanel');
const propertyPanelTitle = requiredElement('propertyPanelTitle');
const propertyPanelToggle = requiredElement('propertyPanelToggle') as HTMLButtonElement;
const propertyPanelBody = requiredElement('propertyPanelBody');
const theme = readTheme();
const graph = new Graph(canvasContent);
const canvasEvents = new CanvasEventBus();
const elementRegistry = new CanvasElementRegistry(webviewConfig.payload);
const geometryPersistence = new CanvasGeometryPersistence({
	graph,
	postMessage: (message) => vscode.postMessage(message),
	showStatus,
	events: canvasEvents,
	diagramFilePath: webviewConfig.payload.file?.fsPath,
});
const noteEditorController = new NoteEditorController({
	addNoteButton,
	addLabelButton,
	noteEditor,
	noteEditorText,
	saveNoteButton,
	cancelNoteButton,
	getNoteText: (noteId) => geometryPersistence.getNoteText(noteId),
	getLabelText: (labelId) => geometryPersistence.getLabelText(labelId),
	createNote: (text) => {
		vscode.postMessage({
			type: 'createNote',
			text,
			position: insertionPosition(),
		});
	},
	createLabel: (text) => {
		vscode.postMessage({
			type: 'createLabel',
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
	updateLabelText: (labelId, text) => {
		geometryPersistence.setLabelText(labelId, text);
		vscode.postMessage({
			type: 'updateLabelText',
			id: labelId,
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
renderLabelToolbarIcon(addLabelButton);
renderImageToolbarIcon(addImageButton);
renderDiagramExportToolbarIcons(exportSvgButton, exportPngButton);
registerCanvasStateSubscriptions();
render();
registerSelectionEventPublishing();
registerViewportEventPublishing();
restoreSelection();
restoreViewport();
noteEditorController.register();
addImageButton.addEventListener('click', () => {
	vscode.postMessage({
		type: 'createImage',
		position: insertionPosition(),
	});
});
exportSvgButton.addEventListener('click', () => {
	const message = createSvgExportMessage(webviewConfig.payload, theme);
	if (message === undefined) {
		showStatus('There is no diagram content to export.');
		return;
	}

	vscode.postMessage(message);
});
exportPngButton.addEventListener('click', () => {
	void exportPng();
});
new CanvasDropController({
	scrollElement: canvasScroll,
	contentElement: canvasContent,
	modelTreeDragMimeType: webviewConfig.modelTreeDragMimeType,
	postMessage: (message) => vscode.postMessage(message),
	showStatus,
}).register();
geometryPersistence.register();
new CanvasPropertyPanel({
	graph,
	payload: webviewConfig.payload,
	registry: elementRegistry,
	events: canvasEvents,
	panel: propertyPanel,
	title: propertyPanelTitle,
	toggleButton: propertyPanelToggle,
	body: propertyPanelBody,
	postMessage: (message) => vscode.postMessage(message),
	showStatus,
	focusAfterEscape: () => {
		canvasScroll.focus();
	},
	initialCollapsed: vscode.getState()?.propertyPanelCollapsed,
}).register();
registerNoteEditHandlers();
registerDeleteHandlers();

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
	if (webviewConfig.payload.error !== undefined) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement('error-state', webviewConfig.payload.error));
		canvasEvents.publish({
			type: 'canvasRendered',
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			renderedElementIdentifiers: [],
			warnings: [webviewConfig.payload.error],
		});
		return;
	}

	const nodes = webviewConfig.payload.diagram?.nodes ?? [];
	const edges = webviewConfig.payload.diagram?.edges ?? [];
	const notes = webviewConfig.payload.diagram?.notes ?? [];
	const images = webviewConfig.payload.diagram?.images ?? [];
	const labels = webviewConfig.payload.diagram?.labels ?? [];
	if (nodes.length === 0 && edges.length === 0 && notes.length === 0 && images.length === 0 && labels.length === 0) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement(
			'empty-state',
			'Drag a class, individual, or datatype from the model tree, or add a note, label, or image from the canvas toolbar.',
		));
		canvasEvents.publish({
			type: 'canvasRendered',
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			renderedElementIdentifiers: [],
			warnings: [],
		});
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
		for (const edge of edges) {
			insertEdge(graph, edge, theme);
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
		for (const label of labels) {
			geometryPersistence.trackLabel(labelBounds(label), label.text);
			const vertex = labelVertex(label, theme);
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
	canvasEvents.publish({
		type: 'canvasRendered',
		diagramFilePath: webviewConfig.payload.file?.fsPath,
		renderedElementIdentifiers: elementRegistry.renderedElementIdentifiers(),
		warnings: [],
	});
}

function registerCanvasStateSubscriptions(): void {
	canvasEvents.subscribe((event) => {
		if (event.type === 'canvasSelectionChanged') {
			updateWebviewState({ selectedCellId: event.selectedElementIdentifier });
		}
		if (event.type === 'canvasPropertyPanelVisibilityChanged') {
			updateWebviewState({ propertyPanelCollapsed: event.collapsed });
		}
		if (event.type === 'canvasViewportChanged') {
			updateWebviewState({
				viewportPanX: event.panX,
				viewportPanY: event.panY,
			});
		}
	});
}

function registerSelectionEventPublishing(): void {
	graph.getSelectionModel().addListener(InternalEvent.CHANGE, () => {
		const selectedCell = graph.getSelectionCell();
		const selectedCellId = isGraphCell(selectedCell) ? selectedCell.getId() ?? undefined : undefined;
		canvasEvents.publish({
			type: 'canvasSelectionChanged',
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			selectedElementIdentifier: selectedCellId,
			selectedElementType: selectedCellId === undefined ? undefined : elementRegistry.elementType(selectedCellId),
		});
	});
}

function registerViewportEventPublishing(): void {
	canvasScroll.addEventListener('scroll', () => {
		publishViewportChanged('scroll');
	});
}

function restoreSelection(): void {
	const selectedCellId = vscode.getState()?.selectedCellId;
	if (selectedCellId === undefined) {
		return;
	}

	const selectedCell = graph.getDataModel().getCell(selectedCellId);
	if (selectedCell !== null) {
		graph.setSelectionCell(selectedCell);
	}
}

function restoreViewport(): void {
	const state = vscode.getState();
	const viewportPanX = state?.viewportPanX;
	const viewportPanY = state?.viewportPanY;
	if (viewportPanX === undefined && viewportPanY === undefined) {
		return;
	}

	requestAnimationFrame(() => {
		canvasScroll.scrollTo({
			left: viewportPanX ?? canvasScroll.scrollLeft,
			top: viewportPanY ?? canvasScroll.scrollTop,
		});
		publishViewportChanged('restore');
	});
}

function publishViewportChanged(changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom'): void {
	canvasEvents.publish({
		type: 'canvasViewportChanged',
		diagramFilePath: webviewConfig.payload.file?.fsPath,
		panX: canvasScroll.scrollLeft,
		panY: canvasScroll.scrollTop,
		zoom: graph.getView().getScale(),
		changeSource,
	});
}

async function exportPng(): Promise<void> {
	try {
		const message = await createPngExportMessage(webviewConfig.payload, theme);
		if (message === undefined) {
			showStatus('There is no diagram content to export.');
			return;
		}

		vscode.postMessage(message);
	} catch (error) {
		showStatus(error instanceof Error ? error.message : String(error));
	}
}

function updateWebviewState(update: Partial<WebviewState>): void {
	vscode.setState({
		...vscode.getState(),
		...update,
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
		if (editLabelCell(graph.getSelectionCell())) {
			event.preventDefault();
		}
	});
	graph.addListener(InternalEvent.DOUBLE_CLICK, (_sender: unknown, event: EventObject) => {
		if (editNoteCell(event.getProperty('cell'))) {
			event.consume();
		}
		if (editLabelCell(event.getProperty('cell'))) {
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

	noteEditorController.open('note', id);

	return true;
}

function editLabelCell(cell: unknown): boolean {
	if (!isGraphCell(cell)) {
		return false;
	}

	const id = cell.getId();
	if (id === null || !geometryPersistence.hasLabel(id)) {
		return false;
	}

	noteEditorController.open('label', id);

	return true;
}

function registerDeleteHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen()) {
			return;
		}
		if (event.key !== 'Delete' && event.key !== 'Backspace') {
			return;
		}
		if (isKeyboardInputTarget(event.target)) {
			return;
		}

		if (deleteSelectedCell(graph.getSelectionCell())) {
			event.preventDefault();
		}
	});
}

function isKeyboardInputTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLButtonElement
		|| target instanceof HTMLTextAreaElement
		|| target instanceof HTMLInputElement
		|| target instanceof HTMLSelectElement
		|| (target instanceof HTMLElement && target.isContentEditable);
}

function deleteSelectedCell(cell: unknown): boolean {
	if (!isGraphCell(cell)) {
		return false;
	}

	const id = cell.getId();
	if (id === null) {
		return false;
	}

	if (elementRegistry.element(id)?.kind === 'node') {
		vscode.postMessage({
			type: 'deleteNode',
			id,
		});

		return true;
	}

	if (geometryPersistence.hasNote(id)) {
		vscode.postMessage({
			type: 'deleteNote',
			id,
		});

		return true;
	}

	if (geometryPersistence.hasImage(id)) {
		vscode.postMessage({
			type: 'deleteImage',
			id,
		});

		return true;
	}

	if (geometryPersistence.hasLabel(id)) {
		vscode.postMessage({
			type: 'deleteLabel',
			id,
		});

		return true;
	}

	return false;
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
