import type { Cell } from '@maxgraph/core';

import type { CanvasElementType } from '../shared/canvas-editor-events';
import { isGraphCell } from './canvas-geometry-persistence';
import type { DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from './ontology-diagram-types';

export type CanvasPropertyElement =
	| { readonly kind: 'node'; readonly value: DiagramNode }
	| { readonly kind: 'note'; readonly value: DiagramNote }
	| { readonly kind: 'label'; readonly value: DiagramLabel }
	| { readonly kind: 'image'; readonly value: DiagramImage };

export class CanvasElementRegistry {
	private readonly nodes = new Map<string, DiagramNode>();
	private readonly notes = new Map<string, DiagramNote>();
	private readonly labels = new Map<string, DiagramLabel>();
	private readonly images = new Map<string, DiagramImage>();

	public constructor(payload: DiagramPayload) {
		for (const node of payload.diagram?.nodes ?? []) {
			this.nodes.set(node.id, node);
		}
		for (const note of payload.diagram?.notes ?? []) {
			this.notes.set(note.id, note);
		}
		for (const label of payload.diagram?.labels ?? []) {
			this.labels.set(label.id, label);
		}
		for (const image of payload.diagram?.images ?? []) {
			this.images.set(image.id, image);
		}
	}

	public renderedElementIdentifiers(): readonly string[] {
		return [
			...this.images.keys(),
			...this.nodes.keys(),
			...this.notes.keys(),
			...this.labels.keys(),
		];
	}

	public elementForCell(cell: Cell | null): CanvasPropertyElement | undefined {
		if (!isGraphCell(cell)) {
			return undefined;
		}

		const id = cell.getId();
		return id === null ? undefined : this.element(id);
	}

	public element(id: string): CanvasPropertyElement | undefined {
		const node = this.nodes.get(id);
		if (node !== undefined) {
			return { kind: 'node', value: node };
		}
		const note = this.notes.get(id);
		if (note !== undefined) {
			return { kind: 'note', value: note };
		}
		const label = this.labels.get(id);
		if (label !== undefined) {
			return { kind: 'label', value: label };
		}
		const image = this.images.get(id);
		if (image !== undefined) {
			return { kind: 'image', value: image };
		}

		return undefined;
	}

	public elementType(id: string): CanvasElementType | undefined {
		return this.element(id)?.kind;
	}
}
