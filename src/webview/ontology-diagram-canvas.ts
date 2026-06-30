import { Graph, HandleConfig, InternalEvent, Rectangle, StyleDefaultsConfig, VertexHandlerConfig, type Cell, type EventObject, type SelectionHandler } from '@maxgraph/core';

import { minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../shared/canvas-geometry';
import { nodeBounds, nodeVertex } from './ontology-diagram-nodes';
import { NoteEditorController, noteBounds, noteVertex, renderNoteToolbarIcon } from './ontology-diagram-notes';
import type { CanvasPoint, DiagramPayload } from './ontology-diagram-types';
import { readTheme } from './webview-theme';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewMessage): void;
};

declare global {
	interface Window {
		ontologyDiagramEditorConfig?: WebviewConfig;
	}
}

type WebviewMessage = CreateNodeMessage | CreateNoteMessage | UpdateNodeBoundsMessage | UpdateNoteBoundsMessage | UpdateNoteTextMessage;

interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDraggedEvent;
	readonly position: CanvasPoint;
}

interface UpdateNodeBoundsMessage {
	readonly type: 'updateNodeBounds';
	readonly updates: readonly NodeBoundsUpdate[];
}

interface CreateNoteMessage {
	readonly type: 'createNote';
	readonly text: string;
	readonly position: CanvasPoint;
}

interface UpdateNoteBoundsMessage {
	readonly type: 'updateNoteBounds';
	readonly updates: readonly NoteBoundsUpdate[];
}

interface UpdateNoteTextMessage {
	readonly type: 'updateNoteText';
	readonly id: string;
	readonly text: string;
}

interface ModelTreeItemDraggedEvent {
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
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
const nodeCapableTypes = new Set(['class', 'individual', 'datatype']);
const canvasScroll = requiredElement('canvasScroll');
const canvasContent = requiredElement('canvasContent');
const status = requiredElement('status');
const addNoteButton = requiredElement('addNoteButton') as HTMLButtonElement;
const noteEditor = requiredElement('noteEditor') as HTMLFormElement;
const noteEditorText = requiredElement('noteEditorText') as HTMLTextAreaElement;
const saveNoteButton = requiredElement('saveNoteButton') as HTMLButtonElement;
const cancelNoteButton = requiredElement('cancelNoteButton') as HTMLButtonElement;
const theme = readTheme();
const graph = new Graph(canvasContent);
const persistedNodeBounds = new Map<string, NodeBoundsUpdate>();
const persistedNoteBounds = new Map<string, NoteBoundsUpdate>();
const persistedNoteText = new Map<string, string>();
const noteEditorController = new NoteEditorController({
	addNoteButton,
	noteEditor,
	noteEditorText,
	saveNoteButton,
	cancelNoteButton,
	getNoteText: (noteId) => persistedNoteText.get(noteId),
	createNote: (text) => {
		vscode.postMessage({
			type: 'createNote',
			text,
			position: insertionPosition(),
		});
	},
	updateNoteText: (noteId, text) => {
		persistedNoteText.set(noteId, text);
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
let suppressGeometryPersistence = false;

configureGraph(graph);
renderNoteToolbarIcon(addNoteButton);
render();
noteEditorController.register();
registerDropHandlers();
registerGeometryHandlers();
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
	if (nodes.length === 0 && notes.length === 0) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement(
			'empty-state',
			'Drag a class, individual, or datatype from the model tree, or add a note from the canvas toolbar.',
		));
		return;
	}

	graph.batchUpdate(() => {
		for (const node of nodes) {
			persistedNodeBounds.set(node.id, nodeBounds(node));
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
			persistedNoteBounds.set(note.id, noteBounds(note));
			persistedNoteText.set(note.id, note.text);
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
	});
}

function registerGeometryHandlers(): void {
	graph.addListener(InternalEvent.CELLS_MOVED, (_sender: unknown, event: EventObject) => {
		persistChangedElementBounds(event.getProperty('cells'));
	});
	graph.addListener(InternalEvent.CELLS_RESIZED, (_sender: unknown, event: EventObject) => {
		persistChangedElementBounds(event.getProperty('cells'));
	});
}

function persistChangedElementBounds(cells: unknown): void {
	if (suppressGeometryPersistence || !Array.isArray(cells)) {
		return;
	}

	const nodeUpdates: NodeBoundsUpdate[] = [];
	const noteUpdates: NoteBoundsUpdate[] = [];
	for (const cell of cells) {
		const nodeUpdate = boundsUpdate(cell, persistedNodeBounds);
		if (nodeUpdate !== undefined) {
			nodeUpdates.push(nodeUpdate);
			continue;
		}

		const noteUpdate = boundsUpdate(cell, persistedNoteBounds);
		if (noteUpdate !== undefined) {
			noteUpdates.push(noteUpdate);
		}
	}

	const invalidNodeUpdate = nodeUpdates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
	if (invalidNodeUpdate !== undefined) {
		restorePersistedBounds(nodeUpdates, persistedNodeBounds);
		showStatus(`Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.`);
		return;
	}
	const invalidNoteUpdate = noteUpdates.find((update) => update.width < minimumNoteWidth || update.height < minimumNoteHeight);
	if (invalidNoteUpdate !== undefined) {
		restorePersistedBounds(noteUpdates, persistedNoteBounds);
		showStatus(`Notes must be at least ${minimumNoteWidth} x ${minimumNoteHeight}.`);
		return;
	}

	for (const update of nodeUpdates) {
		persistedNodeBounds.set(update.id, update);
	}
	for (const update of noteUpdates) {
		persistedNoteBounds.set(update.id, update);
	}
	if (nodeUpdates.length > 0) {
		vscode.postMessage({
			type: 'updateNodeBounds',
			updates: nodeUpdates,
		});
	}
	if (noteUpdates.length > 0) {
		vscode.postMessage({
			type: 'updateNoteBounds',
			updates: noteUpdates,
		});
	}
}

function boundsUpdate(cell: unknown, persistedBoundsById: ReadonlyMap<string, BoundsUpdate>): BoundsUpdate | undefined {
	if (!isGraphCell(cell)) {
		return undefined;
	}

	const id = cell.getId();
	const geometry = cell.getGeometry();
	if (id === null || geometry === null || !persistedBoundsById.has(id)) {
		return undefined;
	}

	return {
		id,
		x: Math.max(0, Math.round(geometry.x)),
		y: Math.max(0, Math.round(geometry.y)),
		width: Math.round(geometry.width),
		height: Math.round(geometry.height),
	};
}

function restorePersistedBounds(updates: readonly BoundsUpdate[], persistedBoundsById: ReadonlyMap<string, BoundsUpdate>): void {
	suppressGeometryPersistence = true;
	try {
		for (const update of updates) {
			const persistedBounds = persistedBoundsById.get(update.id);
			const cell = graph.getDataModel().getCell(update.id);
			if (persistedBounds !== undefined && cell !== null) {
				graph.resizeCell(
					cell,
					new Rectangle(
						persistedBounds.x,
						persistedBounds.y,
						persistedBounds.width,
						persistedBounds.height,
					),
				);
			}
		}
	} finally {
		suppressGeometryPersistence = false;
	}
}

function isGraphCell(value: unknown): value is Cell {
	return typeof value === 'object'
		&& value !== null
		&& 'getId' in value
		&& 'getGeometry' in value;
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
	if (id === null || !persistedNoteBounds.has(id)) {
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

function registerDropHandlers(): void {
	canvasScroll.addEventListener('dragover', (event) => {
		event.preventDefault();
		if (event.dataTransfer !== null) {
			event.dataTransfer.dropEffect = 'copy';
		}
		canvasScroll.classList.add('drop-active');
		canvasScroll.classList.remove('drop-rejected');
	});

	canvasScroll.addEventListener('dragleave', (event) => {
		if (event.relatedTarget instanceof Node && canvasScroll.contains(event.relatedTarget)) {
			return;
		}

		canvasScroll.classList.remove('drop-active', 'drop-rejected');
	});

	canvasScroll.addEventListener('drop', (event) => {
		event.preventDefault();
		canvasScroll.classList.remove('drop-active', 'drop-rejected');

		const dragPayload = readDragPayload(event.dataTransfer);
		if (dragPayload !== undefined && !nodeCapableTypes.has(dragPayload.ontologyItemType)) {
			canvasScroll.classList.add('drop-rejected');
			showStatus('Only classes, individuals, and datatypes can create nodes for now.');
			return;
		}

		const rect = canvasContent.getBoundingClientRect();
		vscode.postMessage({
			type: 'createNode',
			payload: dragPayload,
			position: {
				x: Math.max(0, event.clientX - rect.left),
				y: Math.max(0, event.clientY - rect.top),
			},
		});
	});
}

function readDragPayload(dataTransfer: DataTransfer | null): ModelTreeItemDraggedEvent | undefined {
	if (dataTransfer === null) {
		return undefined;
	}

	const raw = dataTransfer.getData(config?.modelTreeDragMimeType ?? '')
		|| dataTransfer.getData('application/vnd.code.tree.ontology-diagram-editor.model-tree')
		|| dataTransfer.getData('text/plain');
	if (raw.length === 0) {
		return undefined;
	}

	try {
		return JSON.parse(raw) as ModelTreeItemDraggedEvent;
	} catch {
		return undefined;
	}
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
