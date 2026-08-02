import { CanvasRedoRequestedEvent, CanvasRenderedEvent, CanvasSelectionChangedEvent, CanvasUndoRequestedEvent, CanvasViewportChangedEvent, type CanvasElementStylesUpdatedMessage, type CanvasSelectionRequestedMessage } from '../../../shared/canvas-editor-events';
import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumLegendHeight, minimumLegendWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNoteHeight, minimumNoteWidth, type CanvasPoint } from '../../../shared/canvas-geometry';
import { defaultDiagramLayoutAlgorithmId, defaultElkLayeredDirection, defaultElkLayeredLayerSpacing, defaultElkLayeredNodeSpacing, isDiagramLayoutAlgorithmId, isElkLayeredDirection, normalizeElkLayeredSpacing, type DiagramLayoutAlgorithmId, type ElkLayeredDirection } from '../../../shared/diagram-layout';
import type { CanvasViewport } from '../../../shared/canvas-viewport';
import { requiredCompactNoteSize } from '../../../shared/note-compact-size';
import { AddOntologyItemCommand, ArrangeDiagramCommand, CreateImageCommand, CreateLabelCommand, CreateLegendElementCommand, CreateMetadataElementCommand, CreateNoteCommand, DeleteEdgeCommand, DeleteElementsCommand, DeleteImageCommand, DeleteLabelCommand, DeleteLegendElementCommand, DeleteMetadataElementCommand, DeleteNodeCommand, DeleteNoteCommand, PickImageSourceCommand, PickNodeImageCommand, RedoDiagramCommand, RevealModelTreeItemCommand, UndoDiagramCommand, UpdateCanvasViewportCommand, UpdateLabelTextCommand, UpdateNoteTextCommand, UpdateThemeModeCommand, type WebviewCommand } from '../../../shared/webview-commands';
import type { IconGallerySet, ImageGalleryTargetType, OpenImageGalleryMessage } from '../../../shared/icon-gallery';
import { CanvasDropController } from '../components/canvas-drop-controller';
import { applyCanvasElementStyleUpdates } from '../components/canvas-element-style-updates';
import { CanvasElementRegistry, type CanvasPropertyElement } from '../components/canvas-element-registry';
import { IconGalleryDialog } from '../components/icon-gallery-dialog';
import { CanvasMessageBus } from './canvas-message-bus';
import { createPngExportCommand, createSvgExportCommand, renderDiagramExportToolbarIcons } from '../components/canvas-export';
import { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { measuredTextWidth, requiredMinimumNodeSize } from '../components/node-data-properties';
import { renderImageToolbarIcon } from '../components/ontology-diagram-images';
import { renderLabelToolbarIcon } from '../components/ontology-diagram-labels';
import { metadataBounds, renderMetadataToolbarIcon } from '../components/ontology-diagram-metadata';
import { legendBounds, renderLegendToolbarIcon } from '../components/ontology-diagram-legend';
import { NoteEditorController, renderNoteToolbarIcon } from '../components/ontology-diagram-notes';
import { ontologyCommentsForReference } from '../components/ontology-comments';
import { ontologyColor } from '../components/ontology-legend';
import type { DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { detectPreferredThemeMode, readTheme, type WebviewTheme, type WebviewThemeMode } from '../webview-theme';
import { diagramContentBounds, rectCenter } from './canvas-content-bounds';
import { isKeyboardInputTarget, messageElement, setActionTooltip, showTransientStatus } from './canvas-dom';
import { isSelectAllShortcut } from './canvas-keyboard-shortcuts';
import { X6DiagramCanvasEngine } from './x6-diagram-canvas-engine';
import { LocalElementToolbarController } from './local-element-toolbar-controller';
import { FixedToolbarController, initialFixedToolbarDock, persistedFixedToolbarDock, type PersistedFixedToolbarDock } from './fixed-toolbar-controller';
import { renderAddOntologyItemToolbarIcon, renderArrangeDiagramToolbarIcon, renderCanvasToolbarDragHandle, renderCanvasToolbarPinIcon, renderLocalElementToolbarIcons, renderThemeModeButton, renderViewportToolbarIcons } from './ontology-diagram-toolbar-icons';
import { embeddedGalleryIconColor } from '../../../shared/embedded-gallery-icon';
import { CanvasKeyboardController } from './canvas-keyboard-controller';
import { CanvasViewportController } from './canvas-viewport-controller';
import { canvasScroll, canvasContent, canvasShell, canvasActions, canvasToolbarDragHandle, canvasToolbarPinButton, status, addOntologyItemButton, addNoteButton, addLabelButton, addImageButton, addMetadataButton, addLegendButton, exportSvgButton, exportPngButton, diagramLayoutAlgorithmSelect, elkLayeredSpacingControls, elkLayeredDirectionSelect, elkLayeredNodeSpacingInput, elkLayeredLayerSpacingInput, arrangeDiagramButton, panCanvasButton, zoomOutButton, zoomInButton, fitDiagramButton, resetViewportButton, revealModelTreeItemButton, themeModeButton, noteEditor, noteEditorText, saveNoteButton, cancelNoteButton, localElementToolbar, localElementDragHandle, minimizeLocalButton, createCommentNoteLocalButton, showRelatedElementsLocalButton, showEdgesBetweenNodesLocalButton, alignLeftLocalButton, alignHorizontalCenterLocalButton, alignRightLocalButton, alignTopLocalButton, alignVerticalCenterLocalButton, alignBottomLocalButton, matchWidthLocalButton, matchHeightLocalButton, matchSizeLocalButton, nodeSelectionSizeSeparator, distributeHorizontalLocalButton, distributeVerticalLocalButton, nodeSelectionDistributeSeparator, nodeSelectionSubclassSeparator, alignSubclassEndpointsLocalButton, connectNoteLocalButton, alignEdgeStartPointsLocalButton, alignEdgeEndPointsLocalButton, optimizeEdgeLocalButton, straightenEdgeLocalButton, edgeRouteLayoutLocalSelect, edgePresentationLocalSelect, resetEdgeLabelLocalButton, deleteEdgeLocalButton } from './canvas-dom-elements';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewCommand | CanvasSelectionChangedEvent): void;
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
	readonly iconGallerySets: readonly IconGallerySet[];
	readonly modelTreeDragMimeType: string;
	readonly initialViewport?: CanvasViewport;
}

interface WebviewState {
	readonly selectedElementId?: string;
	readonly selectedElementIds?: readonly string[];
	readonly viewportPanX?: number;
	readonly viewportPanY?: number;
	readonly viewportZoom?: number;
	readonly localToolbarOffsetX?: number;
	readonly localToolbarOffsetY?: number;
	readonly canvasToolbarOffsetX?: number;
	readonly canvasToolbarOffsetY?: number;
	readonly canvasToolbarDock?: PersistedFixedToolbarDock;
	readonly canvasPanMode?: boolean;
	readonly themeMode?: WebviewThemeMode;
	readonly layoutAlgorithmId?: DiagramLayoutAlgorithmId;
	readonly elkLayeredNodeSpacing?: number;
	readonly elkLayeredLayerSpacing?: number;
	readonly elkLayeredDirection?: string;
}

interface CanvasPanDrag {
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly scrollLeft: number;
	readonly scrollTop: number;
}

const config = window.ontologyDiagramEditorConfig;
if (config === undefined) {
	throw new Error('Missing ontology diagram webview configuration.');
}

const webviewConfig = config;
const iconGalleryDialog = new IconGalleryDialog(webviewConfig.iconGallerySets);
const vscode = acquireVsCodeApi();
const savedLayoutAlgorithmId = vscode.getState()?.layoutAlgorithmId;
diagramLayoutAlgorithmSelect.value = savedLayoutAlgorithmId !== undefined && isDiagramLayoutAlgorithmId(savedLayoutAlgorithmId)
	? savedLayoutAlgorithmId
	: defaultDiagramLayoutAlgorithmId;
const savedElkLayeredNodeSpacing = normalizeElkLayeredSpacing(
	vscode.getState()?.elkLayeredNodeSpacing,
	defaultElkLayeredNodeSpacing,
);
const savedElkLayeredLayerSpacing = normalizeElkLayeredSpacing(
	vscode.getState()?.elkLayeredLayerSpacing,
	defaultElkLayeredLayerSpacing,
);
const savedElkLayeredDirection = vscode.getState()?.elkLayeredDirection;
elkLayeredDirectionSelect.value = savedElkLayeredDirection !== undefined && isElkLayeredDirection(savedElkLayeredDirection)
	? savedElkLayeredDirection
	: defaultElkLayeredDirection;
elkLayeredNodeSpacingInput.value = String(savedElkLayeredNodeSpacing);
elkLayeredLayerSpacingInput.value = String(savedElkLayeredLayerSpacing);
let themeMode: WebviewThemeMode = webviewConfig.payload.diagram?.metadata?.theme_mode ?? vscode.getState()?.themeMode ?? detectPreferredThemeMode();
let theme = readTheme(themeMode, webviewConfig.payload.theme);
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
		messageBus.publishCommand(new CreateNoteCommand(text, viewportController.insertionPosition()));
	},
	createLabel: (text) => {
		messageBus.publishCommand(new CreateLabelCommand(text, viewportController.insertionPosition()));
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
const keyboardController = new CanvasKeyboardController({
	canvas,
	elementRegistry,
	geometryPersistence,
	messageBus,
	noteEditorIsOpen: () => noteEditorController.isOpen(),
	diagramFilePath: webviewConfig.payload.file?.fsPath,
	showStatus,
});
const localElementToolbarController = new LocalElementToolbarController({
	canvas,
	canvasScroll,
	elementRegistry,
	geometryPersistence,
	messageBus,
	payload: webviewConfig.payload,
	elements: {
		localElementToolbar,
		localElementDragHandle,
		minimizeLocalButton,
		createCommentNoteLocalButton,
		showRelatedElementsLocalButton,
		showEdgesBetweenNodesLocalButton,
		alignLeftLocalButton,
		alignHorizontalCenterLocalButton,
		alignRightLocalButton,
		alignTopLocalButton,
		alignVerticalCenterLocalButton,
		alignBottomLocalButton,
		matchWidthLocalButton,
		matchHeightLocalButton,
		matchSizeLocalButton,
		nodeSelectionSizeSeparator,
		distributeHorizontalLocalButton,
		distributeVerticalLocalButton,
		nodeSelectionDistributeSeparator,
		nodeSelectionSubclassSeparator,
		alignSubclassEndpointsLocalButton,
		connectNoteLocalButton,
		alignEdgeStartPointsLocalButton,
		alignEdgeEndPointsLocalButton,
		optimizeEdgeLocalButton,
		straightenEdgeLocalButton,
		edgeRouteLayoutLocalSelect,
		edgePresentationLocalSelect,
		resetEdgeLabelLocalButton,
		deleteEdgeLocalButton,
	},
	initialOffset: {
		x: vscode.getState()?.localToolbarOffsetX ?? 0,
		y: vscode.getState()?.localToolbarOffsetY ?? 0,
	},
	persistOffset: (offset) => {
		updateWebviewState({
			localToolbarOffsetX: offset.x,
			localToolbarOffsetY: offset.y,
		});
	},
	noteEditorIsOpen: () => noteEditorController.isOpen(),
	minimumSizeForElement,
	commentTextForNode,
	deleteElement: (id) => keyboardController.deleteElement(id),
	showStatus,
});
const viewportController = new CanvasViewportController({
	canvas,
	scrollElement: canvasScroll,
	panButton: panCanvasButton,
	payload: webviewConfig.payload,
	initialViewport: webviewConfig.initialViewport,
	diagramFilePath: webviewConfig.payload.file?.fsPath,
	messageBus,
	initialPanMode: vscode.getState()?.canvasPanMode === true,
	getState: () => vscode.getState(),
	updateState: updateWebviewState,
	updateLocalToolbar: () => localElementToolbarController.update(),
	showStatus,
});
const fixedToolbarController = new FixedToolbarController({
	toolbar: canvasActions,
	dragHandle: canvasToolbarDragHandle,
	pinButton: canvasToolbarPinButton,
	container: canvasShell,
	initialPosition: {
		offset: {
			x: vscode.getState()?.canvasToolbarOffsetX ?? 0,
			y: vscode.getState()?.canvasToolbarOffsetY ?? 0,
		},
			dock: initialFixedToolbarDock(vscode.getState()?.canvasToolbarDock),
	},
	persistPosition: (position) => {
		updateWebviewState({
			canvasToolbarOffsetX: position.offset.x,
			canvasToolbarOffsetY: position.offset.y,
				canvasToolbarDock: persistedFixedToolbarDock(position.dock),
		});
	},
});

renderCanvasToolbarDragHandle(canvasToolbarDragHandle);
renderCanvasToolbarPinIcon(canvasToolbarPinButton);
renderNoteToolbarIcon(addNoteButton);
renderAddOntologyItemToolbarIcon(addOntologyItemButton);
renderLabelToolbarIcon(addLabelButton);
renderImageToolbarIcon(addImageButton);
renderMetadataToolbarIcon(addMetadataButton);
renderLegendToolbarIcon(addLegendButton);
renderLocalElementToolbarIcons({
	localElementDragHandle,
	minimizeLocalButton,
	createCommentNoteLocalButton,
	showRelatedElementsLocalButton,
	showEdgesBetweenNodesLocalButton,
	alignLeftLocalButton,
	alignHorizontalCenterLocalButton,
	alignRightLocalButton,
	alignTopLocalButton,
	alignVerticalCenterLocalButton,
	alignBottomLocalButton,
	matchWidthLocalButton,
	matchHeightLocalButton,
	matchSizeLocalButton,
	distributeHorizontalLocalButton,
	distributeVerticalLocalButton,
	alignSubclassEndpointsLocalButton,
	connectNoteLocalButton,
	alignEdgeStartPointsLocalButton,
	alignEdgeEndPointsLocalButton,
	optimizeEdgeLocalButton,
	straightenEdgeLocalButton,
	resetEdgeLabelLocalButton,
	deleteEdgeLocalButton,
});
renderDiagramExportToolbarIcons(exportSvgButton, exportPngButton);
renderArrangeDiagramToolbarIcon(arrangeDiagramButton);
renderViewportToolbarIcons({
	panCanvasButton,
	zoomOutButton,
	zoomInButton,
	fitDiagramButton,
	resetViewportButton,
	revealModelTreeItemButton,
	themeModeButton,
}, themeMode);
initializeFixedToolbarTooltips();
viewportController.setPanMode(vscode.getState()?.canvasPanMode === true, false);
updateToolbarActionStates();
applyCanvasTheme(theme, themeMode);
registerExtensionMessageForwarding();
registerHostMessageHandlers();
registerCanvasStateSubscriptions();
render();
registerSelectionEventPublishing();
viewportController.register();
localElementToolbarController.register();
fixedToolbarController.register();
updateElkLayeredSpacingControls();
restoreSelection();
viewportController.restoreViewport();
noteEditorController.register();
addOntologyItemButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new AddOntologyItemCommand(viewportController.viewportCenterInsertionPosition()));
});
addImageButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	const position = viewportController.insertionPosition();
	iconGalleryDialog.open({
		title: 'Add image',
		onIconSelected: (source) => messageBus.publishCommand(new CreateImageCommand(position, source)),
		onFileSelected: () => messageBus.publishCommand(new CreateImageCommand(position, undefined, true)),
	});
});
addMetadataButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateMetadataElementCommand(viewportController.insertionPosition()));
});
addLegendButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateLegendElementCommand(viewportController.insertionPosition()));
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
	localElementToolbarController.cancelPendingNoteConnection();
	if ((webviewConfig.payload.diagram?.nodes?.length ?? 0) === 0) {
		showStatus('There are no ontology nodes to arrange.');
		return;
	}

	const algorithmId = diagramLayoutAlgorithmSelect.value;
	if (!isDiagramLayoutAlgorithmId(algorithmId)) {
		showStatus('The selected diagram layout algorithm is not available.');
		return;
	}

	showStatus(`Arranging diagram using ${diagramLayoutAlgorithmSelect.selectedOptions[0]?.text ?? algorithmId}.`);
	messageBus.publishCommand(new ArrangeDiagramCommand(
		algorithmId,
		algorithmId === 'elk-layered' ? elkLayeredLayoutOptions() : undefined,
		selectedDiagramNodeIds(),
	));
});
panCanvasButton.addEventListener('click', (event) => {
	event.preventDefault();
	event.stopPropagation();
	viewportController.setPanMode(panCanvasButton.getAttribute('aria-pressed') !== 'true');
	canvasScroll.focus();
});
diagramLayoutAlgorithmSelect.addEventListener('change', () => {
	const algorithmId = diagramLayoutAlgorithmSelect.value;
	if (isDiagramLayoutAlgorithmId(algorithmId)) {
		updateWebviewState({ layoutAlgorithmId: algorithmId });
	}
	updateElkLayeredSpacingControls();
});
elkLayeredNodeSpacingInput.addEventListener('change', () => {
	persistElkLayeredLayoutOptions();
});
elkLayeredLayerSpacingInput.addEventListener('change', () => {
	persistElkLayeredLayoutOptions();
});
elkLayeredDirectionSelect.addEventListener('change', () => {
	persistElkLayeredLayoutOptions();
});
zoomOutButton.addEventListener('click', () => {
	viewportController.zoomBy(1 / 1.2);
});
zoomInButton.addEventListener('click', () => {
	viewportController.zoomBy(1.2);
});
fitDiagramButton.addEventListener('click', () => {
	viewportController.fitDiagramToView();
});
resetViewportButton.addEventListener('click', () => {
	viewportController.resetViewport();
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
	getTheme: () => theme,
	getZoom: () => canvas.zoom(),
	showStatus,
}).register();
geometryPersistence.register();
registerNoteEditHandlers();
keyboardController.register();

function registerExtensionMessageForwarding(): void {
	messageBus.subscribe((message) => {
		if (message.kind === 'command') {
			vscode.postMessage(message.payload);
			return;
		}
		if (message.payload.type === 'canvasSelectionChanged') {
			vscode.postMessage(message.payload);
		}
	});
}

function registerHostMessageHandlers(): void {
	window.addEventListener('message', (event: MessageEvent<OpenImageGalleryMessage | CanvasElementStylesUpdatedMessage | CanvasSelectionRequestedMessage>) => {
		if (event.data.type === 'openImageGallery') {
			openTargetImageGallery(event.data.targetType, event.data.targetId);
		}
		if (event.data.type === 'selectCanvasElements') {
			canvas.selectElements(event.data.elementIdentifiers.filter((id) => elementRegistry.element(id) !== undefined));
		}
		if (event.data.type === 'updateCanvasElementStyles') {
			applyCanvasElementStyleUpdates(event.data.updates, elementRegistry, canvas);
		}
	});
}

function openTargetImageGallery(targetType: ImageGalleryTargetType, targetId: string): void {
	const publishSelection = (source: string | undefined, pickFile: boolean): void => {
		messageBus.publishCommand(targetType === 'node'
			? new PickNodeImageCommand(targetId, source, pickFile)
			: new PickImageSourceCommand(targetId, source, pickFile));
	};
	const node = targetType === 'node'
		? webviewConfig.payload.diagram?.nodes?.find((candidate) => candidate.id === targetId)
		: undefined;
	const existingSource = node?.image ?? (targetType === 'image'
		? webviewConfig.payload.diagram?.images?.find((image) => image.id === targetId)?.source
		: undefined);
	iconGalleryDialog.open({
		title: targetType === 'node' ? 'Set node image' : 'Set standalone image source',
		onIconSelected: (source) => publishSelection(source, false),
		onFileSelected: () => publishSelection(undefined, true),
		initialColor: node === undefined
			? embeddedGalleryIconColor(existingSource)
			: ontologyColor(node.ontology_ref, webviewConfig.payload, node.ontology_item_type) ?? embeddedGalleryIconColor(existingSource),
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
	const metadataElements = webviewConfig.payload.diagram?.metadata_elements ?? [];
	const legendElements = webviewConfig.payload.diagram?.legend_elements ?? [];
	if (nodes.length === 0 && edges.length === 0 && notes.length === 0 && images.length === 0 && labels.length === 0 && metadataElements.length === 0 && legendElements.length === 0) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement(
			'empty-state',
			'Drag a class, individual, or datatype from the model tree and hold Shift when releasing it on the canvas, or add an element from the canvas toolbar.',
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
	viewportController.resizeCanvasForZoom();
	localElementToolbarController.update();
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
			updateWebviewState({
				selectedElementId: event.selectedElementIdentifier,
				selectedElementIds: event.selectedElementIdentifiers,
			});
		}
		if (event.type === 'canvasViewportChanged') {
			const viewport = {
				viewportPanX: event.panX,
				viewportPanY: event.panY,
				viewportZoom: event.zoom,
			};
			updateWebviewState(viewport);
			messageBus.publishCommand(new UpdateCanvasViewportCommand({
				panX: event.panX,
				panY: event.panY,
				zoom: event.zoom,
			}));
		}
	});
}

function registerSelectionEventPublishing(): void {
	canvas.onSelectionChanged(() => {
		const selectedElementId = canvas.selectedElementId();
		const selectedElementIds = canvas.selectedElementIds();
		localElementToolbarController.handleSelectionChanged(selectedElementId);
		console.log('[ontology-diagram-editor] publish canvas selection', {
			selectedElementId,
			selectedElementIds,
			selectedElementType: selectedElementId === undefined ? undefined : elementRegistry.elementType(selectedElementId),
		});
		messageBus.publishEvent(new CanvasSelectionChangedEvent({
			diagramFilePath: webviewConfig.payload.file?.fsPath,
			selectedElementIdentifier: selectedElementId,
			selectedElementType: selectedElementId === undefined ? undefined : elementRegistry.elementType(selectedElementId),
			selectedElementIdentifiers: selectedElementIds,
		}));
	});
}

function updateToolbarActionStates(): void {
	addOntologyItemButton.disabled = !(webviewConfig.payload.ontology?.items ?? []).some((item) => isAddableOntologyItemType(item.type));
	arrangeDiagramButton.disabled = (webviewConfig.payload.diagram?.nodes?.length ?? 0) === 0;
}

function isAddableOntologyItemType(type: string): boolean {
	return type === 'class'
		|| type === 'individual'
		|| type === 'datatype'
		|| type === 'objectProperty'
		|| type === 'dataProperty'
		|| type === 'subclassRelationship'
		|| type === 'objectPropertyAssertion';
}

function commentTextForNode(node: DiagramNode): string {
	return ontologyCommentsForReference(node.ontology_ref, webviewConfig.payload).join('\n\n');
}

function minimumSizeForElement(element: CanvasPropertyElement | undefined): { readonly width: number; readonly height: number } | undefined {
	if (element?.kind === 'node') {
		return requiredMinimumNodeSize(element.value, webviewConfig.payload, theme);
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
	if (element?.kind === 'metadata') {
		return { width: minimumMetadataWidth, height: minimumMetadataHeight };
	}
	if (element?.kind === 'legend') {return { width: minimumLegendWidth, height: minimumLegendHeight };}

	return undefined;
}

function requiredNoteSize(note: DiagramNote): { readonly width: number; readonly height: number } {
	const fontSize = note.style?.font?.size ?? theme.fontSize;
	const fontFamily = note.style?.font?.family ?? theme.fontFamily;
	const visibleText = visibleNoteText(note.text);
	return requiredCompactNoteSize({
		text: visibleText,
		minimumWidth: minimumNoteWidth,
		minimumHeight: minimumNoteHeight,
		fontSize,
		measureTextWidth: (text) => measuredNoteTextWidth({
			note,
			text,
			fontSize,
			fontFamily,
		}),
	});
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

function toggleThemeMode(): void {
	const selectedElementId = canvas.selectedElementId();
	themeMode = themeMode === 'dark' ? 'light' : 'dark';
	theme = readTheme(themeMode, webviewConfig.payload.theme);
	updateWebviewState({ themeMode });
	applyCanvasTheme(theme, themeMode);
	renderThemeModeButton(themeModeButton, themeMode);
	render();
	if (selectedElementId !== undefined) {
		canvas.selectElement(selectedElementId);
	}
	messageBus.publishCommand(new UpdateThemeModeCommand(themeMode));
	showStatus(`${capitalize(themeMode)} mode`);
}

function applyCanvasTheme(nextTheme: WebviewTheme, mode: WebviewThemeMode): void {
	document.body.dataset.diagramTheme = mode;
	canvasScroll.style.setProperty('--diagram-canvas-background', nextTheme.canvasBackground);
	canvasScroll.style.setProperty('--diagram-canvas-foreground', nextTheme.editorForeground);
}

function initializeFixedToolbarTooltips(): void {
	for (const button of canvasActions.querySelectorAll<HTMLButtonElement>('button[title]')) {
		const tooltip = button.title.trim();
		if (tooltip.length > 0) {
			setActionTooltip(button, tooltip);
		}
	}
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function restoreSelection(): void {
	const state = vscode.getState();
	const selectedElementIds = state?.selectedElementIds ?? (state?.selectedElementId === undefined ? [] : [state.selectedElementId]);
	if (selectedElementIds.length === 0) {
		return;
	}

	canvas.selectElements(selectedElementIds);
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

function updateElkLayeredSpacingControls(): void {
	const showElkLayeredSpacing = diagramLayoutAlgorithmSelect.value === 'elk-layered';
	elkLayeredSpacingControls.hidden = !showElkLayeredSpacing;
	fixedToolbarController.update();
}

function elkLayeredLayoutOptions(): { readonly nodeSpacing: number; readonly layerSpacing: number; readonly direction: ElkLayeredDirection } {
	const nodeSpacing = normalizeElkLayeredSpacing(
		elkLayeredNodeSpacingInput.valueAsNumber,
		defaultElkLayeredNodeSpacing,
	);
	const layerSpacing = normalizeElkLayeredSpacing(
		elkLayeredLayerSpacingInput.valueAsNumber,
		defaultElkLayeredLayerSpacing,
	);
	elkLayeredNodeSpacingInput.value = String(nodeSpacing);
	elkLayeredLayerSpacingInput.value = String(layerSpacing);
	const direction = isElkLayeredDirection(elkLayeredDirectionSelect.value)
		? elkLayeredDirectionSelect.value
		: defaultElkLayeredDirection;
	elkLayeredDirectionSelect.value = direction;

	return { nodeSpacing, layerSpacing, direction };
}

function persistElkLayeredLayoutOptions(): void {
	const options = elkLayeredLayoutOptions();
	updateWebviewState({
		elkLayeredNodeSpacing: options.nodeSpacing,
		elkLayeredLayerSpacing: options.layerSpacing,
		elkLayeredDirection: options.direction,
	});
}

function selectedDiagramNodeIds(): readonly string[] | undefined {
	const nodeIds = canvas.selectedElementIds().filter((id) => elementRegistry.element(id)?.kind === 'node');
	return nodeIds.length > 0 ? nodeIds : undefined;
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

	localElementToolbarController.hide();
	noteEditorController.open('note', id);

	return true;
}

function editLabel(id: string): boolean {
	if (!geometryPersistence.hasLabel(id)) {
		return false;
	}

	localElementToolbarController.hide();
	noteEditorController.open('label', id);

	return true;
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
			sourceCardinalityLabel: edge.source_cardinality_label,
			targetCardinalityLabel: edge.target_cardinality_label,
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
	for (const element of payload.diagram?.metadata_elements ?? []) {
		geometryPersistence.trackMetadataBounds(metadataBounds(element));
	}
	for (const element of payload.diagram?.legend_elements ?? []) {geometryPersistence.trackLegendBounds(legendBounds(element));}
}

function showStatus(message: string): void {
	showTransientStatus(status, message);
}
