import { Maximize2, Minimize2, Moon, RotateCcw, Sun, ZoomIn, ZoomOut, createElement as createIconElement } from 'lucide';

import { CanvasRenderedEvent, CanvasSelectionChangedEvent, CanvasViewportChangedEvent } from '../../../shared/canvas-editor-events';
import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type CanvasPoint } from '../../../shared/canvas-geometry';
import { CreateImageCommand, CreateLabelCommand, CreateNoteCommand, DeleteEdgeCommand, DeleteImageCommand, DeleteLabelCommand, DeleteNodeCommand, DeleteNoteCommand, UpdateLabelTextCommand, UpdateNoteTextCommand, UpdateThemeModeCommand, type WebviewCommand } from '../../../shared/webview-commands';
import { CanvasDropController } from '../components/canvas-drop-controller';
import { CanvasElementRegistry } from '../components/canvas-element-registry';
import { CanvasMessageBus } from './canvas-message-bus';
import { createPngExportCommand, createSvgExportCommand, renderDiagramExportToolbarIcons } from '../components/canvas-export';
import { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { CanvasPropertyPanel } from '../components/canvas-property-panel';
import { renderImageToolbarIcon } from '../components/ontology-diagram-images';
import { renderLabelToolbarIcon } from '../components/ontology-diagram-labels';
import { NoteEditorController, renderNoteToolbarIcon } from '../components/ontology-diagram-notes';
import type { DiagramPayload } from '../ontology-diagram-types';
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
const zoomOutButton = requiredElement('zoomOutButton') as HTMLButtonElement;
const zoomInButton = requiredElement('zoomInButton') as HTMLButtonElement;
const fitDiagramButton = requiredElement('fitDiagramButton') as HTMLButtonElement;
const resetViewportButton = requiredElement('resetViewportButton') as HTMLButtonElement;
const minimizeElementButton = requiredElement('minimizeElementButton') as HTMLButtonElement;
const themeModeButton = requiredElement('themeModeButton') as HTMLButtonElement;
const noteEditor = requiredElement('noteEditor') as HTMLFormElement;
const noteEditorText = requiredElement('noteEditorText') as HTMLTextAreaElement;
const saveNoteButton = requiredElement('saveNoteButton') as HTMLButtonElement;
const cancelNoteButton = requiredElement('cancelNoteButton') as HTMLButtonElement;
const propertyPanel = requiredElement('propertyPanel');
const propertyPanelResizeHandle = requiredElement('propertyPanelResizeHandle');
const propertyPanelTitle = requiredElement('propertyPanelTitle');
const propertyPanelToggle = requiredElement('propertyPanelToggle') as HTMLButtonElement;
const propertyPanelBody = requiredElement('propertyPanelBody');
let themeMode: WebviewThemeMode = webviewConfig.payload.diagram?.metadata?.theme_mode ?? vscode.getState()?.themeMode ?? detectPreferredThemeMode();
let theme = readTheme(themeMode);
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
renderDiagramExportToolbarIcons(exportSvgButton, exportPngButton);
renderViewportToolbarIcons();
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
addImageButton.addEventListener('click', () => {
	messageBus.publishCommand(new CreateImageCommand(insertionPosition()));
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
minimizeElementButton.addEventListener('click', () => {
	resizeSelectedElementToMinimum();
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

function registerViewportEventPublishing(): void {
	canvasScroll.addEventListener('scroll', () => {
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
	minimizeElementButton.replaceChildren(createIconElement(Minimize2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	renderThemeModeButton();
}

function resizeSelectedElementToMinimum(): void {
	const selectedElementId = canvas.selectedElementId();
	const selectedElementKind = selectedElementId === undefined
		? undefined
		: elementRegistry.element(selectedElementId)?.kind;
	const minimumSize = minimumSizeForElement(selectedElementKind);
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

function minimumSizeForElement(kind: string | undefined): { readonly width: number; readonly height: number } | undefined {
	if (kind === 'node') {
		return { width: minimumNodeWidth, height: minimumNodeHeight };
	}
	if (kind === 'note') {
		return { width: minimumNoteWidth, height: minimumNoteHeight };
	}
	if (kind === 'image') {
		return { width: minimumImageWidth, height: minimumImageHeight };
	}
	if (kind === 'label') {
		return { width: minimumLabelWidth, height: minimumLabelHeight };
	}

	return undefined;
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
	const pointBounds = edge.points.map((point) => ({
		x: point.x,
		y: point.y,
		width: 1,
		height: 1,
	}));

	return [
		...pointBounds,
		{
			x: edge.label.x,
			y: edge.label.y,
			width: Math.max(80, edge.ontology_ref.length * 7),
			height: 24,
		},
	];
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

	noteEditorController.open('note', id);

	return true;
}

function editLabel(id: string): boolean {
	if (!geometryPersistence.hasLabel(id)) {
		return false;
	}

	noteEditorController.open('label', id);

	return true;
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

function deleteElement(id: string): boolean {
	if (elementRegistry.element(id)?.kind === 'node') {
		messageBus.publishCommand(new DeleteNodeCommand(id));

		return true;
	}

	if (geometryPersistence.hasEdge(id)) {
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
