export {};

import type { CanvasPoint } from '../../../shared/canvas-geometry';

declare global {
	interface Window {
		X6?: X6BrowserApi;
	}
}

export interface X6BrowserApi {
	readonly Graph: new (options: Record<string, unknown>) => X6Graph;
	readonly Node: new (...args: unknown[]) => X6Node;
	readonly Selection: new (options?: Record<string, unknown>) => unknown;
	readonly Transform: new (options?: Record<string, unknown>) => unknown;
}

export interface X6Graph {
	addNode(metadata: Record<string, unknown>): X6Node;
	addEdge(metadata: Record<string, unknown>): X6Edge;
	clearCells(): void;
	findViewByCell?(cell: X6Cell | string): unknown;
	getCellById(id: string): X6Cell | undefined;
	createTransformWidget?: (node: X6Node) => void;
	clearTransformWidgets?: () => void;
	getPlugin?(name: string): unknown;
	use(plugin: unknown): void;
	cleanSelection?(options?: Record<string, unknown>): X6Graph;
	resetSelection?(cells?: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): X6Graph;
	select?(cells: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): X6Graph;
	unselect?(cells: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): X6Graph;
	zoom(): number;
	zoom(factor: number, options?: {
		readonly absolute?: boolean;
		readonly minScale?: number;
		readonly maxScale?: number;
		readonly center?: { readonly x: number; readonly y: number };
	}): X6Graph;
	resize(width?: number, height?: number): X6Graph;
	translate(tx: number, ty: number): X6Graph;
	on(eventName: string, listener: (event: Record<string, unknown>) => void): void;
}

export interface X6Cell {
	readonly id: string;
}

export interface X6SelectionPlugin {
	clean(options?: Record<string, unknown>): unknown;
	reset(cells?: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): unknown;
	select(cells: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): unknown;
	unselect(cells: X6Cell | string | (X6Cell | string)[], options?: Record<string, unknown>): unknown;
	isSelected(cell: X6Cell | string): boolean;
	getSelectedCells(): X6Cell[];
}

export interface X6Node extends X6Cell {
	position(): { readonly x: number; readonly y: number };
	position(x: number, y: number): void;
	size(): { readonly width: number; readonly height: number };
	resize(width: number, height: number): void;
	attr(path: string): unknown;
	attr(path: string, value: unknown): void;
	attr(attrs: Record<string, unknown>): void;
}

export interface X6Edge extends X6Cell {
	attr(path: string): unknown;
	attr(path: string, value: unknown): void;
	attr(attrs: Record<string, unknown>): void;
	getLabels(): readonly X6EdgeLabel[];
	getSource(): X6Terminal;
	getSourcePoint(): { readonly x: number; readonly y: number };
	getTarget(): X6Terminal;
	getTargetPoint(): { readonly x: number; readonly y: number };
	getVertices(): unknown[];
	getPolyline(): { readonly points: readonly { readonly x: number; readonly y: number }[] };
	removeTools(): void;
	setLabelAt(index: number, label: X6EdgeLabel, options?: Record<string, unknown>): X6Edge;
	setSource(source: X6Terminal, options?: Record<string, unknown>): X6Edge;
	setTarget(target: X6Terminal, options?: Record<string, unknown>): X6Edge;
	setTools(tools?: unknown): X6Edge;
	setVertices(vertices: readonly CanvasPoint[], options?: Record<string, unknown>): X6Edge;
}

export interface X6Terminal {
	readonly cell?: string | X6Cell;
	readonly x?: number;
	readonly y?: number;
	readonly anchor?: {
		readonly name?: string;
		readonly args?: Record<string, unknown>;
	};
}

export interface X6EdgeView {
	readonly routePoints?: readonly { readonly x: number; readonly y: number }[];
	getLabelPosition(x: number, y: number, options?: Record<string, unknown> | null): X6LabelPosition;
	getLabelPosition(x: number, y: number, angle: number, options?: Record<string, unknown> | null): X6LabelPosition;
	getTerminalConnectionPoint(type: 'source' | 'target'): { readonly x: number; readonly y: number };
	getLabelTransformationMatrix(labelPosition: X6LabelPosition): DOMMatrix;
}

export interface X6EdgeLabel {
	readonly position?: X6LabelPosition;
}

export type X6LabelPosition = number | {
	readonly distance: number;
	readonly offset?: number | {
		readonly x?: number;
		readonly y?: number;
	};
	readonly angle?: number;
	readonly options?: Record<string, unknown>;
};
