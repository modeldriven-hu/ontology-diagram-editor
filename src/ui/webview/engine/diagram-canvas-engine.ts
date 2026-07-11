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
	| { readonly kind: 'nodePropertyValueTextOverflow'; readonly id: string; readonly textOverflow: 'truncate' | 'wrap' }
	| { readonly kind: 'noteExport'; readonly id: string; readonly exported: boolean }
	| { readonly kind: 'noteText'; readonly id: string; readonly text: string }
	| { readonly kind: 'labelText'; readonly id: string; readonly text: string };

export interface DiagramCanvasEngine {
	renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void;
	selectedElementId(): string | undefined;
	selectedElementIds(): readonly string[];
	selectElement(id: string): void;
	selectElements(ids: readonly string[]): void;
	zoom(): number;
	setZoom(zoom: number): void;
	resize(width: number, height: number): void;
	restoreBounds(bounds: readonly BoundsUpdate[]): void;
	resizeElement(id: string, width: number, height: number): boolean;
	updateElementContent(update: CanvasElementContentUpdate): void;
	nudgeElement(id: string, delta: CanvasPoint): boolean;
	nudgeSelectedElements(delta: CanvasPoint): boolean;
	edgeRoute(edgeId: string, label: CanvasPoint): EdgeRouteUpdate | undefined;
	nudgeEdgeLabel(edgeId: string, delta: CanvasPoint): boolean;
	nudgeEdgeRoute(edgeId: string, delta: CanvasPoint): boolean;
	resetEdgeLabel(edgeId: string): void;
	onSelectionChanged(listener: CanvasSelectionListener): void;
	onElementDoubleClicked(listener: CanvasDoubleClickListener): void;
	onElementBoundsChanged(listener: CanvasBoundsChangeListener): void;
	onEdgeRouteChanged(listener: CanvasEdgeRouteChangeListener): void;
}
