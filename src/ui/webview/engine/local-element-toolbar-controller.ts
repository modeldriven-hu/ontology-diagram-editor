import type { CanvasPoint } from '../../../shared/canvas-geometry';
import { AlignEdgeEndPointsCommand, AlignEdgeStartPointsCommand, AlignSubclassEndpointsCommand, CreateCommentNoteCommand, CreateNoteConnectionCommand, OptimizeEdgeRouteCommand, ShowRelatedElementsCommand, StraightenEdgeRouteCommand, UpdateEdgeRouteLayoutCommand } from '../../../shared/webview-commands';
import type { CanvasElementRegistry, CanvasPropertyElement } from '../components/canvas-element-registry';
import type { CanvasGeometryPersistence } from '../components/canvas-geometry-persistence';
import { alignNodeSelection, distributeNodeSelection, matchNodeSelectionSize, type NodeSelectionAlignment, type NodeSelectionDistribution, type NodeSelectionSizeMatch } from '../components/node-selection-layout';
import type { DiagramEdge, DiagramNode, DiagramPayload } from '../ontology-diagram-types';
import { edgeSelectionBounds, edgeToolbarPoint, nodeSelectionBounds } from './canvas-content-bounds';
import { setActionTooltip } from './canvas-dom';
import type { CanvasMessageBus } from './canvas-message-bus';
import type { DiagramCanvasEngine } from './diagram-canvas-engine';

interface LocalElementToolbarElements {
	readonly localElementToolbar: HTMLElement;
	readonly localElementDragHandle: HTMLButtonElement;
	readonly minimizeLocalButton: HTMLButtonElement;
	readonly createCommentNoteLocalButton: HTMLButtonElement;
	readonly showRelatedElementsLocalButton: HTMLButtonElement;
	readonly alignLeftLocalButton: HTMLButtonElement;
	readonly alignHorizontalCenterLocalButton: HTMLButtonElement;
	readonly alignRightLocalButton: HTMLButtonElement;
	readonly alignTopLocalButton: HTMLButtonElement;
	readonly alignVerticalCenterLocalButton: HTMLButtonElement;
	readonly alignBottomLocalButton: HTMLButtonElement;
	readonly matchWidthLocalButton: HTMLButtonElement;
	readonly matchHeightLocalButton: HTMLButtonElement;
	readonly matchSizeLocalButton: HTMLButtonElement;
	readonly nodeSelectionSizeSeparator: HTMLElement;
	readonly distributeHorizontalLocalButton: HTMLButtonElement;
	readonly distributeVerticalLocalButton: HTMLButtonElement;
	readonly nodeSelectionDistributeSeparator: HTMLElement;
	readonly nodeSelectionSubclassSeparator: HTMLElement;
	readonly alignSubclassEndpointsLocalButton: HTMLButtonElement;
	readonly connectNoteLocalButton: HTMLButtonElement;
	readonly alignEdgeStartPointsLocalButton: HTMLButtonElement;
	readonly alignEdgeEndPointsLocalButton: HTMLButtonElement;
	readonly optimizeEdgeLocalButton: HTMLButtonElement;
	readonly straightenEdgeLocalButton: HTMLButtonElement;
	readonly edgeRouteLayoutLocalSelect: HTMLSelectElement;
	readonly resetEdgeLabelLocalButton: HTMLButtonElement;
	readonly deleteEdgeLocalButton: HTMLButtonElement;
}

interface LocalElementToolbarControllerOptions {
	readonly canvas: DiagramCanvasEngine;
	readonly canvasScroll: HTMLElement;
	readonly elementRegistry: CanvasElementRegistry;
	readonly geometryPersistence: CanvasGeometryPersistence;
	readonly messageBus: CanvasMessageBus;
	readonly payload: DiagramPayload;
	readonly elements: LocalElementToolbarElements;
	readonly initialOffset: CanvasPoint;
	readonly persistOffset: (offset: CanvasPoint) => void;
	readonly noteEditorIsOpen: () => boolean;
	readonly minimumSizeForElement: (element: CanvasPropertyElement | undefined) => { readonly width: number; readonly height: number } | undefined;
	readonly commentTextForNode: (node: DiagramNode) => string;
	readonly deleteElement: (id: string) => boolean;
	readonly showStatus: (message: string) => void;
}

interface LocalToolbarDragState {
	readonly pointerId: number;
	readonly startClientX: number;
	readonly startClientY: number;
	readonly startOffset: CanvasPoint;
}

type LocalElementToolbarContext = CanvasPropertyElement | {
	readonly kind: 'nodeSelection';
	readonly ids: readonly string[];
	readonly values: readonly DiagramNode[];
} | {
	readonly kind: 'edgeSelection';
	readonly ids: readonly string[];
	readonly values: readonly DiagramEdge[];
};

interface LocalElementToolbarAnchor {
	readonly x: number;
	readonly y: number;
	readonly belowY: number;
}

interface LocalToolbarViewportPosition {
	readonly x: number;
	readonly y: number;
}

export class LocalElementToolbarController {
	private pendingNoteConnectionSourceId: string | undefined;
	private localToolbarOffset: CanvasPoint;
	private localToolbarDrag: LocalToolbarDragState | undefined;

	public constructor(private readonly options: LocalElementToolbarControllerOptions) {
		this.localToolbarOffset = options.initialOffset;
	}

	public register(): void {
		const elements = this.options.elements;
		this.registerButton(elements.minimizeLocalButton, () => {
			this.resizeSelectedElementToMinimum();
		});
		this.registerButton(elements.createCommentNoteLocalButton, () => {
			this.createCommentNoteFromSelectedNode();
		});
		this.registerButton(elements.showRelatedElementsLocalButton, () => {
			this.showRelatedElementsForSelectedNode();
		});
		this.registerButton(elements.alignLeftLocalButton, () => {
			this.alignSelectedNodes('left');
		});
		this.registerButton(elements.alignHorizontalCenterLocalButton, () => {
			this.alignSelectedNodes('horizontalCenter');
		});
		this.registerButton(elements.alignRightLocalButton, () => {
			this.alignSelectedNodes('right');
		});
		this.registerButton(elements.alignTopLocalButton, () => {
			this.alignSelectedNodes('top');
		});
		this.registerButton(elements.alignVerticalCenterLocalButton, () => {
			this.alignSelectedNodes('verticalCenter');
		});
		this.registerButton(elements.alignBottomLocalButton, () => {
			this.alignSelectedNodes('bottom');
		});
		this.registerButton(elements.matchWidthLocalButton, () => {
			this.matchSelectedNodeSize('width');
		});
		this.registerButton(elements.matchHeightLocalButton, () => {
			this.matchSelectedNodeSize('height');
		});
		this.registerButton(elements.matchSizeLocalButton, () => {
			this.matchSelectedNodeSize('size');
		});
		this.registerButton(elements.distributeHorizontalLocalButton, () => {
			this.distributeSelectedNodes('horizontal');
		});
		this.registerButton(elements.distributeVerticalLocalButton, () => {
			this.distributeSelectedNodes('vertical');
		});
		this.registerButton(elements.alignSubclassEndpointsLocalButton, () => {
			this.alignSubclassEndpointsForSelectedNodes();
		});
		this.registerButton(elements.alignEdgeStartPointsLocalButton, () => {
			this.alignStartPointsForSelectedEdges();
		});
		this.registerButton(elements.alignEdgeEndPointsLocalButton, () => {
			this.alignEndPointsForSelectedEdges();
		});
		elements.connectNoteLocalButton.addEventListener('click', () => {
			this.toggleNoteConnectionMode();
		});
		this.registerButton(elements.optimizeEdgeLocalButton, () => {
			this.optimizeSelectedEdgeRoute();
		});
		this.registerButton(elements.straightenEdgeLocalButton, () => {
			this.straightenSelectedEdgeRoute();
		});
		elements.edgeRouteLayoutLocalSelect.addEventListener('change', () => {
			this.updateSelectedEdgeRouteLayout();
		});
		this.registerButton(elements.resetEdgeLabelLocalButton, () => {
			this.resetSelectedEdgeLabel();
		});
		this.registerButton(elements.deleteEdgeLocalButton, () => {
			this.deleteSelectedEdge();
		});
		this.registerDrag();
	}

	public update(): void {
		const elements = this.options.elements;
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext === undefined || !hasLocalElementToolbarActions(toolbarContext) || this.options.noteEditorIsOpen()) {
			elements.localElementToolbar.hidden = true;
			return;
		}

		this.updateLocalElementToolbarButtons(toolbarContext);
		const toolbarAnchor = this.localElementToolbarAnchor(toolbarContext);
		if (toolbarAnchor === undefined) {
			elements.localElementToolbar.hidden = true;
			return;
		}

		const zoom = this.options.canvas.zoom();
		const toolbarWidth = elements.localElementToolbar.getBoundingClientRect().width || localElementToolbarFallbackWidth(toolbarContext);
		const toolbarHeight = elements.localElementToolbar.getBoundingClientRect().height || 36;
		const basePosition = this.localToolbarBaseViewportPosition(toolbarAnchor, zoom, toolbarWidth, toolbarHeight);
		const position = this.constrainedLocalToolbarViewportPosition({
			x: basePosition.x + this.localToolbarOffset.x,
			y: basePosition.y + this.localToolbarOffset.y,
		}, toolbarWidth, toolbarHeight);
		elements.localElementToolbar.style.left = `${Math.round(position.x + this.options.canvasScroll.scrollLeft)}px`;
		elements.localElementToolbar.style.top = `${Math.round(position.y + this.options.canvasScroll.scrollTop)}px`;
		elements.localElementToolbar.hidden = false;
		elements.connectNoteLocalButton.setAttribute('aria-pressed', String(this.pendingNoteConnectionSourceId !== undefined && this.pendingNoteConnectionSourceId === this.options.canvas.selectedElementId()));
	}

	public hide(): void {
		this.options.elements.localElementToolbar.hidden = true;
	}

	public cancelPendingNoteConnection(): void {
		this.pendingNoteConnectionSourceId = undefined;
		this.options.elements.connectNoteLocalButton.setAttribute('aria-pressed', 'false');
	}

	public handleSelectionChanged(targetId: string | undefined): void {
		this.handlePendingNoteConnectionSelection(targetId);
		this.update();
	}

	private registerButton(button: HTMLButtonElement, action: () => void): void {
		button.addEventListener('click', () => {
			this.cancelPendingNoteConnection();
			action();
		});
	}

	private toggleNoteConnectionMode(): void {
		if (this.pendingNoteConnectionSourceId !== undefined) {
			this.cancelPendingNoteConnection();
			this.options.showStatus('Note connection cancelled.');
			return;
		}

		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'note') {
			this.options.showStatus('Select a note before creating a note connection.');
			return;
		}

		this.pendingNoteConnectionSourceId = selectedElementId;
		this.options.elements.connectNoteLocalButton.setAttribute('aria-pressed', 'true');
		this.options.showStatus('Select another note, node, or image to create the note connection.');
		this.options.canvasScroll.focus();
	}

	private handlePendingNoteConnectionSelection(targetId: string | undefined): void {
		const sourceId = this.pendingNoteConnectionSourceId;
		if (sourceId === undefined || targetId === undefined || targetId === sourceId) {
			return;
		}

		const source = this.options.elementRegistry.element(sourceId);
		const target = this.options.elementRegistry.element(targetId);
		if (source === undefined || target === undefined || !isNoteConnectionEndpointKind(source.kind) || !isNoteConnectionEndpointKind(target.kind)) {
			this.options.showStatus('Select a note, node, or image to complete the note connection.');
			return;
		}

		if (source.kind !== 'note' && target.kind !== 'note') {
			this.options.showStatus('A note connection needs at least one note endpoint.');
			return;
		}

		const noteId = source.kind === 'note' ? sourceId : targetId;
		const targetElementId = source.kind === 'note' ? targetId : sourceId;
		this.cancelPendingNoteConnection();
		this.options.messageBus.publishCommand(new CreateNoteConnectionCommand(noteId, targetElementId));
		this.options.showStatus('Creating note connection.');
	}

	private localElementToolbarContext(): LocalElementToolbarContext | undefined {
		const selectedElementId = this.options.canvas.selectedElementId();
		if (selectedElementId !== undefined) {
			return this.options.elementRegistry.element(selectedElementId);
		}

		const selectedElementIds = this.options.canvas.selectedElementIds();
		if (selectedElementIds.length < 2) {
			return undefined;
		}

		const selectedNodes = selectedElementIds.flatMap((id) => {
			const element = this.options.elementRegistry.element(id);
			return element?.kind === 'node' ? [element.value] : [];
		});
		if (selectedNodes.length === selectedElementIds.length) {
			return {
				kind: 'nodeSelection',
				ids: selectedElementIds,
				values: selectedNodes,
			};
		}

		const selectedEdges = selectedElementIds.flatMap((id) => {
			const element = this.options.elementRegistry.element(id);
			return element?.kind === 'edge' ? [element.value] : [];
		});
		return selectedEdges.length === selectedElementIds.length
			? {
				kind: 'edgeSelection',
				ids: selectedElementIds,
				values: selectedEdges,
			}
			: undefined;
	}

	private updateLocalElementToolbarButtons(element: LocalElementToolbarContext): void {
		const elements = this.options.elements;
		const canResize = element.kind === 'node' || element.kind === 'note' || element.kind === 'image' || element.kind === 'label';
		const isNodeSelection = element.kind === 'nodeSelection';
		const isEdgeSelection = element.kind === 'edgeSelection';
		elements.minimizeLocalButton.hidden = !canResize;
		elements.createCommentNoteLocalButton.hidden = element.kind !== 'node';
		elements.showRelatedElementsLocalButton.hidden = element.kind !== 'node';
		elements.alignLeftLocalButton.hidden = !isNodeSelection;
		elements.alignHorizontalCenterLocalButton.hidden = !isNodeSelection;
		elements.alignRightLocalButton.hidden = !isNodeSelection;
		elements.alignTopLocalButton.hidden = !isNodeSelection;
		elements.alignVerticalCenterLocalButton.hidden = !isNodeSelection;
		elements.alignBottomLocalButton.hidden = !isNodeSelection;
		elements.matchWidthLocalButton.hidden = !isNodeSelection;
		elements.matchHeightLocalButton.hidden = !isNodeSelection;
		elements.matchSizeLocalButton.hidden = !isNodeSelection;
		elements.nodeSelectionSizeSeparator.hidden = !isNodeSelection;
		elements.distributeHorizontalLocalButton.hidden = !isNodeSelection;
		elements.distributeVerticalLocalButton.hidden = !isNodeSelection;
		elements.nodeSelectionDistributeSeparator.hidden = !isNodeSelection;
		elements.nodeSelectionSubclassSeparator.hidden = !isNodeSelection;
		elements.alignSubclassEndpointsLocalButton.hidden = !isNodeSelection;
		elements.connectNoteLocalButton.hidden = element.kind !== 'note';
		elements.alignEdgeStartPointsLocalButton.hidden = !isEdgeSelection;
		elements.alignEdgeEndPointsLocalButton.hidden = !isEdgeSelection;
		elements.optimizeEdgeLocalButton.hidden = element.kind !== 'edge';
		elements.straightenEdgeLocalButton.hidden = element.kind !== 'edge';
		elements.edgeRouteLayoutLocalSelect.hidden = element.kind !== 'edge';
		elements.resetEdgeLabelLocalButton.hidden = element.kind !== 'edge';
		elements.deleteEdgeLocalButton.hidden = element.kind !== 'edge';
		if (element.kind === 'edge') {
			elements.edgeRouteLayoutLocalSelect.value = element.value.route_layout ?? '';
		}

		if (element.kind === 'nodeSelection') {
			const hasSharedSuperclass = this.sharedSubclassTargetIds(element.ids).length === 1;
			elements.alignSubclassEndpointsLocalButton.disabled = !hasSharedSuperclass;
			setActionTooltip(elements.alignSubclassEndpointsLocalButton, hasSharedSuperclass
				? 'Align subclass endpoints'
				: 'Selected nodes do not share one superclass edge');
		} else {
			elements.alignSubclassEndpointsLocalButton.disabled = false;
			setActionTooltip(elements.alignSubclassEndpointsLocalButton, 'Align subclass endpoints');
		}

		if (element.kind === 'edgeSelection') {
			const canAlignStarts = selectedEdgesSharingFirstSource(element.values).length > 1;
			const canAlignEnds = selectedEdgesSharingFirstTarget(element.values).length > 1;
			elements.alignEdgeStartPointsLocalButton.disabled = !canAlignStarts;
			elements.alignEdgeEndPointsLocalButton.disabled = !canAlignEnds;
			setActionTooltip(elements.alignEdgeStartPointsLocalButton, canAlignStarts
				? 'Align same-source edge start positions'
				: 'Selected edges do not share the first edge source');
			setActionTooltip(elements.alignEdgeEndPointsLocalButton, canAlignEnds
				? 'Align same-target edge end positions'
				: 'Selected edges do not share the first edge target');
		} else {
			elements.alignEdgeStartPointsLocalButton.disabled = false;
			elements.alignEdgeEndPointsLocalButton.disabled = false;
			setActionTooltip(elements.alignEdgeStartPointsLocalButton, 'Align edge start positions');
			setActionTooltip(elements.alignEdgeEndPointsLocalButton, 'Align edge end positions');
		}

		if (element.kind === 'node') {
			const hasComments = this.options.commentTextForNode(element.value).trim().length > 0;
			elements.createCommentNoteLocalButton.disabled = !hasComments;
			setActionTooltip(elements.createCommentNoteLocalButton, hasComments
				? 'Create note from ontology comment'
				: 'No ontology comment available');
		} else {
			elements.createCommentNoteLocalButton.disabled = false;
		}

		if (element.kind === 'note') {
			setActionTooltip(elements.minimizeLocalButton, 'Resize note to compact size');
		} else if (element.kind === 'image') {
			setActionTooltip(elements.minimizeLocalButton, 'Resize image to minimum size');
		} else if (element.kind === 'label') {
			setActionTooltip(elements.minimizeLocalButton, 'Resize label to minimum size');
		} else {
			setActionTooltip(elements.minimizeLocalButton, 'Resize to minimum size');
		}
	}

	private registerDrag(): void {
		const elements = this.options.elements;
		elements.localElementDragHandle.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.localToolbarDrag = {
				pointerId: event.pointerId,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startOffset: this.localToolbarOffset,
			};
			elements.localElementDragHandle.setPointerCapture(event.pointerId);
			elements.localElementToolbar.classList.add('dragging');
		});

		elements.localElementDragHandle.addEventListener('pointermove', (event) => {
			if (this.localToolbarDrag?.pointerId !== event.pointerId) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.setLocalToolbarOffset({
				x: this.localToolbarDrag.startOffset.x + event.clientX - this.localToolbarDrag.startClientX,
				y: this.localToolbarDrag.startOffset.y + event.clientY - this.localToolbarDrag.startClientY,
			}, { persist: false });
		});

		elements.localElementDragHandle.addEventListener('pointerup', (event) => {
			this.completeLocalToolbarDrag(event);
		});
		elements.localElementDragHandle.addEventListener('pointercancel', (event) => {
			this.completeLocalToolbarDrag(event);
		});
		elements.localElementDragHandle.addEventListener('keydown', (event) => {
			if (event.key === 'Home') {
				event.preventDefault();
				event.stopPropagation();
				this.setLocalToolbarOffset({ x: 0, y: 0 });
				return;
			}

			const delta = localToolbarKeyboardDelta(event);
			if (delta === undefined) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.setLocalToolbarOffset({
				x: this.localToolbarOffset.x + delta.x,
				y: this.localToolbarOffset.y + delta.y,
			});
		});
	}

	private completeLocalToolbarDrag(event: PointerEvent): void {
		const elements = this.options.elements;
		if (this.localToolbarDrag?.pointerId !== event.pointerId) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		this.localToolbarDrag = undefined;
		if (elements.localElementDragHandle.hasPointerCapture(event.pointerId)) {
			elements.localElementDragHandle.releasePointerCapture(event.pointerId);
		}
		elements.localElementToolbar.classList.remove('dragging');
		this.options.persistOffset(this.localToolbarOffset);
	}

	private setLocalToolbarOffset(offset: CanvasPoint, options: { readonly persist?: boolean } = {}): void {
		this.localToolbarOffset = this.constrainedLocalToolbarOffset(offset);
		this.update();
		if (options.persist !== false) {
			this.options.persistOffset(this.localToolbarOffset);
		}
	}

	private constrainedLocalToolbarOffset(offset: CanvasPoint): CanvasPoint {
		const toolbarContext = this.localElementToolbarContext();
		const toolbarAnchor = toolbarContext === undefined ? undefined : this.localElementToolbarAnchor(toolbarContext);
		if (toolbarContext === undefined || toolbarAnchor === undefined) {
			return offset;
		}

		const elements = this.options.elements;
		const toolbarWidth = elements.localElementToolbar.getBoundingClientRect().width || localElementToolbarFallbackWidth(toolbarContext);
		const toolbarHeight = elements.localElementToolbar.getBoundingClientRect().height || 36;
		const basePosition = this.localToolbarBaseViewportPosition(toolbarAnchor, this.options.canvas.zoom(), toolbarWidth, toolbarHeight);
		const position = this.constrainedLocalToolbarViewportPosition({
			x: basePosition.x + offset.x,
			y: basePosition.y + offset.y,
		}, toolbarWidth, toolbarHeight);

		return {
			x: position.x - basePosition.x,
			y: position.y - basePosition.y,
		};
	}

	private localToolbarBaseViewportPosition(
		toolbarAnchor: LocalElementToolbarAnchor,
		zoom: number,
		toolbarWidth: number,
		toolbarHeight: number,
	): LocalToolbarViewportPosition {
		const canvasScroll = this.options.canvasScroll;
		const viewportX = toolbarAnchor.x * zoom - canvasScroll.scrollLeft;
		const viewportY = toolbarAnchor.y * zoom - canvasScroll.scrollTop;
		const constrainedX = this.constrainedLocalToolbarViewportPosition({ x: viewportX, y: 0 }, toolbarWidth, toolbarHeight).x;
		const belowViewportY = toolbarAnchor.belowY * zoom - canvasScroll.scrollTop;
		const preferredY = viewportY >= toolbarHeight + 14 ? viewportY - toolbarHeight - 8 : belowViewportY + 8;

		return this.constrainedLocalToolbarViewportPosition({
			x: constrainedX,
			y: preferredY,
		}, toolbarWidth, toolbarHeight);
	}

	private constrainedLocalToolbarViewportPosition(
		position: LocalToolbarViewportPosition,
		toolbarWidth: number,
		toolbarHeight: number,
	): LocalToolbarViewportPosition {
		const minX = toolbarWidth / 2 + 8;
		const maxX = Math.max(minX, this.options.canvasScroll.clientWidth - toolbarWidth / 2 - 8);
		const minY = 8;
		const maxY = Math.max(minY, this.options.canvasScroll.clientHeight - toolbarHeight - 8);

		return {
			x: clamp(position.x, minX, maxX),
			y: clamp(position.y, minY, maxY),
		};
	}

	private localElementToolbarAnchor(element: LocalElementToolbarContext): LocalElementToolbarAnchor | undefined {
		if (element.kind === 'nodeSelection') {
			const bounds = nodeSelectionBounds(element.values);
			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y,
				belowY: bounds.y + bounds.height,
			};
		}

		if (element.kind === 'edgeSelection') {
			const bounds = edgeSelectionBounds(element.values);
			if (bounds === undefined) {
				return undefined;
			}

			return {
				x: bounds.x + bounds.width / 2,
				y: bounds.y,
				belowY: bounds.y + bounds.height,
			};
		}

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

	private deleteSelectedEdge(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
			this.options.showStatus('Select an edge to remove.');
			return;
		}

		if (this.options.deleteElement(selectedElementId)) {
			this.hide();
			this.options.showStatus('Removing edge.');
		}
	}

	private optimizeSelectedEdgeRoute(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
			this.options.showStatus('Select an edge to optimize.');
			return;
		}

		this.options.messageBus.publishCommand(new OptimizeEdgeRouteCommand(selectedElementId));
		this.options.showStatus('Optimizing edge path.');
	}

	private straightenSelectedEdgeRoute(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
			this.options.showStatus('Select an edge to straighten.');
			return;
		}

		this.options.messageBus.publishCommand(new StraightenEdgeRouteCommand(selectedElementId));
		this.options.showStatus('Straightening edge.');
	}

	private updateSelectedEdgeRouteLayout(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
			this.options.showStatus('Select an edge to change its routing type.');
			return;
		}

		const routeLayout = edgeRouteLayoutFromSelectValue(this.options.elements.edgeRouteLayoutLocalSelect.value);
		if (routeLayout === undefined && this.options.elements.edgeRouteLayoutLocalSelect.value.length > 0) {
			this.options.showStatus('The selected edge routing type is not available.');
			return;
		}

		this.options.elementRegistry.updateEdgeRouteLayout(selectedElementId, routeLayout);
		this.options.messageBus.publishCommand(new UpdateEdgeRouteLayoutCommand(selectedElementId, routeLayout));
		this.options.showStatus(`Changed edge routing to ${edgeRouteLayoutLabel(routeLayout)}.`);
	}

	private resetSelectedEdgeLabel(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'edge') {
			this.options.showStatus('Select an edge to reset its label.');
			return;
		}

		this.options.canvas.resetEdgeLabel(selectedElementId);
		this.options.showStatus('Resetting edge label position.');
	}

	private createCommentNoteFromSelectedNode(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'node') {
			this.options.showStatus('Select a node with an ontology comment.');
			return;
		}

		const comment = this.options.commentTextForNode(selectedElement.value);
		if (comment.trim().length === 0) {
			this.options.showStatus('Selected node has no ontology comment.');
			return;
		}

		this.options.messageBus.publishCommand(new CreateCommentNoteCommand(selectedElementId, comment));
		this.options.showStatus('Creating note from ontology comment.');
	}

	private showRelatedElementsForSelectedNode(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		if (selectedElementId === undefined || selectedElement?.kind !== 'node') {
			this.options.showStatus('Select a node to show related elements.');
			return;
		}

		this.options.messageBus.publishCommand(new ShowRelatedElementsCommand(selectedElementId));
	}

	private alignSelectedNodes(alignment: NodeSelectionAlignment): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'nodeSelection') {
			this.options.showStatus('Select two or more nodes to align.');
			return;
		}

		const updates = alignNodeSelection(toolbarContext.values, alignment);
		if (updates.length === 0) {
			this.options.showStatus('Selected nodes are already aligned.');
			return;
		}

		this.options.geometryPersistence.applyElementBounds(updates, 'move');
		this.update();
		this.options.showStatus('Aligned selected nodes.');
	}

	private matchSelectedNodeSize(match: NodeSelectionSizeMatch): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'nodeSelection') {
			this.options.showStatus('Select two or more nodes to match size.');
			return;
		}

		const updates = matchNodeSelectionSize(toolbarContext.values, match);
		if (updates.length === 0) {
			this.options.showStatus('Selected nodes already match size.');
			return;
		}

		this.options.geometryPersistence.applyElementBounds(updates, 'resize');
		this.update();
		this.options.showStatus('Matched selected node size.');
	}

	private distributeSelectedNodes(distribution: NodeSelectionDistribution): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'nodeSelection') {
			this.options.showStatus('Select three or more nodes to distribute.');
			return;
		}

		const updates = distributeNodeSelection(toolbarContext.values, distribution);
		if (updates.length === 0) {
			this.options.showStatus(toolbarContext.values.length < 3
				? 'Select three or more nodes to distribute.'
				: 'Selected nodes are already distributed.');
			return;
		}

		this.options.geometryPersistence.applyElementBounds(updates, 'move');
		this.update();
		this.options.showStatus('Distributed selected nodes.');
	}

	private alignSubclassEndpointsForSelectedNodes(): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'nodeSelection') {
			this.options.showStatus('Select two or more subclass nodes to align.');
			return;
		}

		this.options.messageBus.publishCommand(new AlignSubclassEndpointsCommand(toolbarContext.ids));
		this.options.showStatus('Aligning subclass endpoints.');
	}

	private alignStartPointsForSelectedEdges(): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'edgeSelection') {
			this.options.showStatus('Select two or more edges to align their start positions.');
			return;
		}

		if (selectedEdgesSharingFirstSource(toolbarContext.values).length < 2) {
			this.options.showStatus('Select two or more edges that share the first edge source.');
			return;
		}

		this.options.messageBus.publishCommand(new AlignEdgeStartPointsCommand(toolbarContext.ids));
		this.options.showStatus('Aligning edge start positions.');
	}

	private alignEndPointsForSelectedEdges(): void {
		const toolbarContext = this.localElementToolbarContext();
		if (toolbarContext?.kind !== 'edgeSelection') {
			this.options.showStatus('Select two or more edges to align their end positions.');
			return;
		}

		if (selectedEdgesSharingFirstTarget(toolbarContext.values).length < 2) {
			this.options.showStatus('Select two or more edges that share the first edge target.');
			return;
		}

		this.options.messageBus.publishCommand(new AlignEdgeEndPointsCommand(toolbarContext.ids));
		this.options.showStatus('Aligning edge end positions.');
	}

	private resizeSelectedElementToMinimum(): void {
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined
			? undefined
			: this.options.elementRegistry.element(selectedElementId);
		const minimumSize = this.options.minimumSizeForElement(selectedElement);
		if (selectedElementId === undefined || minimumSize === undefined) {
			this.options.showStatus('Select a node, note, image, or label to resize.');
			return;
		}

		if (this.options.canvas.resizeElement(selectedElementId, minimumSize.width, minimumSize.height)) {
			this.options.showStatus('Resized selected element to minimum size.');
			return;
		}

		this.options.showStatus('Selected element is already at its minimum size.');
	}

	private sharedSubclassTargetIds(nodeIds: readonly string[]): readonly string[] {
		const subclassEdges = this.subclassEdgesForSelectedNodes(nodeIds);
		const targetsBySource = new Map(nodeIds.map((nodeId) => [
			nodeId,
			new Set(subclassEdges.filter((edge) => edge.source === nodeId).map((edge) => edge.target)),
		] as const));
		const firstTargets = targetsBySource.get(nodeIds[0]);
		if (firstTargets === undefined || firstTargets.size === 0) {
			return [];
		}

		return [...firstTargets].filter((targetId) =>
			nodeIds.every((nodeId) => targetsBySource.get(nodeId)?.has(targetId) === true),
		);
	}

	private subclassEdgesForSelectedNodes(nodeIds: readonly string[]): readonly DiagramEdge[] {
		const selectedNodeIds = new Set(nodeIds);
		return (this.options.payload.diagram?.edges ?? []).filter((edge) =>
			selectedNodeIds.has(edge.source) && isSubclassRelationshipEdge(edge),
		);
	}
}

function isNoteConnectionEndpointKind(kind: string): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image';
}

function hasLocalElementToolbarActions(element: LocalElementToolbarContext): boolean {
	return element.kind === 'nodeSelection'
		|| element.kind === 'edgeSelection'
		|| element.kind === 'node'
		|| element.kind === 'note'
		|| element.kind === 'image'
		|| element.kind === 'label'
		|| element.kind === 'edge';
}

function selectedEdgesSharingFirstSource(edges: readonly DiagramEdge[]): readonly DiagramEdge[] {
	const firstEdge = edges[0];
	return firstEdge === undefined
		? []
		: edges.filter((edge) => edge.source === firstEdge.source);
}

function selectedEdgesSharingFirstTarget(edges: readonly DiagramEdge[]): readonly DiagramEdge[] {
	const firstEdge = edges[0];
	return firstEdge === undefined
		? []
		: edges.filter((edge) => edge.target === firstEdge.target);
}

function isSubclassRelationshipEdge(edge: DiagramEdge): boolean {
	return edge.ontology_item_type === 'subclassRelationship'
		|| edge.ontology_ref === 'rdfs:subClassOf'
		|| edge.ontology_ref.endsWith('#subClassOf')
		|| edge.ontology_ref.endsWith('/subClassOf');
}

function edgeRouteLayoutFromSelectValue(value: string): DiagramEdge['route_layout'] {
	switch (value) {
		case '':
			return undefined;
		case 'orthogonal':
		case 'direct':
		case 'one_side':
		case 'manhattan':
		case 'metro':
		case 'entity_relation':
			return value;
		default:
			return undefined;
	}
}

function edgeRouteLayoutLabel(routeLayout: DiagramEdge['route_layout']): string {
	switch (routeLayout) {
		case undefined:
			return 'Default (orthogonal)';
		case 'orthogonal':
			return 'Orthogonal';
		case 'direct':
			return 'Direct';
		case 'one_side':
			return 'One Side';
		case 'manhattan':
			return 'Manhattan';
		case 'metro':
			return 'Metro';
		case 'entity_relation':
			return 'Entity Relation';
	}
}

function localToolbarKeyboardDelta(event: KeyboardEvent): CanvasPoint | undefined {
	const distance = event.shiftKey ? 24 : 8;
	switch (event.key) {
		case 'ArrowLeft':
			return { x: -distance, y: 0 };
		case 'ArrowRight':
			return { x: distance, y: 0 };
		case 'ArrowUp':
			return { x: 0, y: -distance };
		case 'ArrowDown':
			return { x: 0, y: distance };
		default:
			return undefined;
	}
}

function localElementToolbarFallbackWidth(element: LocalElementToolbarContext): number {
	if (element.kind === 'nodeSelection') {
		return 410;
	}
	if (element.kind === 'edgeSelection') {
		return 92;
	}
	if (element.kind === 'node' || element.kind === 'edge') {
		return element.kind === 'edge' ? 247 : 123;
	}
	if (element.kind === 'note') {
		return 87;
	}

	return 56;
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}
