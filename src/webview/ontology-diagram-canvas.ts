import { Graph, HandleConfig, InternalEvent, Rectangle, StyleDefaultsConfig, VertexHandlerConfig, type Cell, type CellStyle, type EventObject, type SelectionHandler } from '@maxgraph/core';

import { getOntologyItemIcon, isOntologyItemType } from '../model-tree/ontology-item-icons';
import { minimumNodeHeight, minimumNodeWidth, type NodeBoundsUpdate } from '../shared/canvas-geometry';
import { escapeHtml } from '../shared/html';
import { readTheme } from './webview-theme';

declare const acquireVsCodeApi: () => {
	postMessage(message: WebviewMessage): void;
};

declare global {
	interface Window {
		ontologyDiagramEditorConfig?: WebviewConfig;
	}
}

interface CanvasPoint {
	readonly x: number;
	readonly y: number;
}

type WebviewMessage = CreateNodeMessage | UpdateNodeBoundsMessage;

interface CreateNodeMessage {
	readonly type: 'createNode';
	readonly payload?: ModelTreeItemDraggedEvent;
	readonly position: CanvasPoint;
}

interface UpdateNodeBoundsMessage {
	readonly type: 'updateNodeBounds';
	readonly updates: readonly NodeBoundsUpdate[];
}

interface ModelTreeItemDraggedEvent {
	readonly ontologyItemType: string;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
}

interface WebviewConfig {
	readonly payload: DiagramPayload;
	readonly modelTreeDragMimeType: string;
}

interface DiagramPayload {
	readonly diagram?: {
		readonly nodes?: readonly DiagramNode[];
	};
	readonly error?: string;
}

interface DiagramNode {
	readonly id: string;
	readonly ontology_ref: string;
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly ontology_item_type?: string;
	readonly style?: DiagramNodeStyle;
}

interface DiagramNodeStyle {
	readonly bg_color?: string;
	readonly text_color?: string;
	readonly font?: {
		readonly family?: string;
		readonly bold?: boolean;
		readonly italic?: boolean;
		readonly size?: number;
	};
	readonly border?: {
		readonly type?: 'solid' | 'dashed' | 'dotted' | 'none';
		readonly weight?: number;
		readonly color?: string;
	};
}

const config = window.ontologyDiagramEditorConfig;

if (config === undefined) {
	throw new Error('Missing ontology diagram webview configuration.');
}

const vscode = acquireVsCodeApi();
const nodeCapableTypes = new Set(['class', 'individual', 'datatype']);
const canvasScroll = requiredElement('canvasScroll');
const canvasContent = requiredElement('canvasContent');
const status = requiredElement('status');
const theme = readTheme();
const graph = new Graph(canvasContent);
const persistedNodeBounds = new Map<string, NodeBoundsUpdate>();
let suppressGeometryPersistence = false;

configureGraph(graph);
render();
registerDropHandlers();
registerGeometryHandlers();

function configureGraph(graph: Graph): void {
	VertexHandlerConfig.selectionColor = theme.focusBorder;
	VertexHandlerConfig.selectionStrokeWidth = 2;
	VertexHandlerConfig.selectionDashed = false;
	VertexHandlerConfig.cursorMovable = 'move';
	HandleConfig.fillColor = theme.editorBackground;
	HandleConfig.strokeColor = theme.focusBorder;
	HandleConfig.size = 7;
	StyleDefaultsConfig.shadowColor = theme.shadowColor;
	StyleDefaultsConfig.shadowOffsetX = 0;
	StyleDefaultsConfig.shadowOffsetY = 2;
	StyleDefaultsConfig.shadowOpacity = 0.18;

	const selectionHandler = graph.getPlugin<SelectionHandler>('SelectionHandler');
	if (selectionHandler !== undefined) {
		selectionHandler.previewColor = theme.focusBorder;
	}

	graph.setHtmlLabels(true);
	graph.setPanning(true);
	graph.setCellsCloneable(false);
	graph.setCellsDeletable(false);
	graph.setCellsDisconnectable(false);
	graph.setConnectable(false);
	graph.setTooltips(true);
	graph.setCellsResizable(true);
	graph.setCellsMovable(true);
}

function render(): void {
	if (config?.payload.error !== undefined) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement('error-state', config.payload.error));
		return;
	}

	const nodes = config?.payload.diagram?.nodes ?? [];
	if (nodes.length === 0) {
		canvasContent.textContent = '';
		canvasContent.appendChild(messageElement(
			'empty-state',
			'Drag a class, individual, or datatype from the model tree, then hold Shift while dropping it here.',
		));
		return;
	}

	graph.batchUpdate(() => {
		for (const node of nodes) {
			persistedNodeBounds.set(node.id, {
				id: node.id,
				x: node.x,
				y: node.y,
				width: node.width,
				height: node.height,
			});
			graph.insertVertex({
				parent: graph.getDefaultParent(),
				id: node.id,
				value: nodeLabelHtml(node),
				position: [node.x, node.y],
				size: [node.width, node.height],
				style: nodeStyle(node),
			});
		}
	});
}

function registerGeometryHandlers(): void {
	graph.addListener(InternalEvent.CELLS_MOVED, (_sender: unknown, event: EventObject) => {
		persistChangedNodeBounds(event.getProperty('cells'));
	});
	graph.addListener(InternalEvent.CELLS_RESIZED, (_sender: unknown, event: EventObject) => {
		persistChangedNodeBounds(event.getProperty('cells'));
	});
}

function persistChangedNodeBounds(cells: unknown): void {
	if (suppressGeometryPersistence || !Array.isArray(cells)) {
		return;
	}

	const updates = cells
		.map((cell: unknown) => nodeBoundsUpdate(cell))
		.filter((update): update is NodeBoundsUpdate => update !== undefined);
	if (updates.length === 0) {
		return;
	}

	const invalidUpdate = updates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
	if (invalidUpdate !== undefined) {
		restorePersistedBounds(updates);
		showStatus(`Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.`);
		return;
	}

	for (const update of updates) {
		persistedNodeBounds.set(update.id, update);
	}
	vscode.postMessage({
		type: 'updateNodeBounds',
		updates,
	});
}

function nodeBoundsUpdate(cell: unknown): NodeBoundsUpdate | undefined {
	if (!isGraphCell(cell)) {
		return undefined;
	}

	const id = cell.getId();
	const geometry = cell.getGeometry();
	if (id === null || geometry === null || !persistedNodeBounds.has(id)) {
		return undefined;
	}

	return {
		id,
		x: Math.max(0, Math.round(geometry.x)),
		y: Math.max(0, Math.round(geometry.y)),
		width: Math.round(geometry.width),
		height: Math.round(geometry.height),
	};
}

function restorePersistedBounds(updates: readonly NodeBoundsUpdate[]): void {
	suppressGeometryPersistence = true;
	try {
		for (const update of updates) {
			const persistedBounds = persistedNodeBounds.get(update.id);
			const cell = graph.getDataModel().getCell(update.id);
			if (persistedBounds !== undefined && cell !== null) {
				graph.resizeCell(
					cell,
					new Rectangle(
						persistedBounds.x,
						persistedBounds.y,
						persistedBounds.width,
						persistedBounds.height,
					),
				);
			}
		}
	} finally {
		suppressGeometryPersistence = false;
	}
}

function isGraphCell(value: unknown): value is Cell {
	return typeof value === 'object'
		&& value !== null
		&& 'getId' in value
		&& 'getGeometry' in value;
}

function nodeStyle(node: DiagramNode): CellStyle {
	const borderType = node.style?.border?.type;
	const borderWeight = node.style?.border?.weight;
	const style: CellStyle = {
		align: 'center',
		verticalAlign: 'middle',
		whiteSpace: 'wrap',
		overflow: 'hidden',
		rounded: true,
		absoluteArcSize: true,
		arcSize: 8,
		spacing: 10,
		shadow: true,
		fillColor: node.style?.bg_color ?? theme.nodeBackground,
		fontColor: node.style?.text_color ?? theme.editorForeground,
		fontFamily: node.style?.font?.family ?? theme.fontFamily,
		fontSize: node.style?.font?.size ?? theme.fontSize,
		strokeColor: node.style?.border?.color ?? theme.nodeBorder,
		strokeWidth: borderWeight ?? 1,
	};

	if (node.style?.font?.bold === true || node.style?.font?.italic === true) {
		style.fontStyle = (node.style.font.bold === true ? 1 : 0) + (node.style.font.italic === true ? 2 : 0);
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

function nodeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}

function nodeLabelHtml(node: DiagramNode): string {
	const displayName = escapeHtml(nodeDisplayName(node.ontology_ref));
	if (node.ontology_item_type === undefined || !isOntologyItemType(node.ontology_item_type)) {
		return displayName;
	}

	const icon = getOntologyItemIcon(node.ontology_item_type);

	return [
		'<span style="display:inline-flex;align-items:center;justify-content:center;gap:8px;max-width:100%;min-width:0;">',
		`<span style="display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:18px;height:18px;border-radius:4px;border:1px solid ${escapeHtml(theme.nodeBorder)};background:${escapeHtml(theme.iconBackground)};color:${escapeHtml(theme.focusBorder)};font-size:11px;font-weight:600;line-height:1;">${escapeHtml(icon.canvasGlyph)}</span>`,
		`<span style="display:block;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${displayName}</span>`,
		'</span>',
	].join('');
}

function registerDropHandlers(): void {
	canvasScroll.addEventListener('dragover', (event) => {
		event.preventDefault();
		if (event.dataTransfer !== null) {
			event.dataTransfer.dropEffect = 'copy';
		}
		canvasScroll.classList.add('drop-active');
		canvasScroll.classList.remove('drop-rejected');
	});

	canvasScroll.addEventListener('dragleave', (event) => {
		if (event.relatedTarget instanceof Node && canvasScroll.contains(event.relatedTarget)) {
			return;
		}

		canvasScroll.classList.remove('drop-active', 'drop-rejected');
	});

	canvasScroll.addEventListener('drop', (event) => {
		event.preventDefault();
		canvasScroll.classList.remove('drop-active', 'drop-rejected');

		const dragPayload = readDragPayload(event.dataTransfer);
		if (dragPayload !== undefined && !nodeCapableTypes.has(dragPayload.ontologyItemType)) {
			canvasScroll.classList.add('drop-rejected');
			showStatus('Only classes, individuals, and datatypes can create nodes for now.');
			return;
		}

		const rect = canvasContent.getBoundingClientRect();
		vscode.postMessage({
			type: 'createNode',
			payload: dragPayload,
			position: {
				x: Math.max(0, event.clientX - rect.left),
				y: Math.max(0, event.clientY - rect.top),
			},
		});
	});
}

function readDragPayload(dataTransfer: DataTransfer | null): ModelTreeItemDraggedEvent | undefined {
	if (dataTransfer === null) {
		return undefined;
	}

	const raw = dataTransfer.getData(config?.modelTreeDragMimeType ?? '')
		|| dataTransfer.getData('application/vnd.code.tree.ontology-diagram-editor.model-tree')
		|| dataTransfer.getData('text/plain');
	if (raw.length === 0) {
		return undefined;
	}

	try {
		return JSON.parse(raw) as ModelTreeItemDraggedEvent;
	} catch {
		return undefined;
	}
}

function messageElement(className: string, text: string): HTMLElement {
	const element = document.createElement('div');
	element.className = className;
	element.textContent = text;
	return element;
}

function showStatus(message: string): void {
	status.textContent = message;
	status.classList.add('visible');
	setTimeout(() => {
		status.classList.remove('visible');
	}, 3500);
}

function requiredElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing required element #${id}.`);
	}

	return element;
}
