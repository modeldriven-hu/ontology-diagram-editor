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
	getSourcePoint(): { readonly x: number; readonly y: number };
	getTargetPoint(): { readonly x: number; readonly y: number };
	getVertices(): unknown[];
	getPolyline(): { readonly points: readonly { readonly x: number; readonly y: number }[] };
	removeTools(): void;
	setTools(tools?: unknown): X6Edge;
}
