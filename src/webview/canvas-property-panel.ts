import type { BoundsUpdate } from '../shared/canvas-geometry';
import type { CanvasElementType } from '../shared/canvas-editor-events';
import type { WebviewMessage } from '../shared/ontology-diagram-events';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from './ontology-diagram-types';
import type { CanvasElementRegistry, CanvasPropertyElement } from './canvas-element-registry';
import type { CanvasEventPublisher } from './canvas-event-bus';
import type { DiagramCanvasEngine } from './diagram-canvas-engine';
import { edgeDisplayName } from './ontology-diagram-edges';

interface CanvasPropertyPanelOptions {
	readonly canvas: Pick<DiagramCanvasEngine, 'selectedElementId' | 'onSelectionChanged'>;
	readonly payload: DiagramPayload;
	readonly registry: CanvasElementRegistry;
	readonly events: CanvasEventPublisher;
	readonly panel: HTMLElement;
	readonly title: HTMLElement;
	readonly toggleButton: HTMLButtonElement;
	readonly body: HTMLElement;
	readonly postMessage: (message: WebviewMessage) => void;
	readonly showStatus: (message: string) => void;
	readonly focusAfterEscape: () => void;
	readonly initialCollapsed?: boolean;
	readonly onCollapsedChange?: (collapsed: boolean) => void;
}

export class CanvasPropertyPanel {
	private collapsed = false;

	public constructor(private readonly options: CanvasPropertyPanelOptions) {}

	public register(): void {
		this.setCollapsed(this.options.initialCollapsed ?? false, false);
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
		this.options.canvas.onSelectionChanged(() => {
			this.renderSelection();
		});
		this.renderSelection();
	}

	private setCollapsed(collapsed: boolean, notify = true): void {
		this.collapsed = collapsed;
		this.options.panel.classList.toggle('collapsed', collapsed);
		this.options.toggleButton.setAttribute('aria-expanded', String(!collapsed));
		this.options.events.publish({
			type: 'canvasPropertyPanelVisibilityChanged',
			diagramFilePath: this.options.payload.file?.fsPath,
			visible: true,
			collapsed,
			panelHeight: this.options.panel.getBoundingClientRect().height,
		});
		if (notify) {
			this.options.onCollapsedChange?.(collapsed);
		}
	}

	private renderSelection(): void {
		this.options.body.textContent = '';
		const selectedElementId = this.options.canvas.selectedElementId();
		const selectedElement = selectedElementId === undefined ? undefined : this.options.registry.element(selectedElementId);
		if (selectedElement === undefined) {
			this.options.title.textContent = 'Diagram Properties';
			this.renderDiagramContext();
			return;
		}

		this.options.title.textContent = `${capitalize(selectedElement.kind)} Properties`;
		this.renderElement(selectedElement);
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
			this.options.postMessage({ type: 'updateNodeBounds', updates: [update] });
		})));
		this.options.body.appendChild(sectionElement('Image', [
			imageField('Image', node.image ?? '', (value) => {
				this.propertyEdited('node', node.id, ['image']);
				this.options.postMessage({ type: 'updateNodeImage', id: node.id, image: value.trim() === '' ? undefined : value });
			}, () => {
				this.options.postMessage({ type: 'pickNodeImage', id: node.id });
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
			actionButton('Delete Edge', 'danger', () => {
				this.options.postMessage({ type: 'deleteEdge', id: edge.id });
			}),
		]));
	}

	private renderNote(note: DiagramNote): void {
		this.options.body.appendChild(sectionElement('Text', [
			textAreaField('Text', note.text, (value) => {
				this.propertyEdited('note', note.id, ['text']);
				this.options.postMessage({ type: 'updateNoteText', id: note.id, text: value });
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(note, (update) => {
			this.propertyEdited('note', note.id, ['x', 'y', 'width', 'height']);
			this.options.postMessage({ type: 'updateNoteBounds', updates: [update] });
		})));
	}

	private renderLabel(label: DiagramLabel): void {
		this.options.body.appendChild(sectionElement('Text', [
			textAreaField('Text', label.text, (value) => {
				this.propertyEdited('label', label.id, ['text']);
				this.options.postMessage({ type: 'updateLabelText', id: label.id, text: value });
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(label, (update) => {
			this.propertyEdited('label', label.id, ['x', 'y', 'width', 'height']);
			this.options.postMessage({ type: 'updateLabelBounds', updates: [update] });
		})));
	}

	private renderImage(image: DiagramImage): void {
		this.options.body.appendChild(sectionElement('Image', [
			imageField('Source', image.source, (value) => {
				this.propertyEdited('image', image.id, ['source']);
				this.options.postMessage({ type: 'updateImageSource', id: image.id, source: value });
			}, () => {
				this.options.postMessage({ type: 'pickImageSource', id: image.id });
			}),
		]));
		this.options.body.appendChild(sectionElement('Geometry', this.geometryFields(image, (update) => {
			this.propertyEdited('image', image.id, ['x', 'y', 'width', 'height']);
			this.options.postMessage({ type: 'updateImageBounds', updates: [update] });
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
			commit({ id: element.id, x, y, width, height });
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
		this.options.events.publish({
			type: 'canvasPropertyEdited',
			diagramFilePath: this.options.payload.file?.fsPath,
			elementIdentifier,
			elementType,
			changedFields,
		});
	}
}

function readonlyField(label: string, value: string): HTMLElement {
	const field = fieldElement(label);
	const valueElement = document.createElement('span');
	valueElement.className = 'property-value';
	valueElement.textContent = value;
	field.appendChild(valueElement);

	return field;
}

function numberField(label: string, value: number, commit: (value: number) => void): HTMLElement {
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'number';
	input.value = String(value);
	registerCommit(input, () => {
		const nextValue = Number(input.value);
		if (Number.isFinite(nextValue)) {
			commit(nextValue);
		}
	});

	return editableField(label, input);
}

function textAreaField(label: string, value: string, commit: (value: string) => void): HTMLElement {
	const input = document.createElement('textarea');
	input.className = 'property-textarea';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});

	return editableField(label, input);
}

function imageField(label: string, value: string, commit: (value: string) => void, pick: () => void): HTMLElement {
	const wrapper = document.createElement('span');
	wrapper.className = 'property-inline';
	const input = document.createElement('input');
	input.className = 'property-input';
	input.type = 'text';
	input.value = value;
	registerCommit(input, () => {
		commit(input.value);
	});
	const button = document.createElement('button');
	button.className = 'property-button';
	button.type = 'button';
	button.textContent = 'Pick';
	button.addEventListener('click', pick);
	wrapper.append(input, button);

	return editableField(label, wrapper);
}

function actionButton(label: string, kind: 'danger', action: () => void): HTMLElement {
	const button = document.createElement('button');
	button.className = `property-button property-button-${kind}`;
	button.type = 'button';
	button.textContent = label;
	button.addEventListener('click', action);

	return button;
}

function editableField(label: string, input: HTMLElement): HTMLElement {
	const field = fieldElement(label);
	field.appendChild(input);

	return field;
}

function fieldElement(label: string): HTMLElement {
	const field = document.createElement('label');
	field.className = 'property-field';
	const labelElement = document.createElement('span');
	labelElement.className = 'property-label';
	labelElement.textContent = label;
	field.appendChild(labelElement);

	return field;
}

function sectionElement(title: string, fields: readonly HTMLElement[]): HTMLElement {
	const section = document.createElement('section');
	section.className = 'property-section';
	const heading = document.createElement('h2');
	heading.className = 'property-section-title';
	heading.textContent = title;
	section.appendChild(heading);
	section.append(...fields);

	return section;
}

function registerCommit(element: HTMLInputElement | HTMLTextAreaElement, commit: () => void): void {
	const initialValue = element.value;
	let lastCommittedValue = initialValue;
	element.addEventListener('change', () => {
		if (element.value !== lastCommittedValue) {
			lastCommittedValue = element.value;
			commit();
		}
	});
	element.addEventListener('keydown', (event) => {
		const keyboardEvent = event as KeyboardEvent;
		keyboardEvent.stopPropagation();
		if (keyboardEvent.key === 'Enter' && !(element instanceof HTMLTextAreaElement && keyboardEvent.shiftKey)) {
			keyboardEvent.preventDefault();
			element.blur();
		}
		if (keyboardEvent.key === 'Escape') {
			keyboardEvent.preventDefault();
			element.value = lastCommittedValue;
			element.blur();
		}
	});
}

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}
