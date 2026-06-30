import * as vscode from 'vscode';

import { Bounds, DiagramEdge, DiagramNode, JsonObject, OntologyDiagramDocument, Point, parseOntologyDiagramTextDocument, stringifyOntologyDiagramYaml } from '../odiagram';
import { ModelTreeItemDraggedEvent } from '../model-tree/model-tree-controller';
import { NodeBoundsUpdate, minimumNodeHeight, minimumNodeWidth } from '../shared/canvas-geometry';
import { CanvasPoint, WebviewMessage, buildOntologyDiagramWebviewHtml } from './ontology-diagram-webview';

export const ontologyDiagramEditorViewType = 'ontology-diagram-editor.diagramEditor';

const defaultNodeWidth = 180;
const defaultNodeHeight = 72;

export class OntologyDiagramEditorProvider implements vscode.CustomTextEditorProvider {
	public constructor(
		private readonly onDidOpenDiagram: (document: vscode.TextDocument) => void | Promise<void>,
		private readonly getLastDraggedModelTreeItem: () => ModelTreeItemDraggedEvent | undefined,
	) {}

	public async resolveCustomTextEditor(
		document: vscode.TextDocument,
		webviewPanel: vscode.WebviewPanel,
		_token: vscode.CancellationToken,
	): Promise<void> {
		await this.onDidOpenDiagram(document);

		webviewPanel.webview.options = {
			enableScripts: true,
		};

		const updateWebview = (): void => {
			webviewPanel.webview.html = buildOntologyDiagramWebviewHtml(document, webviewPanel.webview);
		};

		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
			if (event.document.uri.toString() === document.uri.toString()) {
				updateWebview();
			}
		});
		const messageDisposable = webviewPanel.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
			if (message.type === 'createNode') {
				const payload = message.payload ?? this.getLastDraggedModelTreeItem();
				if (payload === undefined) {
					vscode.window.showInformationMessage('Drag a model-tree item onto the canvas while holding Shift.');
					return;
				}

				await createNodeFromDrop(document, payload, message.position);
			} else if (message.type === 'updateNodeBounds') {
				await updateNodeBounds(document, message.updates);
			}
		});

		webviewPanel.onDidDispose(() => {
			documentChangeDisposable.dispose();
			messageDisposable.dispose();
		});

		updateWebview();
	}
}

async function createNodeFromDrop(
	document: vscode.TextDocument,
	payload: ModelTreeItemDraggedEvent,
	position: CanvasPoint,
): Promise<void> {
	if (!isNodeCapableOntologyItem(payload.ontologyItemType)) {
		vscode.window.showInformationMessage('Only classes, individuals, and datatypes can create nodes for now.');
		return;
	}

	const diagram = parseOntologyDiagramTextDocument(document);
	const existingNode = diagram.nodes.find((node) => node.ontologyRef.value === payload.ontologyItemReference);
	if (existingNode !== undefined) {
		vscode.window.showInformationMessage(`"${payload.displayLabel}" already has a node in this diagram.`);
		return;
	}

	const node = new DiagramNode(
		nextNodeId(diagram),
		payload.ontologyItemReference,
		new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultNodeWidth, defaultNodeHeight),
		undefined,
		undefined,
		nodeExtraFields(payload),
	);
	const nextDiagram = new OntologyDiagramDocument(
		diagram.metadata,
		diagram.ontologies,
		diagram.namespaces,
		[...diagram.nodes, node],
		diagram.edges,
		diagram.notes,
		diagram.images,
		diagram.labels,
		diagram.extra,
	);

	await replaceDiagramDocument(document, nextDiagram);
}

async function updateNodeBounds(
	document: vscode.TextDocument,
	updates: readonly NodeBoundsUpdate[],
): Promise<void> {
	if (updates.length === 0) {
		return;
	}

	const updateById = new Map(updates.map((update) => [update.id, update]));
	const invalidUpdate = updates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
	if (invalidUpdate !== undefined) {
		vscode.window.showInformationMessage(`Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.`);
		return;
	}

	const diagram = parseOntologyDiagramTextDocument(document);
	let changed = false;
	const boundsByNodeId = new Map(diagram.nodes.map((node) => [node.id.value, node.bounds]));
	const nextNodes = diagram.nodes.map((node) => {
		const update = updateById.get(node.id.value);
		if (update === undefined) {
			return node;
		}

		const nextBounds = new Bounds(
			roundCoordinate(update.x),
			roundCoordinate(update.y),
			roundPositiveSize(update.width),
			roundPositiveSize(update.height),
		);
		if (
			node.bounds.x === nextBounds.x
			&& node.bounds.y === nextBounds.y
			&& node.bounds.width === nextBounds.width
			&& node.bounds.height === nextBounds.height
		) {
			return node;
		}

		changed = true;
		boundsByNodeId.set(node.id.value, nextBounds);
		return new DiagramNode(
			node.id.value,
			node.ontologyRef.value,
			nextBounds,
			node.style,
			node.image,
			node.extra,
		);
	});
	const nextEdges = diagram.edges.map((edge) => recalculateConnectedEdgeEndpoints(edge, updateById, boundsByNodeId));
	changed = changed || nextEdges.some((edge, index) => edge !== diagram.edges[index]);

	if (!changed) {
		return;
	}

	await replaceDiagramDocument(
		document,
		new OntologyDiagramDocument(
			diagram.metadata,
			diagram.ontologies,
			diagram.namespaces,
			nextNodes,
			nextEdges,
			diagram.notes,
			diagram.images,
			diagram.labels,
			diagram.extra,
		),
	);
}

function recalculateConnectedEdgeEndpoints(
	edge: DiagramEdge,
	updateById: ReadonlyMap<string, NodeBoundsUpdate>,
	boundsByNodeId: ReadonlyMap<string, Bounds>,
): DiagramEdge {
	const sourceChanged = updateById.has(edge.source.value);
	const targetChanged = updateById.has(edge.target.value);
	if (!sourceChanged && !targetChanged) {
		return edge;
	}

	const nextPoints = [...edge.points];
	if (sourceChanged) {
		const sourceBounds = boundsByNodeId.get(edge.source.value);
		if (sourceBounds !== undefined) {
			nextPoints[0] = boundaryPoint(sourceBounds, nextPoints[1]);
		}
	}
	if (targetChanged) {
		const targetBounds = boundsByNodeId.get(edge.target.value);
		if (targetBounds !== undefined) {
			nextPoints[nextPoints.length - 1] = boundaryPoint(targetBounds, nextPoints[nextPoints.length - 2]);
		}
	}

	if (edge.points.every((point, index) => pointsEqual(point, nextPoints[index]))) {
		return edge;
	}

	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		edge.label,
		nextPoints,
		edge.style,
		edge.extra,
	);
}

function boundaryPoint(bounds: Bounds, toward: Point): Point {
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	const dx = toward.x - centerX;
	const dy = toward.y - centerY;
	if (dx === 0 && dy === 0) {
		return new Point(roundCoordinate(bounds.x + bounds.width), roundCoordinate(centerY));
	}

	const scale = Math.min(
		dx === 0 ? Number.POSITIVE_INFINITY : (bounds.width / 2) / Math.abs(dx),
		dy === 0 ? Number.POSITIVE_INFINITY : (bounds.height / 2) / Math.abs(dy),
	);

	return new Point(
		roundCoordinate(centerX + dx * scale),
		roundCoordinate(centerY + dy * scale),
	);
}

function pointsEqual(left: Point, right: Point): boolean {
	return left.x === right.x && left.y === right.y;
}

async function replaceDiagramDocument(document: vscode.TextDocument, diagram: OntologyDiagramDocument): Promise<void> {
	const edit = new vscode.WorkspaceEdit();
	const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
	edit.replace(document.uri, fullRange, stringifyOntologyDiagramYaml(diagram));
	const applied = await vscode.workspace.applyEdit(edit);
	if (!applied) {
		throw new Error('Could not update diagram document.');
	}

	await document.save();
}

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}

function nextNodeId(diagram: OntologyDiagramDocument): string {
	const existingIds = new Set(diagram.nodes.map((node) => node.id.value));
	let index = diagram.nodes.length + 1;

	while (existingIds.has(`node_item${index}`)) {
		index += 1;
	}

	return `node_item${index}`;
}

function roundCoordinate(value: number): number {
	return Math.max(0, Math.round(value));
}

function roundPositiveSize(value: number): number {
	return Math.max(1, Math.round(value));
}

function nodeExtraFields(payload: ModelTreeItemDraggedEvent): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}
