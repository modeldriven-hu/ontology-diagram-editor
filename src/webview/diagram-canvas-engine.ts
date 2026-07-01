import type { BoundsUpdate, CanvasRoutePoint, EdgeRouteUpdate } from '../shared/canvas-geometry';
import type { DiagramPayload } from './ontology-diagram-types';
import type { WebviewTheme } from './webview-theme';

export type BoundsDragKind = 'move' | 'resize';

export interface CanvasBoundsChange {
	readonly dragKind: BoundsDragKind;
	readonly bounds: readonly BoundsUpdate[];
}

export type CanvasSelectionListener = () => void;
export type CanvasDoubleClickListener = (elementId: string) => boolean;
export type CanvasBoundsChangeListener = (change: CanvasBoundsChange) => void;
export type CanvasEdgeRouteChangeListener = (edgeIds: readonly string[]) => void;

export interface DiagramCanvasEngine {
	renderDiagram(payload: DiagramPayload, theme: WebviewTheme): void;
	selectedElementId(): string | undefined;
	selectElement(id: string): void;
	zoom(): number;
	restoreBounds(bounds: readonly BoundsUpdate[]): void;
	edgeRoute(edgeId: string, label: CanvasRoutePoint): EdgeRouteUpdate | undefined;
	onSelectionChanged(listener: CanvasSelectionListener): void;
	onElementDoubleClicked(listener: CanvasDoubleClickListener): void;
	onElementBoundsChanged(listener: CanvasBoundsChangeListener): void;
	onEdgeRouteChanged(listener: CanvasEdgeRouteChangeListener): void;
}
