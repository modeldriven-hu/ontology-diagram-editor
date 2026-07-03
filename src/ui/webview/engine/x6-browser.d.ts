export {};

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
	zoom(): number;
	on(eventName: string, listener: (event: Record<string, unknown>) => void): void;
}

export interface X6Cell {
	readonly id: string;
}

export interface X6Node extends X6Cell {
	position(): { readonly x: number; readonly y: number };
	position(x: number, y: number): void;
	size(): { readonly width: number; readonly height: number };
	resize(width: number, height: number): void;
	attr(path: string, value: unknown): void;
	attr(attrs: Record<string, unknown>): void;
}

export interface X6Edge extends X6Cell {
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
	setTools(tools?: unknown): X6Edge;
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
