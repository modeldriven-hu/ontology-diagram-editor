import type { BoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasPropertyEditedEvent, CanvasPropertyPanelVisibilityChangedEvent, type CanvasElementType } from '../../../shared/canvas-editor-events';
import { DeleteEdgeCommand, PickImageSourceCommand, PickNodeImageCommand, UpdateImageBoundsCommand, UpdateImageSourceCommand, UpdateLabelBoundsCommand, UpdateLabelTextCommand, UpdateNodeBoundsCommand, UpdateNodeImageCommand, UpdateNoteBoundsCommand, UpdateNoteTextCommand } from '../../../shared/webview-commands';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import type { CanvasElementRegistry, CanvasPropertyElement } from './canvas-element-registry';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import { actionButton, imageField, numberField, readonlyField, sectionElement, textAreaField } from './canvas-property-fields';
import type { DiagramCanvasEngine } from '../engine/diagram-canvas-engine';
import { edgeDisplayName } from './ontology-diagram-edges';

interface CanvasPropertyPanelOptions {
	readonly canvas: Pick<DiagramCanvasEngine, 'restoreBounds' | 'updateElementContent'>;
	readonly payload: DiagramPayload;
	readonly registry: CanvasElementRegistry;
	readonly messageBus: CanvasMessageBus;
	readonly panel: HTMLElement;
	readonly resizeHandle: HTMLElement;
	readonly title: HTMLElement;
	readonly toggleButton: HTMLButtonElement;
	readonly body: HTMLElement;
	readonly showStatus: (message: string) => void;
	readonly resetEdgeLabel: (edgeId: string) => void;
	readonly focusAfterEscape: () => void;
	readonly initialCollapsed?: boolean;
	readonly initialWidth?: number;
	readonly onCollapsedChange?: (collapsed: boolean) => void;
	readonly onWidthChange?: (width: number) => void;
}

export class CanvasPropertyPanel {
	private collapsed = false;
	private panelWidth?: number;
	private selectedElement: CanvasPropertyElement | undefined;

	public constructor(private readonly options: CanvasPropertyPanelOptions) {}

	public register(): void {
		if (this.options.initialWidth !== undefined) {
			this.applyWidth(this.options.initialWidth, false);
		}
		this.setCollapsed(this.options.initialCollapsed ?? false, false);
		this.registerResizeHandle();
		this.options.toggleButton.addEventListener('click', () => {
			this.setCollapsed(!this.collapsed);
		});
		this.options.body.addEventListener('keydown', (event) => {
			event.stopPropagation();
			if (event.key === 'Escape') {
				event.preventDefault();
				this.renderSelection();
				this.options.focusAfterEscape();
			}
		});
		this.options.messageBus.subscribe((message) => {
			if (message.kind !== 'event') {
				return;
			}

			const event = message.payload;
			if (event.type === 'canvasSelectionChanged') {
				console.log('[ontology-diagram-editor] property-panel selection event received', {
					selectedElementIdentifier: event.selectedElementIdentifier,
					selectedElementType: event.selectedElementType,
				});
				this.selectedElement = event.selectedElementIdentifier === undefined
					? undefined
					: this.options.registry.element(event.selectedElementIdentifier);
				console.log('[ontology-diagram-editor] property-panel resolved selection', {
					kind: this.selectedElement?.kind,
					id: this.selectedElement?.value.id,
				});
				this.renderSelection();
			}
		});
		this.renderSelection();
	}

	private setCollapsed(collapsed: boolean, notify = true): void {
		this.collapsed = collapsed;
		this.options.panel.classList.toggle('collapsed', collapsed);
		this.options.panel.closest('.editor')?.classList.toggle('property-panel-collapsed', collapsed);
		this.options.toggleButton.setAttribute('aria-expanded', String(!collapsed));
		this.options.messageBus.publishEvent(new CanvasPropertyPanelVisibilityChangedEvent({
			diagramFilePath: this.options.payload.file?.fsPath,
			visible: true,
			collapsed,
			panelHeight: this.options.panel.getBoundingClientRect().height,
		}));
		if (notify) {
			this.options.onCollapsedChange?.(collapsed);
		}
	}

	private registerResizeHandle(): void {
		let startX = 0;
		let startWidth = 0;
		let activePointerId: number | undefined;
		const editor = this.editorElement();

		this.options.resizeHandle.addEventListener('pointerdown', (event) => {
			if (this.collapsed || editor === undefined) {
				return;
			}

			activePointerId = event.pointerId;
			startX = event.clientX;
			startWidth = this.currentPanelWidth();
			this.options.resizeHandle.setPointerCapture(event.pointerId);
			editor.classList.add('property-panel-resizing');
			event.preventDefault();
		});

		this.options.resizeHandle.addEventListener('pointermove', (event) => {
			if (activePointerId !== event.pointerId) {
				return;
			}

			this.applyWidth(startWidth + startX - event.clientX);
		});

		const finishResize = (event: PointerEvent): void => {
			if (activePointerId !== event.pointerId) {
				return;
			}

			activePointerId = undefined;
			editor?.classList.remove('property-panel-resizing');
			if (this.options.resizeHandle.hasPointerCapture(event.pointerId)) {
				this.options.resizeHandle.releasePointerCapture(event.pointerId);
			}
		};

		this.options.resizeHandle.addEventListener('pointerup', finishResize);
		this.options.resizeHandle.addEventListener('pointercancel', finishResize);
		this.options.resizeHandle.addEventListener('keydown', (event) => {
			if (this.collapsed || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
				return;
			}

			const step = event.shiftKey ? 80 : 24;
			this.applyWidth(this.currentPanelWidth() + (event.key === 'ArrowLeft' ? step : -step));
			event.preventDefault();
		});
	}

	private currentPanelWidth(): number {
		return this.panelWidth ?? this.options.panel.getBoundingClientRect().width;
	}

	private applyWidth(width: number, notify = true): void {
		const editor = this.editorElement();
		if (editor === undefined) {
			return;
		}

		const clampedWidth = this.clampWidth(width);
		this.panelWidth = clampedWidth;
		editor.style.setProperty('--property-panel-width', `${clampedWidth}px`);
		if (notify) {
			this.options.onWidthChange?.(clampedWidth);
		}
	}

	private clampWidth(width: number): number {
		const editorWidth = this.editorElement()?.getBoundingClientRect().width ?? 0;
		const minimumWidth = 280;
		const maximumWidth = editorWidth > 0
			? Math.max(minimumWidth, Math.min(640, editorWidth - 360))
			: 640;

		return Math.round(Math.min(Math.max(width, minimumWidth), maximumWidth));
	}

	private editorElement(): HTMLElement | undefined {
		const editor = this.options.panel.closest('.editor');

		return editor instanceof HTMLElement ? editor : undefined;
	}

	private renderSelection(): void {
		this.options.body.textContent = '';
		if (this.selectedElement === undefined) {
			this.options.title.textContent = 'Diagram Properties';
			this.renderDiagramContext();
			return;
		}

		this.options.title.textContent = `${capitalize(this.selectedElement.kind)} Properties`;
		this.renderElement(this.selectedElement);
	}

	private renderDiagramContext(): void {
		const file = this.options.payload.file;
		const diagram = this.options.payload.diagram;
		this.options.body.appendChild(sectionElement('Diagram', [
			readonlyField('File', file?.fsPath ?? ''),
			readonlyField('Title', diagram?.metadata?.title ?? ''),
			readonlyField('Theme', diagram?.metadata?.theme_file ?? ''),
			readonlyField('Ontologies', String(diagram?.ontologies?.length ?? 0)),
		]));
	}

	private renderElement(element: CanvasPropertyElement): void {
		this.options.body.appendChild(sectionElement('Identity', [
			readonlyField('Type', capitalize(element.kind)),
			readonlyField('ID', element.value.id),
		]));

		if (element.kind === 'node') {
			this.renderNode(element.value);
		} else if (element.kind === 'edge') {
			this.renderEdge(element.value);
		} else if (element.kind === 'note') {
			this.renderNote(element.value);
		} else if (element.kind === 'label') {
			this.renderLabel(element.value);
		} else {
			this.renderImage(element.value);
		}
	}

	private renderNode(node: DiagramNode): void {
		this.options.body.appendChild(sectionElement('Ontology', [
			readonlyField('Ref', node.ontology_ref),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(node, (update) => {
			this.propertyEdited('node', node.id, ['x', 'y', 'width', 'height']);
			this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand([update]));
		})));
		this.options.body.appendChild(sectionElement('Image', [
			imageField('Image', node.image ?? '', (value) => {
				const image = value.trim() === '' ? undefined : value;
				this.updateElementContent({ kind: 'nodeImage', id: node.id, image });
				this.propertyEdited('node', node.id, ['image']);
				this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, image));
			}, () => {
				this.options.messageBus.publishCommand(new PickNodeImageCommand(node.id));
			}),
		]));
	}

	private renderEdge(edge: DiagramEdge): void {
		this.options.body.appendChild(sectionElement('Ontology', [
			readonlyField('Ref', edge.ontology_ref),
			readonlyField('Label', edgeDisplayName(edge.ontology_ref)),
		]));
		this.options.body.appendChild(sectionElement('Connection', [
			readonlyField('Source', edge.source),
			readonlyField('Target', edge.target),
		]));
		this.options.body.appendChild(sectionElement('Actions', [
			actionButton('Reset Label Position', 'secondary', () => {
				this.options.resetEdgeLabel(edge.id);
			}),
			actionButton('Delete Edge', 'danger', () => {
				this.options.messageBus.publishCommand(new DeleteEdgeCommand(edge.id));
			}),
		]));
	}

	private renderNote(note: DiagramNote): void {
		this.options.body.appendChild(sectionElement('Text', [
			textAreaField('Text', note.text, (value) => {
				this.updateElementContent({ kind: 'noteText', id: note.id, text: value });
				this.propertyEdited('note', note.id, ['text']);
				this.options.messageBus.publishCommand(new UpdateNoteTextCommand(note.id, value));
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(note, (update) => {
			this.propertyEdited('note', note.id, ['x', 'y', 'width', 'height']);
			this.options.messageBus.publishCommand(new UpdateNoteBoundsCommand([update]));
		})));
	}

	private renderLabel(label: DiagramLabel): void {
		this.options.body.appendChild(sectionElement('Text', [
			textAreaField('Text', label.text, (value) => {
				this.updateElementContent({ kind: 'labelText', id: label.id, text: value });
				this.propertyEdited('label', label.id, ['text']);
				this.options.messageBus.publishCommand(new UpdateLabelTextCommand(label.id, value));
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(label, (update) => {
			this.propertyEdited('label', label.id, ['x', 'y', 'width', 'height']);
			this.options.messageBus.publishCommand(new UpdateLabelBoundsCommand([update]));
		})));
	}

	private renderImage(image: DiagramImage): void {
		this.options.body.appendChild(sectionElement('Image', [
			imageField('Source', image.source, (value) => {
				this.updateElementContent({ kind: 'imageSource', id: image.id, source: value });
				this.propertyEdited('image', image.id, ['source']);
				this.options.messageBus.publishCommand(new UpdateImageSourceCommand(image.id, value));
			}, () => {
				this.options.messageBus.publishCommand(new PickImageSourceCommand(image.id));
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(image, (update) => {
			this.propertyEdited('image', image.id, ['x', 'y', 'width', 'height']);
			this.options.messageBus.publishCommand(new UpdateImageBoundsCommand([update]));
		})));
	}

	private geometryFields(
		element: { readonly id: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number },
		commit: (update: BoundsUpdate) => void,
	): HTMLElement[] {
		let x = element.x;
		let y = element.y;
		let width = element.width;
		let height = element.height;
		const send = (): void => {
			const update = { id: element.id, x, y, width, height };
			this.options.registry.updateBounds(update);
			this.options.canvas.restoreBounds([update]);
			commit(update);
		};

		return [
			numberField('X', x, (value) => {
				x = value;
				send();
			}),
			numberField('Y', y, (value) => {
				y = value;
				send();
			}),
			numberField('Width', width, (value) => {
				width = value;
				send();
			}),
			numberField('Height', height, (value) => {
				height = value;
				send();
			}),
		];
	}

	private propertyEdited(elementType: CanvasElementType, elementIdentifier: string, changedFields: readonly string[]): void {
		this.options.messageBus.publishEvent(new CanvasPropertyEditedEvent({
			diagramFilePath: this.options.payload.file?.fsPath,
			elementIdentifier,
			elementType,
			changedFields,
		}));
	}

	private updateElementContent(update: Parameters<DiagramCanvasEngine['updateElementContent']>[0]): void {
		this.options.registry.updateContent(update);
		this.options.canvas.updateElementContent(update);
	}
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
