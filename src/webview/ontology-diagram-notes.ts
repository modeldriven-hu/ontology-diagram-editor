import type { CellStyle } from '@maxgraph/core';
import { StickyNotePlus, createElement as createIconElement } from 'lucide';

import type { NoteBoundsUpdate } from '../shared/canvas-geometry';
import { escapeHtml } from '../shared/html';
import type { DiagramNote } from './ontology-diagram-types';
import type { DiagramVertex } from './ontology-diagram-nodes';
import type { WebviewTheme } from './webview-theme';

export interface NoteEditorControllerOptions {
	readonly addNoteButton: HTMLButtonElement;
	readonly noteEditor: HTMLFormElement;
	readonly noteEditorText: HTMLTextAreaElement;
	readonly saveNoteButton: HTMLButtonElement;
	readonly cancelNoteButton: HTMLButtonElement;
	readonly getNoteText: (noteId: string) => string | undefined;
	readonly createNote: (text: string) => void;
	readonly updateNoteText: (noteId: string, text: string) => void;
	readonly showStatus: (message: string) => void;
	readonly focusAfterClose: () => void;
}

export class NoteEditorController {
	private editingNoteId: string | undefined;

	public constructor(private readonly options: NoteEditorControllerOptions) {}

	public register(): void {
		this.options.addNoteButton.addEventListener('click', () => {
			this.open();
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

	public open(noteId?: string): void {
		this.editingNoteId = noteId;
		this.options.noteEditorText.value = noteId === undefined ? '' : this.options.getNoteText(noteId) ?? '';
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
			this.options.showStatus('Notes cannot be empty.');
			this.options.noteEditorText.focus();
			return;
		}

		if (this.editingNoteId === undefined) {
			this.options.createNote(text);
			this.closeAfterSave();
			return;
		}

		const currentText = this.options.getNoteText(this.editingNoteId) ?? '';
		if (text !== currentText) {
			this.options.updateNoteText(this.editingNoteId, text);
		}
		this.closeAfterSave();
	}

	private cancel(): void {
		this.editingNoteId = undefined;
		this.options.noteEditor.hidden = true;
		this.options.noteEditorText.value = '';
		this.options.focusAfterClose();
	}

	private closeAfterSave(): void {
		this.editingNoteId = undefined;
		this.options.noteEditor.hidden = true;
		this.options.noteEditorText.value = '';
		this.options.focusAfterClose();
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

export function renderNoteToolbarIcon(addNoteButton: HTMLButtonElement): void {
	addNoteButton.replaceChildren(createIconElement(StickyNotePlus, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
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

export function noteVertex(note: DiagramNote, theme: WebviewTheme): DiagramVertex {
	return {
		id: note.id,
		value: noteLabelHtml(note),
		position: [note.x, note.y],
		size: [note.width, note.height],
		style: noteStyle(note, theme),
	};
}

function noteStyle(note: DiagramNote, theme: WebviewTheme): CellStyle {
	const borderType = note.style?.border?.type;
	const borderWeight = note.style?.border?.weight;
	const style: CellStyle = {
		align: 'left',
		verticalAlign: 'top',
		whiteSpace: 'wrap',
		overflow: 'hidden',
		rounded: true,
		absoluteArcSize: true,
		arcSize: 6,
		spacing: 12,
		shadow: true,
		fillColor: note.style?.bg_color ?? '#fff4b8',
		fontColor: note.style?.text_color ?? '#3b2f00',
		fontFamily: note.style?.font?.family ?? theme.fontFamily,
		fontSize: note.style?.font?.size ?? theme.fontSize,
		strokeColor: note.style?.border?.color ?? '#d7b85d',
		strokeWidth: borderWeight ?? 1,
	};

	if (note.style?.font?.bold === true || note.style?.font?.italic === true) {
		style.fontStyle = (note.style.font.bold === true ? 1 : 0) + (note.style.font.italic === true ? 2 : 0);
	}
	if (borderType === 'dashed' || borderType === 'dotted') {
		style.dashed = true;
		style.dashPattern = borderType === 'dotted' ? '1 4' : '3 3';
	}
	if (borderType === 'none' || borderWeight === 0) {
		style.strokeColor = 'none';
		style.strokeWidth = 0;
	}

	return style;
}

function noteLabelHtml(note: DiagramNote): string {
	const text = escapeHtml(note.text).replaceAll('\n', '<br>');

	return `<div style="width:100%;height:100%;overflow:hidden;overflow-wrap:anywhere;white-space:normal;">${text}</div>`;
}
