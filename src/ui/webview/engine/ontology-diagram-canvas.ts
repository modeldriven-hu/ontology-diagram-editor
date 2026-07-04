import { LayoutTemplate, Link2, LocateFixed, Maximize2, Minimize2, Moon, Redo2, RotateCcw, Route, Sun, Trash2, Undo2, ZoomIn, ZoomOut, createElement as createIconElement } from 'lucide';

import { CanvasRedoRequestedEvent, CanvasRenderedEvent, CanvasSelectionChangedEvent, CanvasUndoRequestedEvent, CanvasViewportChangedEvent } from '../../../shared/canvas-editor-events';
import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type CanvasPoint } from '../../../shared/canvas-geometry';
import { ArrangeDiagramCommand, CreateImageCommand, CreateLabelCommand, CreateNoteCommand, CreateNoteConnectionCommand, DeleteEdgeCommand, DeleteImageCommand, DeleteLabelCommand, DeleteNodeCommand, DeleteNoteCommand, OptimizeEdgeRouteCommand, RedoDiagramCommand, RevealModelTreeItemCommand, UndoDiagramCommand, UpdateLabelTextCommand, UpdateNoteTextCommand, UpdateThemeModeCommand, type WebviewCommand } from '../../../shared/webview-commands';
import { CanvasDropController } from '../components/canvas-drop-controller';
import { CanvasElementRegistry, type CanvasPropertyElement } from '../components/canvas-element-registry';
import { CanvasMessageBus } from './canvas-message-bus';
import { createPngExportCommand, createSvgExportCommand, renderDiagramExportToolbarIcons } from '../components/canvas-export';
import { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { CanvasPropertyPanel } from '../components/canvas-property-panel';
import { measuredTextWidth, nodeDataPropertyAttributes, ontologyDisplayName, requiredNodeHeightForDataProperties, requiredNodeWidthForDataProperties } from '../components/node-data-properties';
import { renderImageToolbarIcon } from '../components/ontology-diagram-images';
import { renderLabelToolbarIcon } from '../components/ontology-diagram-labels';
import { NoteEditorController, renderNoteToolbarIcon } from '../components/ontology-diagram-notes';
import type { DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { detectPreferredThemeMode, readTheme, type WebviewTheme, type WebviewThemeMode } from '../webview-theme';
import { X6DiagramCanvasEngine } from './x6-diagram-canvas-engine';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewCommand): void;
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
	readonly selectedElementId?: string;
	readonly propertyPanelCollapsed?: boolean;
	readonly propertyPanelWidth?: number;
	readonly viewportPanX?: number;
	readonly viewportPanY?: number;
	readonly viewportZoom?: number;
	readonly themeMode?: WebviewThemeMode;
}

const config = window.ontologyDiagramEditorConfig;
const minimumZoom = 0.25;
const maximumZoom = 3;
const defaultCanvasWidth = 1800;
const defaultCanvasHeight = 1200;
const viewportPadding = 80;
const noteContentHorizontalPadding = 24;
const noteContentVerticalPadding = 24;
const noteCompactMaximumWidth = 320;
const noteLineHeightFactor = 1.25;

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
const undoDiagramButton = requiredElement('undoDiagramButton') as HTMLButtonElement;
const redoDiagramButton = requiredElement('redoDiagramButton') as HTMLButtonElement;
const exportSvgButton = requiredElement('exportSvgButton') as HTMLButtonElement;
const exportPngButton = requiredElement('exportPngButton') as HTMLButtonElement;
const arrangeDiagramButton = requiredElement('arrangeDiagramButton') as HTMLButtonElement;
const zoomOutButton = requiredElement('zoomOutButton') as HTMLButtonElement;
const zoomInButton = requiredElement('zoomInButton') as HTMLButtonElement;
const fitDiagramButton = requiredElement('fitDiagramButton') as HTMLButtonElement;
const resetViewportButton = requiredElement('resetViewportButton') as HTMLButtonElement;
const revealModelTreeItemButton = requiredElement('revealModelTreeItemButton') as HTMLButtonElement;
const themeModeButton = requiredElement('themeModeButton') as HTMLButtonElement;
const noteEditor = requiredElement('noteEditor') as HTMLFormElement;
const noteEditorText = requiredElement('noteEditorText') as HTMLTextAreaElement;
const saveNoteButton = requiredElement('saveNoteButton') as HTMLButtonElement;
const cancelNoteButton = requiredElement('cancelNoteButton') as HTMLButtonElement;
const localElementToolbar = requiredElement('localElementToolbar');
const minimizeLocalButton = requiredElement('minimizeLocalButton') as HTMLButtonElement;
const connectNoteLocalButton = requiredElement('connectNoteLocalButton') as HTMLButtonElement;
const optimizeEdgeLocalButton = requiredElement('optimizeEdgeLocalButton') as HTMLButtonElement;
const deleteEdgeLocalButton = requiredElement('deleteEdgeLocalButton') as HTMLButtonElement;
const propertyPanel = requiredElement('propertyPanel');
const propertyPanelResizeHandle = requiredElement('propertyPanelResizeHandle');
const propertyPanelTitle = requiredElement('propertyPanelTitle');
const propertyPanelToggle = requiredElement('propertyPanelToggle') as HTMLButtonElement;
const propertyPanelBody = requiredElement('propertyPanelBody');
let themeMode: WebviewThemeMode = webviewConfig.payload.diagram?.metadata?.theme_mode ?? vscode.getState()?.themeMode ?? detectPreferredThemeMode();
let theme = readTheme(themeMode);
let pendingNoteConnectionSourceId: string | undefined;
const messageBus = new CanvasMessageBus();
const elementRegistry = new CanvasElementRegistry(webviewConfig.payload);
const canvas = new X6DiagramCanvasEngine(canvasContent, elementRegistry, theme);
const geometryPersistence = new CanvasGeometryPersistence({
	canvas,
	messageBus,
	showStatus,
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
		messageBus.publishCommand(new CreateNoteCommand(text, insertionPosition()));
	},
	createLabel: (text) => {
		messageBus.publishCommand(new CreateLabelCommand(text, insertionPosition()));
	},
	updateNoteText: (noteId, text) => {
		geometryPersistence.setNoteText(noteId, text);
		elementRegistry.updateContent({ kind: 'noteText', id: noteId, text });
		canvas.updateElementContent({ kind: 'noteText', id: noteId, text });
		messageBus.publishCommand(new UpdateNoteTextCommand(noteId, text));
	},
	updateLabelText: (labelId, text) => {
		geometryPersistence.setLabelText(labelId, text);
		elementRegistry.updateContent({ kind: 'labelText', id: labelId, text });
		canvas.updateElementContent({ kind: 'labelText', id: labelId, text });
		messageBus.publishCommand(new UpdateLabelTextCommand(labelId, text));
	},
	showStatus,
	focusAfterClose: () => {
		canvasScroll.focus();
	},
});

renderNoteToolbarIcon(addNoteButton);
renderLabelToolbarIcon(addLabelButton);
renderImageToolbarIcon(addImageButton);
renderLocalElementToolbarIcons();
renderUndoRedoToolbarIcons();
renderDiagramExportToolbarIcons(exportSvgButton, exportPngButton);
renderArrangeDiagramToolbarIcon();
renderViewportToolbarIcons();
updateToolbarActionStates();
applyCanvasTheme(theme);
registerExtensionMessageForwarding();
registerCanvasStateSubscriptions();
render();
registerSelectionEventPublishing();
registerViewportEventPublishing();
registerPropertyPanel();
restoreSelection();
restoreViewport();
noteEditorController.register();
minimizeLocalButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	resizeSelectedElementToMinimum();
});
connectNoteLocalButton.addEventListener('click', () => {
	toggleNoteConnectionMode();
});
optimizeEdgeLocalButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	optimizeSelectedEdgeRoute();
});
deleteEdgeLocalButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	deleteSelectedEdge();
});
addImageButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateImageCommand(insertionPosition()));
});
undoDiagramButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	requestDiagramUndo();
});
redoDiagramButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	requestDiagramRedo();
});
exportSvgButton.addEventListener('click', () => {
	const command = createSvgExportCommand(webviewConfig.payload, theme);
	if (command === undefined) {
		showStatus('There is no diagram content to export.');
		return;
	}

	messageBus.publishCommand(command);
});
exportPngButton.addEventListener('click', () => {
	void exportPng();
});
arrangeDiagramButton.addEventListener('click', () => {
	cancelPendingNoteConnection();
	if ((webviewConfig.payload.diagram?.nodes?.length ?? 0) === 0) {
		showStatus('There are no ontology nodes to arrange.');
		return;
	}

	showStatus('Arranging diagram.');
	messageBus.publishCommand(new ArrangeDiagramCommand());
});
zoomOutButton.addEventListener('click', () => {
	zoomBy(1 / 1.2, 'zoom');
});
zoomInButton.addEventListener('click', () => {
	zoomBy(1.2, 'zoom');
});
fitDiagramButton.addEventListener('click', () => {
	fitDiagramToView();
});
resetViewportButton.addEventListener('click', () => {
	resetViewport();
});
revealModelTreeItemButton.addEventListener('click', () => {
	revealSelectedModelTreeItem();
});
themeModeButton.addEventListener('click', () => {
	toggleThemeMode();
});
new CanvasDropController({
	scrollElement: canvasScroll,
	contentElement: canvasContent,
	payload: webviewConfig.payload,
	modelTreeDragMimeType: webviewConfig.modelTreeDragMimeType,
	messageBus,
	showStatus,
}).register();
geometryPersistence.register();
registerNoteEditHandlers();
registerUndoRedoHandlers();
registerKeyboardNudgeHandlers();
registerDeleteHandlers();

function registerPropertyPanel(): void {
	new CanvasPropertyPanel({
		canvas,
		payload: webviewConfig.payload,
		registry: elementRegistry,
		messageBus,
		panel: propertyPanel,
		resizeHandle: propertyPanelResizeHandle,
		title: propertyPanelTitle,
		toggleButton: propertyPanelToggle,
		body: propertyPanelBody,
		getTheme: () => theme,
		showStatus,
		resetEdgeLabel: (edgeId) => {
			canvas.resetEdgeLabel(edgeId);
		},
		focusAfterEscape: () => {
			canvasScroll.focus();
		},
		initialCollapsed: vscode.getState()?.propertyPanelCollapsed,
		initialWidth: vscode.getState()?.propertyPanelWidth,
		onWidthChange: (width) => {
			updateWebviewState({ propertyPanelWidth: width });
		},
	}).register();
}

function registerExtensionMessageForwarding(): void {
	messageBus.subscribe((message) => {
		if (message.kind === 'command') {
			vscode.postMessage(message.payload);
		}
	});
}

function render(): void {
	if (webviewConfig.payload.error !== undefined) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement('error-state', webviewConfig.payload.error));
		messageBus.publishEvent(new CanvasRenderedEvent({
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			renderedElementIdentifiers: [],
			warnings: [webviewConfig.payload.error],
		}));
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
		messageBus.publishEvent(new CanvasRenderedEvent({
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			renderedElementIdentifiers: [],
			warnings: [],
		}));
		return;
	}

	trackRenderedGeometry(webviewConfig.payload);
	canvas.renderDiagram(webviewConfig.payload, theme);
	resizeCanvasForZoom();
	updateLocalElementToolbar();
	messageBus.publishEvent(new CanvasRenderedEvent({
		diagramFilePath: webviewConfig.payload.file?.fsPath,
		renderedElementIdentifiers: elementRegistry.renderedElementIdentifiers(),
		warnings: [],
	}));
}

function registerCanvasStateSubscriptions(): void {
	messageBus.subscribe((message) => {
		if (message.kind !== 'event') {
			return;
		}

		const event = message.payload;
		if (event.type === 'canvasSelectionChanged') {
			updateWebviewState({ selectedElementId: event.selectedElementIdentifier });
		}
		if (event.type === 'canvasPropertyPanelVisibilityChanged') {
			updateWebviewState({ propertyPanelCollapsed: event.collapsed });
		}
		if (event.type === 'canvasViewportChanged') {
			updateWebviewState({
				viewportPanX: event.panX,
				viewportPanY: event.panY,
				viewportZoom: event.zoom,
			});
		}
	});
}

function registerSelectionEventPublishing(): void {
	canvas.onSelectionChanged(() => {
		const selectedElementId = canvas.selectedElementId();
		handlePendingNoteConnectionSelection(selectedElementId);
		updateLocalElementToolbar();
		console.log('[ontology-diagram-editor] publish canvas selection', {
			selectedElementId,
			selectedElementType: selectedElementId === undefined ? undefined : elementRegistry.elementType(selectedElementId),
		});
		messageBus.publishEvent(new CanvasSelectionChangedEvent({
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			selectedElementIdentifier: selectedElementId,
			selectedElementType: selectedElementId === undefined ? undefined : elementRegistry.elementType(selectedElementId),
		}));
	});
}

function renderLocalElementToolbarIcons(): void {
	minimizeLocalButton.replaceChildren(createIconElement(Minimize2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	minimizeLocalButton.title = 'Resize to minimum size';
	minimizeLocalButton.setAttribute('aria-label', 'Resize to minimum size');

	const badge = document.createElement('span');
	badge.className = 'local-action-note-badge';
	badge.textContent = 'N';
	connectNoteLocalButton.replaceChildren(createIconElement(Link2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}), badge);
	connectNoteLocalButton.title = 'Connect note';
	connectNoteLocalButton.setAttribute('aria-label', 'Connect note');
	connectNoteLocalButton.setAttribute('aria-pressed', 'false');

	optimizeEdgeLocalButton.replaceChildren(createIconElement(Route, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	optimizeEdgeLocalButton.title = 'Optimize edge path';
	optimizeEdgeLocalButton.setAttribute('aria-label', 'Optimize edge path');

	deleteEdgeLocalButton.replaceChildren(createIconElement(Trash2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	deleteEdgeLocalButton.title = 'Remove edge';
	deleteEdgeLocalButton.setAttribute('aria-label', 'Remove edge');
}

function registerViewportEventPublishing(): void {
	canvasScroll.addEventListener('scroll', () => {
		updateLocalElementToolbar();
		publishViewportChanged('scroll');
	});
	canvasScroll.addEventListener('wheel', (event) => {
		if (!event.ctrlKey && !event.metaKey || isKeyboardInputTarget(event.target)) {
			return;
		}

		event.preventDefault();
		zoomBy(Math.exp(-event.deltaY * 0.002), 'zoom', {
			x: event.clientX,
			y: event.clientY,
		});
	}, { passive: false });
}

function renderViewportToolbarIcons(): void {
	zoomOutButton.replaceChildren(createIconElement(ZoomOut, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	zoomInButton.replaceChildren(createIconElement(ZoomIn, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	fitDiagramButton.replaceChildren(createIconElement(Maximize2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	resetViewportButton.replaceChildren(createIconElement(RotateCcw, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	revealModelTreeItemButton.replaceChildren(createIconElement(LocateFixed, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	renderThemeModeButton();
}

function renderUndoRedoToolbarIcons(): void {
	undoDiagramButton.replaceChildren(createIconElement(Undo2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	undoDiagramButton.title = 'Undo diagram edit';
	undoDiagramButton.setAttribute('aria-label', 'Undo diagram edit');

	redoDiagramButton.replaceChildren(createIconElement(Redo2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	redoDiagramButton.title = 'Redo diagram edit';
	redoDiagramButton.setAttribute('aria-label', 'Redo diagram edit');
}

function renderArrangeDiagramToolbarIcon(): void {
	arrangeDiagramButton.replaceChildren(createIconElement(LayoutTemplate, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	arrangeDiagramButton.title = 'Arrange diagram';
	arrangeDiagramButton.setAttribute('aria-label', 'Arrange diagram');
}

function updateToolbarActionStates(): void {
	arrangeDiagramButton.disabled = (webviewConfig.payload.diagram?.nodes?.length ?? 0) === 0;
}

function toggleNoteConnectionMode(): void {
	if (pendingNoteConnectionSourceId !== undefined) {
		cancelPendingNoteConnection();
		showStatus('Note connection cancelled.');
		return;
	}

	const selectedElementId = canvas.selectedElementId();
	const selectedElement = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId);
	if (selectedElementId === undefined || selectedElement?.kind !== 'note') {
		showStatus('Select a note before creating a note connection.');
		return;
	}

	pendingNoteConnectionSourceId = selectedElementId;
	connectNoteLocalButton.setAttribute('aria-pressed', 'true');
	showStatus('Select another note, node, or image to create the note connection.');
	canvasScroll.focus();
}

function cancelPendingNoteConnection(): void {
	pendingNoteConnectionSourceId = undefined;
	connectNoteLocalButton.setAttribute('aria-pressed', 'false');
}

function handlePendingNoteConnectionSelection(targetId: string | undefined): void {
	const sourceId = pendingNoteConnectionSourceId;
	if (sourceId === undefined || targetId === undefined || targetId === sourceId) {
		return;
	}

	const source = elementRegistry.element(sourceId);
	const target = elementRegistry.element(targetId);
	if (source === undefined || target === undefined || !isNoteConnectionEndpointKind(source.kind) || !isNoteConnectionEndpointKind(target.kind)) {
		showStatus('Select a note, node, or image to complete the note connection.');
		return;
	}

	if (source.kind !== 'note' && target.kind !== 'note') {
		showStatus('A note connection needs at least one note endpoint.');
		return;
	}

	const noteId = source.kind === 'note' ? sourceId : targetId;
	const targetElementId = source.kind === 'note' ? targetId : sourceId;
	cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateNoteConnectionCommand(noteId, targetElementId));
	showStatus('Creating note connection.');
}

function isNoteConnectionEndpointKind(kind: string): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image';
}

function updateLocalElementToolbar(): void {
	const selectedElementId = canvas.selectedElementId();
	const selectedElement = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId);
	if (selectedElement === undefined || !hasLocalElementToolbarActions(selectedElement) || noteEditorController.isOpen()) {
		localElementToolbar.hidden = true;
		return;
	}

	updateLocalElementToolbarButtons(selectedElement);
	const toolbarAnchor = localElementToolbarAnchor(selectedElement);
	if (toolbarAnchor === undefined) {
		localElementToolbar.hidden = true;
		return;
	}

	const zoom = canvas.zoom();
	const toolbarWidth = localElementToolbar.getBoundingClientRect().width || localElementToolbarFallbackWidth(selectedElement);
	const x = toolbarAnchor.x * zoom - canvasScroll.scrollLeft;
	const y = toolbarAnchor.y * zoom - canvasScroll.scrollTop;
	const left = Math.round(Math.min(Math.max(x, toolbarWidth / 2 + 8), Math.max(toolbarWidth / 2 + 8, canvasScroll.clientWidth - toolbarWidth / 2 - 8)));
	const belowY = toolbarAnchor.belowY * zoom - canvasScroll.scrollTop;
	const top = Math.round(y >= 48 ? y - 42 : belowY + 8);
	localElementToolbar.style.left = `${left}px`;
	localElementToolbar.style.top = `${Math.max(8, top)}px`;
	localElementToolbar.hidden = false;
	connectNoteLocalButton.setAttribute('aria-pressed', String(pendingNoteConnectionSourceId === selectedElementId));
}

function hasLocalElementToolbarActions(element: CanvasPropertyElement): boolean {
	return element.kind === 'node' || element.kind === 'note' || element.kind === 'image' || element.kind === 'label' || element.kind === 'edge';
}

function updateLocalElementToolbarButtons(element: CanvasPropertyElement): void {
	const canResize = element.kind === 'node' || element.kind === 'note' || element.kind === 'image' || element.kind === 'label';
	minimizeLocalButton.hidden = !canResize;
	connectNoteLocalButton.hidden = element.kind !== 'note';
	optimizeEdgeLocalButton.hidden = element.kind !== 'edge';
	deleteEdgeLocalButton.hidden = element.kind !== 'edge';

	if (element.kind === 'note') {
		minimizeLocalButton.title = 'Resize note to compact size';
		minimizeLocalButton.setAttribute('aria-label', 'Resize note to compact size');
	} else if (element.kind === 'image') {
		minimizeLocalButton.title = 'Resize image to minimum size';
		minimizeLocalButton.setAttribute('aria-label', 'Resize image to minimum size');
	} else if (element.kind === 'label') {
		minimizeLocalButton.title = 'Resize label to minimum size';
		minimizeLocalButton.setAttribute('aria-label', 'Resize label to minimum size');
	} else {
		minimizeLocalButton.title = 'Resize to minimum size';
		minimizeLocalButton.setAttribute('aria-label', 'Resize to minimum size');
	}
}

interface LocalElementToolbarAnchor {
	readonly x: number;
	readonly y: number;
	readonly belowY: number;
}

function localElementToolbarAnchor(element: CanvasPropertyElement): LocalElementToolbarAnchor | undefined {
	if (element.kind === 'node' || element.kind === 'note' || element.kind === 'image' || element.kind === 'label') {
		return {
			x: element.value.x + element.value.width / 2,
			y: element.value.y,
			belowY: element.value.y + element.value.height,
		};
	}

	if (element.kind === 'edge') {
		const point = edgeToolbarPoint(element.value);
		if (point === undefined) {
			return undefined;
		}

		return {
			x: point.x,
			y: point.y,
			belowY: point.y,
		};
	}

	return undefined;
}

function edgeToolbarPoint(edge: NonNullable<NonNullable<DiagramPayload['diagram']>['edges']>[number]): CanvasPoint | undefined {
	const points = edgeRoutePoints(edge);
	if (points.length === 0) {
		return undefined;
	}
	if (points.length === 1) {
		return points[0];
	}

	const totalLength = points.slice(1).reduce((sum, point, index) => sum + pointDistance(points[index], point), 0);
	if (totalLength <= 0) {
		return {
			x: (points[0].x + points[points.length - 1].x) / 2,
			y: (points[0].y + points[points.length - 1].y) / 2,
		};
	}

	let traversedLength = 0;
	const targetLength = totalLength / 2;
	for (let index = 1; index < points.length; index += 1) {
		const start = points[index - 1];
		const end = points[index];
		const segmentLength = pointDistance(start, end);
		if (traversedLength + segmentLength >= targetLength) {
			const ratio = segmentLength === 0 ? 0 : (targetLength - traversedLength) / segmentLength;
			return {
				x: start.x + ((end.x - start.x) * ratio),
				y: start.y + ((end.y - start.y) * ratio),
			};
		}

		traversedLength += segmentLength;
	}

	return points[points.length - 1];
}

function pointDistance(left: CanvasPoint, right: CanvasPoint): number {
	return Math.hypot(right.x - left.x, right.y - left.y);
}

function localElementToolbarFallbackWidth(element: CanvasPropertyElement): number {
	if (element.kind === 'note' || element.kind === 'edge') {
		return 67;
	}

	return 36;
}

function deleteSelectedEdge(): void {
	const selectedElementId = canvas.selectedElementId();
	const selectedElement = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId);
	if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
		showStatus('Select an edge to remove.');
		return;
	}

	if (deleteElement(selectedElementId)) {
		localElementToolbar.hidden = true;
		showStatus('Removing edge.');
	}
}

function optimizeSelectedEdgeRoute(): void {
	const selectedElementId = canvas.selectedElementId();
	const selectedElement = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId);
	if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
		showStatus('Select an edge to optimize.');
		return;
	}

	messageBus.publishCommand(new OptimizeEdgeRouteCommand(selectedElementId));
	showStatus('Optimizing edge path.');
}

function resizeSelectedElementToMinimum(): void {
	const selectedElementId = canvas.selectedElementId();
	const selectedElement = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId);
	const minimumSize = minimumSizeForElement(selectedElement);
	if (selectedElementId === undefined || minimumSize === undefined) {
		showStatus('Select a node, note, image, or label to resize.');
		return;
	}

	if (canvas.resizeElement(selectedElementId, minimumSize.width, minimumSize.height)) {
		showStatus('Resized selected element to minimum size.');
		return;
	}

	showStatus('Selected element is already at its minimum size.');
}

function minimumSizeForElement(element: ReturnType<CanvasElementRegistry['element']>): { readonly width: number; readonly height: number } | undefined {
	if (element?.kind === 'node') {
		const attributes = nodeDataPropertyAttributes(element.value, webviewConfig.payload);
		if (attributes.length === 0) {
			return { width: minimumNodeWidth, height: minimumNodeHeight };
		}

		const fontSize = element.value.style?.font?.size ?? theme.fontSize;
		return {
			width: requiredNodeWidthForDataProperties({
				title: ontologyDisplayName(element.value.ontology_ref),
				attributes,
				fontSize,
				fontFamily: element.value.style?.font?.family ?? theme.fontFamily,
				titleBold: element.value.style?.font?.bold,
				attributeItalic: element.value.style?.font?.italic,
				minimumWidth: minimumNodeWidth,
			}),
			height: requiredNodeHeightForDataProperties({
				attributeCount: attributes.length,
				fontSize,
				minimumHeight: minimumNodeHeight,
			}),
		};
	}
	if (element?.kind === 'note') {
		return requiredNoteSize(element.value);
	}
	if (element?.kind === 'image') {
		return { width: minimumImageWidth, height: minimumImageHeight };
	}
	if (element?.kind === 'label') {
		return { width: minimumLabelWidth, height: minimumLabelHeight };
	}

	return undefined;
}

function requiredNoteSize(note: DiagramNote): { readonly width: number; readonly height: number } {
	const fontSize = note.style?.font?.size ?? theme.fontSize;
	const fontFamily = note.style?.font?.family ?? theme.fontFamily;
	const visibleText = visibleNoteText(note.text);
	const explicitLines = normalizeLineEndings(visibleText).split('\n');
	const widestLine = Math.max(0, ...explicitLines.map((line) => measuredNoteTextWidth({
		note,
		text: line,
		fontSize,
		fontFamily,
	})));
	const width = Math.ceil(Math.max(
		minimumNoteWidth,
		Math.min(noteCompactMaximumWidth, widestLine + noteContentHorizontalPadding),
	));
	const contentWidth = Math.max(1, width - noteContentHorizontalPadding);
	const visualLineCount = explicitLines
		.map((line) => wrappedNoteLineCount({ note, line, fontSize, fontFamily, contentWidth }))
		.reduce((sum, lineCount) => sum + lineCount, 0);
	const lineHeight = Math.ceil(fontSize * noteLineHeightFactor);
	const height = Math.ceil(Math.max(
		minimumNoteHeight,
		(visualLineCount * lineHeight) + noteContentVerticalPadding,
	));

	return { width, height };
}

function visibleNoteText(value: string): string {
	if (typeof DOMParser === 'undefined') {
		return value;
	}

	const parsed = new DOMParser().parseFromString(value, 'text/html');
	const text = renderedNoteText(parsed.body);
	if (text.endsWith('\n') && /<\/(?:div|li|ol|p|ul)>\s*$/iu.test(value)) {
		return text.slice(0, -1);
	}

	return text;
}

function renderedNoteText(node: ChildNode): string {
	if (node.nodeType === Node.TEXT_NODE) {
		return node.textContent ?? '';
	}
	if (!(node instanceof Element)) {
		return '';
	}

	const tagName = node.tagName.toLowerCase();
	if (tagName === 'br') {
		return '\n';
	}

	const text = [...node.childNodes].map(renderedNoteText).join('');
	if (isNoteBlockElement(tagName) && text.length > 0 && !text.endsWith('\n')) {
		return `${text}\n`;
	}

	return text;
}

function isNoteBlockElement(tagName: string): boolean {
	return tagName === 'div' || tagName === 'p' || tagName === 'li' || tagName === 'ul' || tagName === 'ol';
}

function normalizeLineEndings(value: string): string {
	return value.replace(/\r\n?/gu, '\n');
}

function wrappedNoteLineCount(options: {
	readonly note: DiagramNote;
	readonly line: string;
	readonly fontSize: number;
	readonly fontFamily: string;
	readonly contentWidth: number;
}): number {
	const words = options.line.trim().split(/\s+/u).filter((word) => word.length > 0);
	if (words.length === 0) {
		return 1;
	}

	let lineCount = 1;
	let currentLine = '';
	for (const word of words) {
		const candidate = currentLine.length === 0 ? word : `${currentLine} ${word}`;
		if (measuredNoteTextWidth({ ...options, text: candidate }) <= options.contentWidth) {
			currentLine = candidate;
			continue;
		}

		if (currentLine.length > 0) {
			lineCount += 1;
			currentLine = '';
		}

		currentLine = word;
		while (currentLine.length > 1 && measuredNoteTextWidth({ ...options, text: currentLine }) > options.contentWidth) {
			const breakIndex = Math.min(
				currentLine.length - 1,
				maximumFittingNotePrefixLength({ ...options, text: currentLine }),
			);
			lineCount += 1;
			currentLine = currentLine.slice(breakIndex);
		}
	}

	return lineCount;
}

function maximumFittingNotePrefixLength(options: {
	readonly note: DiagramNote;
	readonly text: string;
	readonly fontSize: number;
	readonly fontFamily: string;
	readonly contentWidth: number;
}): number {
	let lower = 1;
	let upper = options.text.length;
	while (lower < upper) {
		const middle = Math.ceil((lower + upper) / 2);
		if (measuredNoteTextWidth({ ...options, text: options.text.slice(0, middle) }) <= options.contentWidth) {
			lower = middle;
		} else {
			upper = middle - 1;
		}
	}

	return Math.max(1, lower);
}

function measuredNoteTextWidth(options: {
	readonly note: DiagramNote;
	readonly text: string;
	readonly fontSize: number;
	readonly fontFamily: string;
}): number {
	return measuredTextWidth({
		text: options.text,
		fontSize: options.fontSize,
		fontFamily: options.fontFamily,
		bold: options.note.style?.font?.bold,
		italic: options.note.style?.font?.italic,
	});
}

function revealSelectedModelTreeItem(): void {
	const selectedElementId = canvas.selectedElementId();
	if (selectedElementId === undefined) {
		showStatus('Select a node or edge to locate it in the model tree.');
		return;
	}

	const selectedElementKind = elementRegistry.element(selectedElementId)?.kind;
	if (selectedElementKind !== 'node' && selectedElementKind !== 'edge') {
		showStatus('Only ontology-backed nodes and edges have model-tree items.');
		return;
	}

	messageBus.publishCommand(new RevealModelTreeItemCommand(selectedElementId));
}

function renderThemeModeButton(): void {
	const nextMode = themeMode === 'dark' ? 'light' : 'dark';
	themeModeButton.replaceChildren(createIconElement(themeMode === 'dark' ? Sun : Moon, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	themeModeButton.title = `Switch to ${nextMode} mode`;
	themeModeButton.setAttribute('aria-label', `Switch to ${nextMode} mode`);
	themeModeButton.setAttribute('aria-pressed', String(themeMode === 'dark'));
}

function toggleThemeMode(): void {
	const selectedElementId = canvas.selectedElementId();
	themeMode = themeMode === 'dark' ? 'light' : 'dark';
	theme = readTheme(themeMode);
	updateWebviewState({ themeMode });
	applyCanvasTheme(theme);
	renderThemeModeButton();
	render();
	if (selectedElementId !== undefined) {
		canvas.selectElement(selectedElementId);
	}
	messageBus.publishCommand(new UpdateThemeModeCommand(themeMode));
	showStatus(`${capitalize(themeMode)} mode`);
}

function applyCanvasTheme(nextTheme: WebviewTheme): void {
	canvasScroll.style.setProperty('--diagram-canvas-background', nextTheme.canvasBackground);
	canvasScroll.style.setProperty('--diagram-canvas-foreground', nextTheme.editorForeground);
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function zoomBy(factor: number, source: 'zoom', clientPoint?: CanvasPoint): void {
	const oldZoom = canvas.zoom();
	const newZoom = clampZoom(oldZoom * factor);
	if (Math.abs(newZoom - oldZoom) < 0.001) {
		return;
	}

	const focus = clientPoint ?? viewportCenterClientPoint();
	const focusCanvasPoint = viewportClientPointToCanvasPoint(focus, oldZoom);
	setZoom(newZoom);
	scrollToCanvasPoint(focusCanvasPoint, focus);
	publishViewportChanged(source);
}

function setZoom(zoom: number): void {
	canvas.setZoom(clampZoom(zoom));
	resizeCanvasForZoom();
	updateLocalElementToolbar();
}

function fitDiagramToView(): void {
	const bounds = diagramContentBounds();
	if (bounds === undefined) {
		showStatus('There is no diagram content to fit.');
		return;
	}

	const viewportWidth = Math.max(1, canvasScroll.clientWidth - viewportPadding);
	const viewportHeight = Math.max(1, canvasScroll.clientHeight - viewportPadding);
	const zoom = clampZoom(Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height));
	setZoom(zoom);
	scrollToCanvasPoint(rectCenter(bounds), viewportCenterClientPoint());
	publishViewportChanged('fit');
}

function resetViewport(): void {
	setZoom(1);
	canvasScroll.scrollTo({ left: 0, top: 0 });
	publishViewportChanged('reset');
}

function resizeCanvasForZoom(): void {
	const bounds = diagramContentBounds();
	const zoom = canvas.zoom();
	const width = Math.max(defaultCanvasWidth, Math.ceil(((bounds?.x ?? 0) + (bounds?.width ?? defaultCanvasWidth)) * zoom + viewportPadding));
	const height = Math.max(defaultCanvasHeight, Math.ceil(((bounds?.y ?? 0) + (bounds?.height ?? defaultCanvasHeight)) * zoom + viewportPadding));
	canvas.resize(width, height);
}

function viewportCenterClientPoint(): CanvasPoint {
	const rect = canvasScroll.getBoundingClientRect();

	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}

function viewportClientPointToCanvasPoint(clientPoint: CanvasPoint, zoom: number): CanvasPoint {
	const rect = canvasScroll.getBoundingClientRect();

	return {
		x: (canvasScroll.scrollLeft + clientPoint.x - rect.left) / zoom,
		y: (canvasScroll.scrollTop + clientPoint.y - rect.top) / zoom,
	};
}

function scrollToCanvasPoint(canvasPoint: CanvasPoint, clientPoint: CanvasPoint): void {
	const rect = canvasScroll.getBoundingClientRect();

	canvasScroll.scrollTo({
		left: Math.max(0, (canvasPoint.x * canvas.zoom()) - (clientPoint.x - rect.left)),
		top: Math.max(0, (canvasPoint.y * canvas.zoom()) - (clientPoint.y - rect.top)),
	});
}

function clampZoom(value: number): number {
	return Math.min(Math.max(value, minimumZoom), maximumZoom);
}

interface ContentBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

function diagramContentBounds(): ContentBounds | undefined {
	const diagram = webviewConfig.payload.diagram;
	if (diagram === undefined) {
		return undefined;
	}

	const bounds: ContentBounds[] = [
		...(diagram.nodes ?? []).map(elementBounds),
		...(diagram.notes ?? []).map(elementBounds),
		...(diagram.images ?? []).map(elementBounds),
		...(diagram.labels ?? []).map(elementBounds),
		...(diagram.edges ?? []).flatMap(edgeBounds),
	];
	if (bounds.length === 0) {
		return undefined;
	}

	const left = Math.min(...bounds.map((bound) => bound.x));
	const top = Math.min(...bounds.map((bound) => bound.y));
	const right = Math.max(...bounds.map((bound) => bound.x + bound.width));
	const bottom = Math.max(...bounds.map((bound) => bound.y + bound.height));

	return {
		x: left,
		y: top,
		width: Math.max(1, right - left),
		height: Math.max(1, bottom - top),
	};
}

function elementBounds(element: {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}): ContentBounds {
	return {
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
	};
}

function edgeBounds(edge: NonNullable<NonNullable<DiagramPayload['diagram']>['edges']>[number]): readonly ContentBounds[] {
	const pointBounds = edgeRoutePoints(edge).map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));

	return [
		...pointBounds,
		...(edge.ontology_item_type === 'noteConnection' ? [] : [
		{
			x: edge.label.x,
			y: edge.label.y,
			width: Math.max(80, edge.ontology_ref.length * 7),
			height: 24,
		},
		]),
	];
}

function edgeRoutePoints(edge: NonNullable<NonNullable<DiagramPayload['diagram']>['edges']>[number]): readonly CanvasPoint[] {
	if (edge.points.length < 2) {
		return [];
	}
	if (edge.route_layout === 'direct') {
		return [edge.points[0], edge.points[edge.points.length - 1]];
	}

	return edge.points;
}

function rectCenter(bounds: ContentBounds): CanvasPoint {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2,
	};
}

function restoreSelection(): void {
	const selectedElementId = vscode.getState()?.selectedElementId;
	if (selectedElementId === undefined) {
		return;
	}

	canvas.selectElement(selectedElementId);
}

function restoreViewport(): void {
	const state = vscode.getState();
	const viewportPanX = state?.viewportPanX;
	const viewportPanY = state?.viewportPanY;
	const viewportZoom = state?.viewportZoom;
	if (viewportPanX === undefined && viewportPanY === undefined && viewportZoom === undefined) {
		return;
	}

	requestAnimationFrame(() => {
		if (viewportZoom !== undefined) {
			setZoom(viewportZoom);
		} else {
			resizeCanvasForZoom();
		}
		canvasScroll.scrollTo({
			left: viewportPanX ?? canvasScroll.scrollLeft,
			top: viewportPanY ?? canvasScroll.scrollTop,
		});
		publishViewportChanged('restore');
	});
}

function publishViewportChanged(changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom'): void {
	messageBus.publishEvent(new CanvasViewportChangedEvent({
		diagramFilePath: webviewConfig.payload.file?.fsPath,
		panX: canvasScroll.scrollLeft,
		panY: canvasScroll.scrollTop,
		zoom: canvas.zoom(),
		changeSource,
	}));
}

async function exportPng(): Promise<void> {
	try {
		const command = await createPngExportCommand(webviewConfig.payload, theme);
		if (command === undefined) {
			showStatus('There is no diagram content to export.');
			return;
		}

		messageBus.publishCommand(command);
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

		const selectedElementId = canvas.selectedElementId();
		if (selectedElementId !== undefined && editNote(selectedElementId)) {
			event.preventDefault();
		}
		if (selectedElementId !== undefined && editLabel(selectedElementId)) {
			event.preventDefault();
		}
	});
	canvas.onElementDoubleClicked((id) => {
		return editNote(id) || editLabel(id);
	});
}

function editNote(id: string): boolean {
	if (!geometryPersistence.hasNote(id)) {
		return false;
	}

	localElementToolbar.hidden = true;
	noteEditorController.open('note', id);

	return true;
}

function editLabel(id: string): boolean {
	if (!geometryPersistence.hasLabel(id)) {
		return false;
	}

	localElementToolbar.hidden = true;
	noteEditorController.open('label', id);

	return true;
}

function registerUndoRedoHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen() || isTextEditingTarget(event.target)) {
			return;
		}

		const action = undoRedoAction(event);
		if (action === undefined) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		if (action === 'undo') {
			requestDiagramUndo();
		} else {
			requestDiagramRedo();
		}
	});
}

function requestDiagramUndo(): void {
	messageBus.publishEvent(new CanvasUndoRequestedEvent({
		diagramFilePath: webviewConfig.payload.file?.fsPath,
	}));
	messageBus.publishCommand(new UndoDiagramCommand());
	showStatus('Undoing diagram edit.');
}

function requestDiagramRedo(): void {
	messageBus.publishEvent(new CanvasRedoRequestedEvent({
		diagramFilePath: webviewConfig.payload.file?.fsPath,
	}));
	messageBus.publishCommand(new RedoDiagramCommand());
	showStatus('Redoing diagram edit.');
}

function undoRedoAction(event: KeyboardEvent): 'undo' | 'redo' | undefined {
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

function registerKeyboardNudgeHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen() || isKeyboardInputTarget(event.target)) {
			return;
		}
		if (event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}

		const delta = keyboardNudgeDelta(event);
		if (delta === undefined) {
			return;
		}

		const selectedElementId = canvas.selectedElementId();
		if (selectedElementId === undefined) {
			return;
		}
		if (geometryPersistence.hasEdge(selectedElementId) && canvas.nudgeEdgeLabel(selectedElementId, delta)) {
			event.preventDefault();
			return;
		}

		const selectedElementKind = elementRegistry.element(selectedElementId)?.kind;
		if (isKeyboardNudgeableElement(selectedElementKind) && canvas.nudgeElement(selectedElementId, delta)) {
			event.preventDefault();
		}
	});
}

function keyboardNudgeDelta(event: KeyboardEvent): CanvasPoint | undefined {
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

function isKeyboardNudgeableElement(kind: string | undefined): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image' || kind === 'label';
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

		const selectedElementId = canvas.selectedElementId();
		if (selectedElementId !== undefined && deleteElement(selectedElementId)) {
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

function isTextEditingTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLTextAreaElement
		|| target instanceof HTMLInputElement
		|| target instanceof HTMLSelectElement
		|| (target instanceof HTMLElement && target.isContentEditable);
}

function deleteElement(id: string): boolean {
	const element = elementRegistry.element(id);
	if (element?.kind === 'node') {
		messageBus.publishCommand(new DeleteNodeCommand(id));

		return true;
	}

	if (element?.kind === 'edge') {
		messageBus.publishCommand(new DeleteEdgeCommand(id));

		return true;
	}

	if (geometryPersistence.hasNote(id)) {
		messageBus.publishCommand(new DeleteNoteCommand(id));

		return true;
	}

	if (geometryPersistence.hasImage(id)) {
		messageBus.publishCommand(new DeleteImageCommand(id));

		return true;
	}

	if (geometryPersistence.hasLabel(id)) {
		messageBus.publishCommand(new DeleteLabelCommand(id));

		return true;
	}

	return false;
}

function trackRenderedGeometry(payload: DiagramPayload): void {
	for (const node of payload.diagram?.nodes ?? []) {
		geometryPersistence.trackNodeBounds({
			id: node.id,
			x: node.x,
			y: node.y,
			width: node.width,
			height: node.height,
		});
	}
	for (const edge of payload.diagram?.edges ?? []) {
		geometryPersistence.trackEdgeRoute({
			id: edge.id,
			points: edge.points,
			label: edge.label,
		});
	}
	for (const note of payload.diagram?.notes ?? []) {
		geometryPersistence.trackNote({
			id: note.id,
			x: note.x,
			y: note.y,
			width: note.width,
			height: note.height,
		}, note.text);
	}
	for (const label of payload.diagram?.labels ?? []) {
		geometryPersistence.trackLabel({
			id: label.id,
			x: label.x,
			y: label.y,
			width: label.width,
			height: label.height,
		}, label.text);
	}
	for (const image of payload.diagram?.images ?? []) {
		geometryPersistence.trackImageBounds({
			id: image.id,
			x: image.x,
			y: image.y,
			width: image.width,
			height: image.height,
		});
	}
}

function insertionPosition(): CanvasPoint {
	const zoom = canvas.zoom();

	return {
		x: Math.max(0, Math.round((canvasScroll.scrollLeft + 80) / zoom)),
		y: Math.max(0, Math.round((canvasScroll.scrollTop + 80) / zoom)),
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
