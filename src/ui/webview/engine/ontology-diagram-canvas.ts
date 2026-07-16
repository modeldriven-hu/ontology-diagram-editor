import { CanvasRedoRequestedEvent, CanvasRenderedEvent, CanvasSelectionChangedEvent, CanvasUndoRequestedEvent, CanvasViewportChangedEvent } from '../../../shared/canvas-editor-events';
import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumLegendHeight, minimumLegendWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type CanvasPoint } from '../../../shared/canvas-geometry';
import { defaultDiagramLayoutAlgorithmId, defaultElkLayeredDirection, defaultElkLayeredLayerSpacing, defaultElkLayeredNodeSpacing, isDiagramLayoutAlgorithmId, isElkLayeredDirection, normalizeElkLayeredSpacing, type DiagramLayoutAlgorithmId, type ElkLayeredDirection } from '../../../shared/diagram-layout';
import type { CanvasViewport } from '../../../shared/canvas-viewport';
import { requiredCompactNoteSize } from '../../../shared/note-compact-size';
import { AddOntologyItemCommand, ArrangeDiagramCommand, CreateImageCommand, CreateLabelCommand, CreateLegendElementCommand, CreateMetadataElementCommand, CreateNoteCommand, DeleteEdgeCommand, DeleteElementsCommand, DeleteImageCommand, DeleteLabelCommand, DeleteLegendElementCommand, DeleteMetadataElementCommand, DeleteNodeCommand, DeleteNoteCommand, RedoDiagramCommand, RevealModelTreeItemCommand, UndoDiagramCommand, UpdateCanvasViewportCommand, UpdateLabelTextCommand, UpdateNoteTextCommand, UpdateThemeModeCommand, type WebviewCommand } from '../../../shared/webview-commands';
import { CanvasDropController } from '../components/canvas-drop-controller';
import { CanvasElementRegistry, type CanvasPropertyElement } from '../components/canvas-element-registry';
import { CanvasMessageBus } from './canvas-message-bus';
import { createPngExportCommand, createSvgExportCommand, renderDiagramExportToolbarIcons } from '../components/canvas-export';
import { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { CanvasPropertyPanel } from '../components/canvas-property-panel';
import { measuredTextWidth, nodeCompartmentAttributes, nodeTitleText, requiredNodeHeightForDataProperties, requiredNodeWidthForDataProperties } from '../components/node-data-properties';
import { renderImageToolbarIcon } from '../components/ontology-diagram-images';
import { renderLabelToolbarIcon } from '../components/ontology-diagram-labels';
import { metadataBounds, renderMetadataToolbarIcon } from '../components/ontology-diagram-metadata';
import { legendBounds, renderLegendToolbarIcon } from '../components/ontology-diagram-legend';
import { NoteEditorController, renderNoteToolbarIcon } from '../components/ontology-diagram-notes';
import { ontologyCommentsForReference } from '../components/ontology-comments';
import type { DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { detectPreferredThemeMode, readTheme, type WebviewTheme, type WebviewThemeMode } from '../webview-theme';
import { diagramContentBounds, rectCenter } from './canvas-content-bounds';
import { isKeyboardInputTarget, isTextEditingTarget, messageElement, requiredElement, showTransientStatus } from './canvas-dom';
import { isSelectAllShortcut } from './canvas-keyboard-shortcuts';
import { X6DiagramCanvasEngine } from './x6-diagram-canvas-engine';
import { LocalElementToolbarController } from './local-element-toolbar-controller';
import { FixedToolbarController } from './fixed-toolbar-controller';
import { renderAddOntologyItemToolbarIcon, renderArrangeDiagramToolbarIcon, renderCanvasToolbarDragHandle, renderLocalElementToolbarIcons, renderThemeModeButton, renderViewportToolbarIcons } from './ontology-diagram-toolbar-icons';

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
	readonly initialViewport?: CanvasViewport;
}

interface WebviewState {
	readonly selectedElementId?: string;
	readonly selectedElementIds?: readonly string[];
	readonly propertyPanelCollapsed?: boolean;
	readonly propertyPanelWidth?: number;
	readonly viewportPanX?: number;
	readonly viewportPanY?: number;
	readonly viewportZoom?: number;
	readonly localToolbarOffsetX?: number;
	readonly localToolbarOffsetY?: number;
	readonly canvasToolbarOffsetX?: number;
	readonly canvasToolbarOffsetY?: number;
	readonly themeMode?: WebviewThemeMode;
	readonly layoutAlgorithmId?: DiagramLayoutAlgorithmId;
	readonly elkLayeredNodeSpacing?: number;
	readonly elkLayeredLayerSpacing?: number;
	readonly elkLayeredDirection?: string;
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
const canvasShell = requiredElement('canvasShell');
const canvasActions = requiredElement('canvasActions');
const canvasToolbarDragHandle = requiredElement('canvasToolbarDragHandle') as HTMLButtonElement;
const status = requiredElement('status');
const addOntologyItemButton = requiredElement('addOntologyItemButton') as HTMLButtonElement;
const addNoteButton = requiredElement('addNoteButton') as HTMLButtonElement;
const addLabelButton = requiredElement('addLabelButton') as HTMLButtonElement;
const addImageButton = requiredElement('addImageButton') as HTMLButtonElement;
const addMetadataButton = requiredElement('addMetadataButton') as HTMLButtonElement;
const addLegendButton = requiredElement('addLegendButton') as HTMLButtonElement;
const exportSvgButton = requiredElement('exportSvgButton') as HTMLButtonElement;
const exportPngButton = requiredElement('exportPngButton') as HTMLButtonElement;
const diagramLayoutAlgorithmSelect = requiredElement('diagramLayoutAlgorithmSelect') as HTMLSelectElement;
const elkLayeredSpacingControls = requiredElement('elkLayeredSpacingControls');
const elkLayeredDirectionSelect = requiredElement('elkLayeredDirectionSelect') as HTMLSelectElement;
const elkLayeredNodeSpacingInput = requiredElement('elkLayeredNodeSpacingInput') as HTMLInputElement;
const elkLayeredLayerSpacingInput = requiredElement('elkLayeredLayerSpacingInput') as HTMLInputElement;
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
const localElementDragHandle = requiredElement('localElementDragHandle') as HTMLButtonElement;
const minimizeLocalButton = requiredElement('minimizeLocalButton') as HTMLButtonElement;
const createCommentNoteLocalButton = requiredElement('createCommentNoteLocalButton') as HTMLButtonElement;
const showRelatedElementsLocalButton = requiredElement('showRelatedElementsLocalButton') as HTMLButtonElement;
const alignLeftLocalButton = requiredElement('alignLeftLocalButton') as HTMLButtonElement;
const alignHorizontalCenterLocalButton = requiredElement('alignHorizontalCenterLocalButton') as HTMLButtonElement;
const alignRightLocalButton = requiredElement('alignRightLocalButton') as HTMLButtonElement;
const alignTopLocalButton = requiredElement('alignTopLocalButton') as HTMLButtonElement;
const alignVerticalCenterLocalButton = requiredElement('alignVerticalCenterLocalButton') as HTMLButtonElement;
const alignBottomLocalButton = requiredElement('alignBottomLocalButton') as HTMLButtonElement;
const matchWidthLocalButton = requiredElement('matchWidthLocalButton') as HTMLButtonElement;
const matchHeightLocalButton = requiredElement('matchHeightLocalButton') as HTMLButtonElement;
const matchSizeLocalButton = requiredElement('matchSizeLocalButton') as HTMLButtonElement;
const nodeSelectionSizeSeparator = requiredElement('nodeSelectionSizeSeparator');
const distributeHorizontalLocalButton = requiredElement('distributeHorizontalLocalButton') as HTMLButtonElement;
const distributeVerticalLocalButton = requiredElement('distributeVerticalLocalButton') as HTMLButtonElement;
const nodeSelectionDistributeSeparator = requiredElement('nodeSelectionDistributeSeparator');
const nodeSelectionSubclassSeparator = requiredElement('nodeSelectionSubclassSeparator');
const alignSubclassEndpointsLocalButton = requiredElement('alignSubclassEndpointsLocalButton') as HTMLButtonElement;
const connectNoteLocalButton = requiredElement('connectNoteLocalButton') as HTMLButtonElement;
const alignEdgeStartPointsLocalButton = requiredElement('alignEdgeStartPointsLocalButton') as HTMLButtonElement;
const alignEdgeEndPointsLocalButton = requiredElement('alignEdgeEndPointsLocalButton') as HTMLButtonElement;
const optimizeEdgeLocalButton = requiredElement('optimizeEdgeLocalButton') as HTMLButtonElement;
const straightenEdgeLocalButton = requiredElement('straightenEdgeLocalButton') as HTMLButtonElement;
const edgeRouteLayoutLocalSelect = requiredElement('edgeRouteLayoutLocalSelect') as HTMLSelectElement;
const resetEdgeLabelLocalButton = requiredElement('resetEdgeLabelLocalButton') as HTMLButtonElement;
const deleteEdgeLocalButton = requiredElement('deleteEdgeLocalButton') as HTMLButtonElement;
const propertyPanel = requiredElement('propertyPanel');
const propertyPanelResizeHandle = requiredElement('propertyPanelResizeHandle');
const propertyPanelTitle = requiredElement('propertyPanelTitle');
const propertyPanelToggle = requiredElement('propertyPanelToggle') as HTMLButtonElement;
const propertyPanelBody = requiredElement('propertyPanelBody');
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
	deleteElement,
	showStatus,
});
const fixedToolbarController = new FixedToolbarController({
	toolbar: canvasActions,
	dragHandle: canvasToolbarDragHandle,
	container: canvasShell,
	initialOffset: {
		x: vscode.getState()?.canvasToolbarOffsetX ?? 0,
		y: vscode.getState()?.canvasToolbarOffsetY ?? 0,
	},
	persistOffset: (offset) => {
		updateWebviewState({
			canvasToolbarOffsetX: offset.x,
			canvasToolbarOffsetY: offset.y,
		});
	},
});

renderCanvasToolbarDragHandle(canvasToolbarDragHandle);
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
	zoomOutButton,
	zoomInButton,
	fitDiagramButton,
	resetViewportButton,
	revealModelTreeItemButton,
	themeModeButton,
}, themeMode);
updateToolbarActionStates();
applyCanvasTheme(theme);
registerExtensionMessageForwarding();
registerCanvasStateSubscriptions();
render();
registerSelectionEventPublishing();
registerViewportEventPublishing();
localElementToolbarController.register();
fixedToolbarController.register();
updateElkLayeredSpacingControls();
registerPropertyPanel();
restoreSelection();
restoreViewport();
noteEditorController.register();
addOntologyItemButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new AddOntologyItemCommand(viewportCenterInsertionPosition()));
});
addImageButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateImageCommand(insertionPosition()));
});
addMetadataButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateMetadataElementCommand(insertionPosition()));
});
addLegendButton.addEventListener('click', () => {
	localElementToolbarController.cancelPendingNoteConnection();
	messageBus.publishCommand(new CreateLegendElementCommand(insertionPosition()));
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
	getTheme: () => theme,
	getZoom: () => canvas.zoom(),
	showStatus,
}).register();
geometryPersistence.register();
registerNoteEditHandlers();
registerUndoRedoHandlers();
registerSelectAllHandler();
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
	resizeCanvasForZoom();
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
		if (event.type === 'canvasPropertyPanelVisibilityChanged') {
			updateWebviewState({ propertyPanelCollapsed: event.collapsed });
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

function registerViewportEventPublishing(): void {
	canvasScroll.addEventListener('scroll', () => {
		localElementToolbarController.update();
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
		const attributes = nodeCompartmentAttributes(element.value, webviewConfig.payload);
		const fontSize = element.value.style?.font?.size ?? theme.nodeFontSize;
		return {
			width: requiredNodeWidthForDataProperties({
				title: nodeTitleText(element.value, webviewConfig.payload),
				attributes,
				fontSize,
				fontFamily: element.value.style?.font?.family ?? theme.nodeFontFamily,
				titleBold: element.value.style?.font?.bold ?? theme.nodeFontBold,
				attributeItalic: element.value.style?.font?.italic ?? theme.nodeFontItalic,
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
	applyCanvasTheme(theme);
	renderThemeModeButton(themeModeButton, themeMode);
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
	localElementToolbarController.update();
}

function fitDiagramToView(): void {
	const bounds = diagramContentBounds(webviewConfig.payload.diagram);
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
	const bounds = diagramContentBounds(webviewConfig.payload.diagram);
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

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

function restoreSelection(): void {
	const state = vscode.getState();
	const selectedElementIds = state?.selectedElementIds ?? (state?.selectedElementId === undefined ? [] : [state.selectedElementId]);
	if (selectedElementIds.length === 0) {
		return;
	}

	canvas.selectElements(selectedElementIds);
}

function restoreViewport(): void {
	const state = vscode.getState();
	const viewportPanX = state?.viewportPanX ?? webviewConfig.initialViewport?.panX;
	const viewportPanY = state?.viewportPanY ?? webviewConfig.initialViewport?.panY;
	const viewportZoom = state?.viewportZoom ?? webviewConfig.initialViewport?.zoom;
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

function registerSelectAllHandler(): void {
	document.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen() || isTextEditingTarget(event.target) || !isSelectAllShortcut(event)) {
			return;
		}

		canvas.selectElements(elementRegistry.renderedElementIdentifiers());
		event.preventDefault();
		event.stopPropagation();
	}, { capture: true });
}

function registerKeyboardNudgeHandlers(): void {
	document.addEventListener('keydown', (event) => {
		if (noteEditorController.isOpen() || isKeyboardInputTarget(event.target)) {
			return;
		}
		if (event.ctrlKey || event.metaKey) {
			return;
		}

		const delta = keyboardNudgeDelta(event);
		if (delta === undefined) {
			return;
		}

		const selectedElementIds = canvas.selectedElementIds();
		if (selectedElementIds.length > 1 && canvas.nudgeSelectedElements(delta)) {
			consumeKeyboardNudgeEvent(event);
			return;
		}

		const selectedElementId = canvas.selectedElementId();
		if (selectedElementId === undefined) {
			return;
		}
		if (event.altKey) {
			if (geometryPersistence.hasEdge(selectedElementId) && canvas.nudgeEdgeRoute(selectedElementId, delta)) {
				consumeKeyboardNudgeEvent(event);
			}
			return;
		}

		if (geometryPersistence.hasEdge(selectedElementId) && canvas.nudgeEdgeLabel(selectedElementId, delta)) {
			consumeKeyboardNudgeEvent(event);
			return;
		}

		const selectedElementKind = elementRegistry.element(selectedElementId)?.kind;
		if (isKeyboardNudgeableElement(selectedElementKind) && canvas.nudgeElement(selectedElementId, delta)) {
			consumeKeyboardNudgeEvent(event);
		}
	}, { capture: true });
}

function consumeKeyboardNudgeEvent(event: KeyboardEvent): void {
	event.preventDefault();
	event.stopImmediatePropagation();
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
	return kind === 'node' || kind === 'note' || kind === 'image' || kind === 'label' || kind === 'metadata';
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

		if (deleteSelectedElements()) {
			event.preventDefault();
			event.stopPropagation();
		}
	});
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
	if (geometryPersistence.hasMetadata(id)) {
		messageBus.publishCommand(new DeleteMetadataElementCommand(id));
		return true;
	}
	if (geometryPersistence.hasLegend(id)) {
		messageBus.publishCommand(new DeleteLegendElementCommand(id));
		return true;
	}

	return false;
}

function deleteSelectedElements(): boolean {
	const selectedElementIds = deletableElementIds(canvas.selectedElementIds());
	if (selectedElementIds.length > 1) {
		messageBus.publishCommand(new DeleteElementsCommand(selectedElementIds));

		return true;
	}

	return selectedElementIds.length === 1 && deleteElement(selectedElementIds[0]);
}

function deletableElementIds(ids: readonly string[]): readonly string[] {
	return [...new Set(ids)].filter((id) => {
		const element = elementRegistry.element(id);
		return element?.kind === 'node'
			|| element?.kind === 'edge'
			|| geometryPersistence.hasNote(id)
			|| geometryPersistence.hasImage(id)
			|| geometryPersistence.hasLabel(id)
			|| geometryPersistence.hasMetadata(id)
			|| geometryPersistence.hasLegend(id);
	});
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

function insertionPosition(): CanvasPoint {
	const zoom = canvas.zoom();

	return {
		x: Math.max(0, Math.round((canvasScroll.scrollLeft + 80) / zoom)),
		y: Math.max(0, Math.round((canvasScroll.scrollTop + 80) / zoom)),
	};
}

function viewportCenterInsertionPosition(): CanvasPoint {
	const position = viewportClientPointToCanvasPoint(viewportCenterClientPoint(), canvas.zoom());
	return {
		x: Math.max(0, Math.round(position.x)),
		y: Math.max(0, Math.round(position.y)),
	};
}

function showStatus(message: string): void {
	showTransientStatus(status, message);
}
