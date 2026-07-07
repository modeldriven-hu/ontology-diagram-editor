import type { BoundsUpdate } from '../../../shared/canvas-geometry';
import type { CanvasElementType } from '../../../shared/canvas-editor-events';
import type { ElementStylePatch, StyledCanvasElementType } from '../../../shared/webview-commands';
import type { CanvasElementContentUpdate } from '../engine/diagram-canvas-engine';
import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';

export type CanvasPropertyElement =
	| { readonly kind: 'node'; readonly value: DiagramNode }
	| { readonly kind: 'edge'; readonly value: DiagramEdge }
	| { readonly kind: 'note'; readonly value: DiagramNote }
	| { readonly kind: 'label'; readonly value: DiagramLabel }
	| { readonly kind: 'image'; readonly value: DiagramImage };

export class CanvasElementRegistry {
	private readonly nodes = new Map<string, DiagramNode>();
	private readonly edges = new Map<string, DiagramEdge>();
	private readonly notes = new Map<string, DiagramNote>();
	private readonly labels = new Map<string, DiagramLabel>();
	private readonly images = new Map<string, DiagramImage>();

	public constructor(payload: DiagramPayload) {
		for (const node of payload.diagram?.nodes ?? []) {
			this.nodes.set(node.id, node);
		}
		for (const edge of payload.diagram?.edges ?? []) {
			this.edges.set(edge.id, edge);
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
			...this.edges.keys(),
			...this.nodes.keys(),
			...this.notes.keys(),
			...this.labels.keys(),
		];
	}

	public element(id: string): CanvasPropertyElement | undefined {
		const node = this.nodes.get(id);
		if (node !== undefined) {
			return { kind: 'node', value: node };
		}
		const edge = this.edges.get(id);
		if (edge !== undefined) {
			return { kind: 'edge', value: edge };
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

	public updateBounds(update: BoundsUpdate): void {
		const node = this.nodes.get(update.id);
		if (node !== undefined) {
			this.nodes.set(update.id, { ...node, ...update });
			return;
		}

		const note = this.notes.get(update.id);
		if (note !== undefined) {
			this.notes.set(update.id, { ...note, ...update });
			return;
		}

		const label = this.labels.get(update.id);
		if (label !== undefined) {
			this.labels.set(update.id, { ...label, ...update });
			return;
		}

		const image = this.images.get(update.id);
		if (image !== undefined) {
			this.images.set(update.id, { ...image, ...update });
		}
	}

	public updateContent(update: CanvasElementContentUpdate): void {
		if (update.kind === 'noteText') {
			const note = this.notes.get(update.id);
			if (note !== undefined) {
				this.notes.set(update.id, { ...note, text: update.text });
			}
			return;
		}

		if (update.kind === 'labelText') {
			const label = this.labels.get(update.id);
			if (label !== undefined) {
				this.labels.set(update.id, { ...label, text: update.text });
			}
			return;
		}

		if (update.kind === 'noteExport') {
			const note = this.notes.get(update.id);
			if (note !== undefined) {
				this.notes.set(update.id, { ...note, export: update.exported ? undefined : false });
			}
			return;
		}

		if (update.kind === 'imageSource') {
			const image = this.images.get(update.id);
			if (image !== undefined) {
				this.images.set(update.id, { ...image, source: update.source, webview_src: update.source });
			}
			return;
		}

		const node = this.nodes.get(update.id);
		if (node !== undefined) {
			if (update.kind === 'nodePropertyValueTextOverflow') {
				this.nodes.set(update.id, {
					...node,
					property_value_text_overflow: update.textOverflow === 'wrap' ? 'wrap' : undefined,
				});
				return;
			}

			this.nodes.set(update.id, { ...node, image: update.image });
		}
	}

	public updateStyle(elementType: StyledCanvasElementType, id: string, style: ElementStylePatch | undefined): void {
		if (elementType === 'node') {
			const node = this.nodes.get(id);
			if (node !== undefined) {
				this.nodes.set(id, { ...node, style });
			}
			return;
		}

		if (elementType === 'edge') {
			const edge = this.edges.get(id);
			if (edge !== undefined) {
				this.edges.set(id, { ...edge, style });
			}
			return;
		}

		if (elementType === 'note') {
			const note = this.notes.get(id);
			if (note !== undefined) {
				this.notes.set(id, { ...note, style });
			}
			return;
		}

		if (elementType === 'image') {
			const image = this.images.get(id);
			if (image !== undefined) {
				this.images.set(id, { ...image, style });
			}
			return;
		}

		const label = this.labels.get(id);
		if (label !== undefined) {
			this.labels.set(id, { ...label, style });
		}
	}

	public updateEdgeRouteLayout(id: string, routeLayout: DiagramEdge['route_layout']): void {
		const edge = this.edges.get(id);
		if (edge !== undefined) {
			this.edges.set(id, { ...edge, route_layout: routeLayout });
		}
	}
}
