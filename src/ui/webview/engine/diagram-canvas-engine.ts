import type { BoundsUpdate, CanvasPoint, EdgeRouteUpdate } from '../../../shared/canvas-geometry';
import type { DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';

export type BoundsDragKind = 'move' | 'resize';

export interface CanvasBoundsChange {
	readonly dragKind: BoundsDragKind;
	readonly bounds: readonly BoundsUpdate[];
}

export type CanvasSelectionListener = () => void;
export type CanvasDoubleClickListener = (elementId: string) => boolean;
export type CanvasBoundsChangeListener = (change: CanvasBoundsChange) => void;
export type CanvasEdgeRouteChangeListener = (edgeIds: readonly string[]) => void;
export type CanvasElementContentUpdate =
	| { readonly kind: 'nodeImage'; readonly id: string; readonly image?: string }
	| { readonly kind: 'imageSource'; readonly id: string; readonly source: string }
	| { readonly kind: 'noteText'; readonly id: string; readonly text: string }
	| { readonly kind: 'labelText'; readonly id: string; readonly text: string };

export interface DiagramCanvasEngine {
	renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void;
	selectedElementId(): string | undefined;
	selectElement(id: string): void;
	zoom(): number;
	setZoom(zoom: number): void;
	resize(width: number, height: number): void;
	restoreBounds(bounds: readonly BoundsUpdate[]): void;
	updateElementContent(update: CanvasElementContentUpdate): void;
	edgeRoute(edgeId: string, label: CanvasPoint): EdgeRouteUpdate | undefined;
	nudgeEdgeLabel(edgeId: string, delta: CanvasPoint): boolean;
	resetEdgeLabel(edgeId: string): void;
	onSelectionChanged(listener: CanvasSelectionListener): void;
	onElementDoubleClicked(listener: CanvasDoubleClickListener): void;
	onElementBoundsChanged(listener: CanvasBoundsChangeListener): void;
	onEdgeRouteChanged(listener: CanvasEdgeRouteChangeListener): void;
}
