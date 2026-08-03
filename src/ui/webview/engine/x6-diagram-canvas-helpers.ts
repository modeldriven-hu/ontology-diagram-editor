import type { BoundsUpdate, CanvasPoint, EdgeRouteUpdate } from '../../../shared/canvas-geometry';
import type { CanvasElementRegistry, CanvasPropertyElement } from '../components/canvas-element-registry';
import type { DiagramEdge, DiagramImage, DiagramNode, DiagramNote } from '../ontology-diagram-types';
import type { X6Cell, X6Edge, X6EdgeView, X6Graph, X6LabelPosition, X6Node, X6SelectionPlugin } from './x6-browser';
import { plainPresentationText } from '../components/presentation/diagram-presentation';

type ConnectableElement = Pick<DiagramNode | DiagramNote | DiagramImage, 'id' | 'x' | 'y' | 'width' | 'height'>;

export function normalizedRoutePoints(edge: X6Edge, view: X6EdgeView | undefined): readonly CanvasPoint[] {
	if (view !== undefined) {
		return withoutRedundantPoints([
			canvasPoint(view.getTerminalConnectionPoint('source')),
			...(view.routePoints ?? []).map(canvasPoint),
			canvasPoint(view.getTerminalConnectionPoint('target')),
		]);
	}

	return withoutRedundantPoints([
		canvasPoint(edge.getSourcePoint()),
		...edge.getVertices().flatMap((point) => isPointLike(point) ? [canvasPoint(point)] : []),
		canvasPoint(edge.getTargetPoint()),
	]);
}

export function edgeLabelPoint(edge: X6Edge, view: X6EdgeView | undefined, sourcePoint: CanvasPoint): CanvasPoint | undefined {
	return edgeLabelPointAt(edge, 0, view, sourcePoint);
}

export function edgeLabelPointAt(edge: X6Edge, index: number, view: X6EdgeView | undefined, sourcePoint: CanvasPoint): CanvasPoint | undefined {
	const labelPositionValue = edge.getLabels()[index]?.position;
	const labelPosition = normalizeLabelPosition(labelPositionValue);
	if (labelPosition === undefined) {
		return undefined;
	}

	const absoluteOffsetPoint = absoluteOffsetLabelPoint(labelPosition, sourcePoint);
	if (absoluteOffsetPoint !== undefined) {
		return absoluteOffsetPoint;
	}

	if (view === undefined) {
		return undefined;
	}

	const matrix = view.getLabelTransformationMatrix(labelPosition);
	return canvasPoint({
		x: matrix.e,
		y: matrix.f,
	});
}

export function normalizeLabelPosition(position: X6LabelPosition | undefined): X6LabelPosition | undefined {
	return position === undefined ? undefined : position;
}

export function absoluteOffsetLabelPoint(position: X6LabelPosition, sourcePoint: CanvasPoint): CanvasPoint | undefined {
	if (typeof position === 'number') {
		return undefined;
	}

	const offset = position.offset;
	if (position.distance !== 0 || typeof offset !== 'object' || offset === null || position.options?.absoluteDistance !== true || position.options.absoluteOffset !== true) {
		return undefined;
	}

	return canvasPoint({
		x: sourcePoint.x + (offset.x ?? 0),
		y: sourcePoint.y + (offset.y ?? 0),
	});
}

export function canvasPoint(point: { readonly x: number; readonly y: number }): CanvasPoint {
	return {
		x: Math.max(0, Math.round(point.x)),
		y: Math.max(0, Math.round(point.y)),
	};
}

export function isPointLike(value: unknown): value is { readonly x: number; readonly y: number } {
	return typeof value === 'object'
		&& value !== null
		&& 'x' in value
		&& 'y' in value
		&& typeof value.x === 'number'
		&& typeof value.y === 'number';
}

export function withoutRedundantPoints(points: readonly CanvasPoint[]): readonly CanvasPoint[] {
	const unique = points.filter((point, index) => {
		const previous = points[index - 1];
		return previous === undefined || previous.x !== point.x || previous.y !== point.y;
	});
	if (unique.length < 3) {
		return unique;
	}

	return unique.filter((point, index) => {
		const previous = unique[index - 1];
		const next = unique[index + 1];
		return previous === undefined
			|| next === undefined
			|| !(previous.x === point.x && point.x === next.x)
				&& !(previous.y === point.y && point.y === next.y);
	});
}

export function boundsUpdate(node: X6Node): BoundsUpdate {
	const position = node.position();
	const size = node.size();

	return {
		id: node.id,
		x: Math.max(0, Math.round(position.x)),
		y: Math.max(0, Math.round(position.y)),
		width: Math.round(size.width),
		height: Math.round(size.height),
	};
}

export function elementRegistryEdges(registry: CanvasElementRegistry): readonly DiagramEdge[] {
	return registry.renderedElementIdentifiers().flatMap((id) => {
		const element = registry.element(id);
		return element?.kind === 'edge' ? [element.value] : [];
	});
}

export function connectableElement(element: CanvasPropertyElement | undefined): ConnectableElement | undefined {
	return element?.kind === 'node' || element?.kind === 'note' || element?.kind === 'image'
		? element.value
		: undefined;
}

export function movedElementDelta(element: ConnectableElement, update: BoundsUpdate | undefined): CanvasPoint | undefined {
	if (update === undefined || update.width !== element.width || update.height !== element.height) {
		return undefined;
	}

	return {
		x: update.x - element.x,
		y: update.y - element.y,
	};
}

export function translateConnectableElement(element: ConnectableElement, delta: CanvasPoint): ConnectableElement {
	return {
		...element,
		x: element.x + delta.x,
		y: element.y + delta.y,
	};
}

export function translateCanvasPoint(point: CanvasPoint, delta: CanvasPoint): CanvasPoint {
	return {
		x: point.x + delta.x,
		y: point.y + delta.y,
	};
}

export function boundedEdgeVerticalDelta(
	route: EdgeRouteUpdate,
	sourceElement: ConnectableElement,
	targetElement: ConnectableElement,
	deltaY: number,
): CanvasPoint {
	const firstPoint = route.points[0];
	const lastPoint = route.points[route.points.length - 1];
	const minimumDeltaY = Math.max(
		...route.points.map((point) => -point.y),
		sourceElement.y - firstPoint.y,
		targetElement.y - lastPoint.y,
	);
	const maximumDeltaY = Math.min(
		sourceElement.y + sourceElement.height - firstPoint.y,
		targetElement.y + targetElement.height - lastPoint.y,
	);

	return {
		x: 0,
		y: Math.round(Math.min(Math.max(deltaY, minimumDeltaY), maximumDeltaY)),
	};
}

export function canvasPointsEqual(left: CanvasPoint, right: CanvasPoint): boolean {
	return left.x === right.x && left.y === right.y;
}

export function eventNode(event: Record<string, unknown>): X6Node | undefined {
	return isX6Node(event.node) ? event.node : undefined;
}

export function eventEdge(event: Record<string, unknown>): X6Edge | undefined {
	if (isX6Edge(event.edge)) {
		return event.edge;
	}

	return isX6Edge(event.cell) ? event.cell : undefined;
}

export function isX6Node(value: unknown): value is X6Node {
	return typeof value === 'object'
		&& value !== null
		&& 'id' in value
		&& 'position' in value
		&& 'size' in value
		&& 'resize' in value;
}

export function isX6Edge(value: unknown): value is X6Edge {
	return typeof value === 'object'
		&& value !== null
		&& 'id' in value
		&& 'attr' in value
		&& 'getSourcePoint' in value
		&& 'getTargetPoint' in value
		&& 'getPolyline' in value;
}

export function objectKeys(value: unknown): readonly string[] {
	return typeof value === 'object' && value !== null ? Object.keys(value) : [];
}

export function cloneJsonCompatible(value: unknown): unknown {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export function numberValue(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function edgeView(graph: X6Graph, edge: X6Edge): X6EdgeView | undefined {
	const view = graph.findViewByCell?.(edge);
	return isX6EdgeView(view) ? view : undefined;
}

export function isX6EdgeView(value: unknown): value is X6EdgeView {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { getTerminalConnectionPoint?: unknown }).getTerminalConnectionPoint === 'function';
}

export function createTransformWidget(graph: X6Graph, node: X6Node): void {
	if (typeof graph.createTransformWidget === 'function') {
		graph.createTransformWidget(node);
		return;
	}

	const transform = graph.getPlugin?.('transform');
	if (isTransformPlugin(transform)) {
		transform.createWidget(node);
		return;
	}

	console.warn('[ontology-diagram-editor] x6 transform create API unavailable', { nodeId: node.id });
}

export function clearTransformWidgets(graph: X6Graph): void {
	if (typeof graph.clearTransformWidgets === 'function') {
		graph.clearTransformWidgets();
		return;
	}

	const transform = graph.getPlugin?.('transform');
	if (isTransformPlugin(transform)) {
		transform.clearWidgets();
		return;
	}

	console.warn('[ontology-diagram-editor] x6 transform clear API unavailable');
}

export function isTransformPlugin(value: unknown): value is { clearWidgets: () => void; createWidget: (node: X6Node) => void } {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { clearWidgets?: unknown }).clearWidgets === 'function'
		&& typeof (value as { createWidget?: unknown }).createWidget === 'function';
}

export function eventSelectedIds(event: Record<string, unknown>): readonly string[] {
	const selected = event.selected;
	if (!Array.isArray(selected)) {
		return [];
	}

	return selected.flatMap((cell) => isX6Node(cell) || isX6Edge(cell) ? [cell.id] : []);
}

export function clickedElementSelectionIds(currentIds: readonly string[], id: string, event: unknown): readonly string[] {
	if (!isAdditiveSelectionEvent(event)) {
		return [id];
	}

	return currentIds.includes(id)
		? currentIds.filter((currentId) => currentId !== id)
		: [...currentIds, id];
}

export function isAdditiveSelectionEvent(event: unknown): boolean {
	if (event instanceof MouseEvent) {
		return event.ctrlKey || event.metaKey || event.shiftKey;
	}
	if (typeof event !== 'object' || event === null) {
		return false;
	}

	const keyboardState = event as { readonly ctrlKey?: unknown; readonly metaKey?: unknown; readonly shiftKey?: unknown };
	return keyboardState.ctrlKey === true || keyboardState.metaKey === true || keyboardState.shiftKey === true;
}

export function resetSelection(graph: X6Graph, ids: readonly string[]): void {
	if (ids.length === 0) {
		if (typeof graph.cleanSelection === 'function') {
			graph.cleanSelection({ batch: true });
			return;
		}

		const selection = graph.getPlugin?.('selection');
		if (isSelectionPlugin(selection)) {
			selection.clean({ batch: true });
			return;
		}
	}

	if (typeof graph.resetSelection === 'function') {
		graph.resetSelection([...ids], { batch: true });
		return;
	}

	const selection = graph.getPlugin?.('selection');
	if (isSelectionPlugin(selection)) {
		selection.reset([...ids], { batch: true });
		return;
	}

	console.warn('[ontology-diagram-editor] x6 selection reset API unavailable');
}

export function isSelectionPlugin(value: unknown): value is X6SelectionPlugin {
	return typeof value === 'object'
		&& value !== null
		&& typeof (value as { reset?: unknown }).reset === 'function'
		&& typeof (value as { clean?: unknown }).clean === 'function';
}

export function cellViewCell(value: unknown): unknown {
	return typeof value === 'object' && value !== null && 'cell' in value
		? (value as { readonly cell?: unknown }).cell
		: undefined;
}

export function uniqueElementIds(ids: readonly string[]): readonly string[] {
	return [...new Set(ids)];
}

export function stringArraysEqual(left: readonly string[], right: readonly string[]): boolean {
	return left.length === right.length && left.every((value, index) => value === right[index]);
}

export function isMovableCanvasElement(kind: string | undefined): boolean {
	return kind === 'node' || kind === 'note' || kind === 'image' || kind === 'label' || kind === 'link';
}

export function boundedGroupDelta(cells: readonly X6Node[], delta: CanvasPoint): CanvasPoint {
	if (cells.length === 0) {
		return { x: 0, y: 0 };
	}

	const minX = Math.min(...cells.map((cell) => cell.position().x));
	const minY = Math.min(...cells.map((cell) => cell.position().y));

	return {
		x: delta.x < 0 ? Math.max(delta.x, -minX) : delta.x,
		y: delta.y < 0 ? Math.max(delta.y, -minY) : delta.y,
	};
}

export function boundsDifferFromRegistry(update: BoundsUpdate, registry: CanvasElementRegistry): boolean {
	const element = registry.element(update.id);
	if (element === undefined || element.kind === 'edge') {
		return false;
	}

	return update.x !== element.value.x
		|| update.y !== element.value.y
		|| update.width !== element.value.width
		|| update.height !== element.value.height;
}

export function stopEvent(value: unknown): void {
	if (typeof value === 'object' && value !== null) {
		const event = value as { preventDefault?: () => void; stopPropagation?: () => void };
		event.preventDefault?.();
		event.stopPropagation?.();
	}
}

export function plainText(value: string): string {
	return plainPresentationText(value);
}
