import type { NoteBoundsUpdate } from '../../../shared/canvas-geometry';
import type { DiagramNote } from '../ontology-diagram-types';

export interface NoteEditorControllerOptions {
	readonly addNoteButton: HTMLButtonElement;
	readonly addLabelButton: HTMLButtonElement;
	readonly noteEditor: HTMLFormElement;
	readonly noteEditorText: HTMLTextAreaElement;
	readonly saveNoteButton: HTMLButtonElement;
	readonly cancelNoteButton: HTMLButtonElement;
	readonly getNoteText: (noteId: string) => string | undefined;
	readonly getLabelText: (labelId: string) => string | undefined;
	readonly createNote: (text: string) => void;
	readonly createLabel: (text: string) => void;
	readonly updateNoteText: (noteId: string, text: string) => void;
	readonly updateLabelText: (labelId: string, text: string) => void;
	readonly showStatus: (message: string) => void;
	readonly focusAfterClose: () => void;
}

export class NoteEditorController {
	private editingElement: TextEditingElement | undefined;

	public constructor(private readonly options: NoteEditorControllerOptions) {}

	public register(): void {
		this.options.addNoteButton.addEventListener('click', () => {
			this.open('note');
		});
		this.options.addLabelButton.addEventListener('click', () => {
			this.open('label');
		});
		this.options.noteEditor.addEventListener('submit', (event) => {
			event.preventDefault();
			this.save();
		});
		this.options.noteEditor.addEventListener('pointerdown', (event) => {
			event.stopPropagation();
		});
		this.options.noteEditor.addEventListener('dblclick', (event) => {
			event.stopPropagation();
		});
		this.options.noteEditor.addEventListener('keydown', (event) => {
			this.handleKeyDown(event);
		}, true);
		document.addEventListener('pointerdown', (event) => {
			this.handleDocumentPointerStart(event);
		}, true);
		document.addEventListener('mousedown', (event) => {
			this.handleDocumentPointerStart(event);
		}, true);
		this.options.noteEditor.addEventListener('focusout', () => {
			setTimeout(() => {
				this.saveIfFocusLeft();
			}, 0);
		});
		this.options.saveNoteButton.addEventListener('click', () => {
			this.save();
		});
		this.options.cancelNoteButton.addEventListener('click', () => {
			this.cancel();
		});
	}

	public open(kind: TextElementKind, id?: string): void {
		this.editingElement = { kind, id };
		this.options.noteEditorText.value = id === undefined ? '' : this.getCurrentText(kind, id);
		this.options.noteEditor.hidden = false;
		this.options.noteEditorText.focus();
		this.options.noteEditorText.select();
	}

	public isOpen(): boolean {
		return !this.options.noteEditor.hidden;
	}

	private save(): void {
		const text = this.options.noteEditorText.value;
		if (text.trim().length === 0) {
			this.options.showStatus(`${this.elementDisplayName()} cannot be empty.`);
			this.options.noteEditorText.focus();
			return;
		}

		const editingElement = this.editingElement;
		if (editingElement === undefined) {
			this.options.showStatus('No text element is being edited.');
			this.closeAfterSave();
			return;
		}

		if (editingElement.id === undefined) {
			this.createElement(editingElement.kind, text);
			this.closeAfterSave();
			return;
		}

		const currentText = this.getCurrentText(editingElement.kind, editingElement.id);
		if (text !== currentText) {
			this.updateElementText(editingElement.kind, editingElement.id, text);
		}
		this.closeAfterSave();
	}

	private cancel(): void {
		this.editingElement = undefined;
		this.options.noteEditor.hidden = true;
		this.options.noteEditorText.value = '';
		this.options.focusAfterClose();
	}

	private closeAfterSave(): void {
		this.editingElement = undefined;
		this.options.noteEditor.hidden = true;
		this.options.noteEditorText.value = '';
		this.options.focusAfterClose();
	}

	private getCurrentText(kind: TextElementKind, id: string): string {
		return kind === 'note'
			? this.options.getNoteText(id) ?? ''
			: this.options.getLabelText(id) ?? '';
	}

	private createElement(kind: TextElementKind, text: string): void {
		if (kind === 'note') {
			this.options.createNote(text);
			return;
		}

		this.options.createLabel(text);
	}

	private updateElementText(kind: TextElementKind, id: string, text: string): void {
		if (kind === 'note') {
			this.options.updateNoteText(id, text);
			return;
		}

		this.options.updateLabelText(id, text);
	}

	private elementDisplayName(): string {
		return this.editingElement?.kind === 'label' ? 'Labels' : 'Notes';
	}

	private handleKeyDown(event: KeyboardEvent): void {
		event.stopImmediatePropagation();
		if (event.key === 'Escape') {
			event.preventDefault();
			this.cancel();
		}
	}

	private handleDocumentPointerStart(event: PointerEvent | MouseEvent): void {
		if (!this.isOpen() || this.options.noteEditor.contains(event.target as Node | null)) {
			return;
		}

		this.save();
	}

	private saveIfFocusLeft(): void {
		if (!this.isOpen() || this.options.noteEditor.contains(document.activeElement)) {
			return;
		}

		this.save();
	}
}

type TextElementKind = 'note' | 'label';

interface TextEditingElement {
	readonly kind: TextElementKind;
	readonly id?: string;
}

export function renderNoteToolbarIcon(addNoteButton: HTMLButtonElement): void {
	addNoteButton.replaceChildren(noteIcon());
}

function noteIcon(): SVGSVGElement {
	const svg = svgElement('svg');
	svg.setAttribute('aria-hidden', 'true');
	svg.setAttribute('class', 'canvas-action-icon');
	svg.setAttribute('viewBox', '0 0 24 24');
	svg.append(
		svgElement('path', {
			d: 'M5 4h10l4 4v12H5z',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linejoin': 'round',
		}),
		svgElement('path', {
			d: 'M15 4v5h5',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linejoin': 'round',
		}),
		svgElement('path', {
			d: 'M8 12h8M8 15h6',
			fill: 'none',
			stroke: 'currentColor',
			'stroke-width': '2',
			'stroke-linecap': 'round',
		}),
	);

	return svg;
}

function svgElement(tagName: 'svg'): SVGSVGElement;
function svgElement(tagName: string, attributes: Record<string, string>): SVGElement;
function svgElement(tagName: string, attributes?: Record<string, string>): SVGElement {
	const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
	for (const [name, value] of Object.entries(attributes ?? {})) {
		element.setAttribute(name, value);
	}

	return element;
}

export function noteBounds(note: DiagramNote): NoteBoundsUpdate {
	return {
		id: note.id,
		x: note.x,
		y: note.y,
		width: note.width,
		height: note.height,
	};
}
