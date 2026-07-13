import * as path from 'path';
import * as vscode from 'vscode';

import {
	OntologyDiagramDocument,
	OntologyFileReference,
	ontologyDiagramFileExtension,
	parseOntologyDiagramTextDocument,
	stringifyOntologyDiagramYaml,
} from '../../documents/odiagram';
import {
	LoadedOntology,
	OntologyItem,
	OntologyItemType,
	findOntologyImportPaths,
	getOntologyItemTypeLabel,
	getOntologyItemTypeOrder,
	loadReferencedOntologies,
	ontologyFileExtensions,
} from './ontology-model';
import { getOntologyItemIcon } from './ontology-item-icons';
import { findOntologySourceRange } from './ontology-source-navigation';

export const modelTreeViewId = 'ontology-diagram-editor.modelTree';
export const filterModelTreeCommand = 'ontology-diagram-editor.modelTree.filter';
export const refreshModelTreeCommand = 'ontology-diagram-editor.modelTree.refresh';
export const addOntologyCommand = 'ontology-diagram-editor.modelTree.addOntology';
export const removeOntologyCommand = 'ontology-diagram-editor.modelTree.removeOntology';
export const openOntologyFileCommand = 'ontology-diagram-editor.modelTree.openOntologyFile';
export const openOntologySourceCommand = 'ontology-diagram-editor.modelTree.openOntologySource';

type ModelTreeNode = DiagramTreeNode | OntologyFileTreeNode | OntologyGroupTreeNode | OntologyItemTreeNode | ErrorTreeNode;
type NodeKind = 'diagram' | 'ontologyFile' | 'ontologyGroup' | 'ontologyItem' | 'error';
type OntologyGroupKind = 'itemType' | 'individualType';

interface BaseTreeNode {
	readonly kind: NodeKind;
	readonly id: string;
	readonly label: string;
}

interface DiagramTreeNode extends BaseTreeNode {
	readonly kind: 'diagram';
}

interface OntologyFileTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyFile';
	readonly ontology: LoadedOntology;
}

interface OntologyGroupTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyGroup';
	readonly groupKind: OntologyGroupKind;
	readonly ontology: LoadedOntology;
	readonly itemType: OntologyItemType;
	readonly items: readonly OntologyItem[];
	readonly individualTypeReferences?: readonly string[];
}

interface OntologyItemTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyItem';
	readonly ontology: LoadedOntology;
	readonly item: OntologyItem;
	readonly classAncestorReferences?: readonly string[];
}

interface ErrorTreeNode extends BaseTreeNode {
	readonly kind: 'error';
	readonly message: string;
}

interface ModelTreeSearchItem extends vscode.QuickPickItem {
	readonly node: OntologyItemTreeNode;
}

export interface ModelTreeSelectionEvent {
	readonly nodeKind: NodeKind;
	readonly displayLabel: string;
	readonly ontologyFilePath?: string;
	readonly ontologyItemType?: OntologyItemType;
	readonly ontologyItemReference?: string;
	readonly ontologyItemMetadata?: unknown;
}

export interface ModelTreeItemDraggedEvent {
	readonly sourceOntologyFilePath: string;
	readonly ontologyItemType: OntologyItemType;
	readonly ontologyItemReference: string;
	readonly displayLabel: string;
	readonly ontologyItemMetadata: unknown;
}

export interface DiagramRefreshRequestedEvent {
	readonly diagramUri: vscode.Uri;
}

export const modelTreeDragMimeType = 'application/vnd.code.tree.ontology-diagram-editor.model-tree';

export class ModelTree implements vscode.TreeDataProvider<ModelTreeNode>, vscode.TreeDragAndDropController<ModelTreeNode>, vscode.Disposable {
	public readonly dragMimeTypes = [modelTreeDragMimeType, 'text/plain'];
	public readonly dropMimeTypes: string[] = [];

	private readonly onDidChangeTreeDataEmitter = new vscode.EventEmitter<ModelTreeNode | undefined>();
	private readonly onDidChangeSelectionEmitter = new vscode.EventEmitter<ModelTreeSelectionEvent>();
	private readonly onDidDragItemEmitter = new vscode.EventEmitter<ModelTreeItemDraggedEvent>();
	private readonly onDidRequestDiagramRefreshEmitter = new vscode.EventEmitter<DiagramRefreshRequestedEvent>();
	private readonly disposables: vscode.Disposable[] = [
		this.onDidChangeTreeDataEmitter,
		this.onDidChangeSelectionEmitter,
		this.onDidDragItemEmitter,
		this.onDidRequestDiagramRefreshEmitter,
	];

	public readonly onDidChangeTreeData = this.onDidChangeTreeDataEmitter.event;
	public readonly onDidChangeSelection = this.onDidChangeSelectionEmitter.event;
	public readonly onDidDragItem = this.onDidDragItemEmitter.event;
	public readonly onDidRequestDiagramRefresh = this.onDidRequestDiagramRefreshEmitter.event;

	private treeView?: vscode.TreeView<ModelTreeNode>;
	private diagramDocument?: vscode.TextDocument;
	private parsedDiagram?: OntologyDiagramDocument;
	private loadedOntologies: readonly LoadedOntology[] = [];
	private diagramError?: string;
	private selectedNode?: ModelTreeNode;
	private lastDraggedItem?: ModelTreeItemDraggedEvent;
	private extensionUri?: vscode.Uri;
	private refreshQueue = Promise.resolve();

	public register(context: vscode.ExtensionContext): void {
		this.extensionUri = context.extensionUri;
		this.treeView = vscode.window.createTreeView(modelTreeViewId, {
			treeDataProvider: this,
			dragAndDropController: this,
			showCollapseAll: true,
		});

		const refreshDisposable = vscode.commands.registerCommand(refreshModelTreeCommand, async () => {
			await this.refresh();
			if (this.diagramDocument !== undefined) {
				this.onDidRequestDiagramRefreshEmitter.fire({ diagramUri: this.diagramDocument.uri });
			}
		});
		const filterDisposable = vscode.commands.registerCommand(filterModelTreeCommand, async () => {
			await this.searchModelTree();
		});
		const addDisposable = vscode.commands.registerCommand(addOntologyCommand, async () => {
			await this.addOntology();
		});
		const removeDisposable = vscode.commands.registerCommand(removeOntologyCommand, async (node?: ModelTreeNode) => {
			await this.removeOntology(node);
		});
		const openOntologyFileDisposable = vscode.commands.registerCommand(openOntologyFileCommand, async (node?: ModelTreeNode) => {
			await this.openOntologyFile(node);
		});
		const openOntologySourceDisposable = vscode.commands.registerCommand(openOntologySourceCommand, async (node?: ModelTreeNode) => {
			await this.openOntologySource(node);
		});
		const selectionDisposable = this.treeView.onDidChangeSelection((event) => {
			this.selectedNode = event.selection[0];
			this.updateSelectionContext();
			this.emitSelection();
		});
		const documentChangeDisposable = vscode.workspace.onDidChangeTextDocument(async (event) => {
			if (this.diagramDocument !== undefined && event.document.uri.toString() === this.diagramDocument.uri.toString()) {
				this.diagramDocument = event.document;
				await this.refresh();
			}
		});
		this.disposables.push(
			this.treeView,
			filterDisposable,
			refreshDisposable,
			addDisposable,
			removeDisposable,
			openOntologyFileDisposable,
			openOntologySourceDisposable,
			selectionDisposable,
			documentChangeDisposable,
		);
		context.subscriptions.push(this);
		this.updateDiagramContext();
		this.updateSelectionContext();
	}

	public async setDiagramDocument(document: vscode.TextDocument): Promise<void> {
		if (path.extname(document.uri.fsPath) !== ontologyDiagramFileExtension) {
			return;
		}

		this.diagramDocument = document;
		await this.refresh();
	}

	public async clearDiagramDocument(document?: vscode.TextDocument): Promise<void> {
		if (document !== undefined && document.uri.toString() !== this.diagramDocument?.uri.toString()) {
			return;
		}

		this.diagramDocument = undefined;
		this.selectedNode = undefined;
		this.lastDraggedItem = undefined;
		await this.refresh();
		this.updateSelectionContext();
	}

	public async refreshDiagramDependency(document: vscode.TextDocument): Promise<void> {
		if (document.uri.toString() !== this.diagramDocument?.uri.toString()) {
			return;
		}

		this.diagramDocument = document;
		await this.refresh();
	}

	public refresh(): Promise<void> {
		this.refreshQueue = this.refreshQueue.then(
			() => this.performRefresh(),
			() => this.performRefresh(),
		);
		return this.refreshQueue;
	}

	private async performRefresh(): Promise<void> {
		if (this.diagramDocument === undefined) {
			this.parsedDiagram = undefined;
			this.loadedOntologies = [];
			this.diagramError = undefined;
			this.onDidChangeTreeDataEmitter.fire(undefined);
			this.updateDiagramContext();
			return;
		}

		try {
			this.parsedDiagram = parseOntologyDiagramTextDocument(this.diagramDocument);
			this.diagramError = undefined;
			this.loadedOntologies = await loadReferencedOntologies(this.diagramDocument.uri.fsPath, this.parsedDiagram);
		} catch (error) {
			this.parsedDiagram = undefined;
			this.loadedOntologies = [];
			this.diagramError = error instanceof Error ? error.message : String(error);
		}

		this.onDidChangeTreeDataEmitter.fire(undefined);
		this.updateDiagramContext();
	}

	public getTreeItem(node: ModelTreeNode): vscode.TreeItem {
		switch (node.kind) {
			case 'diagram':
				return this.createDiagramTreeItem(node);
			case 'ontologyFile':
				return this.createOntologyFileTreeItem(node);
			case 'ontologyGroup':
				return this.createOntologyGroupTreeItem(node);
			case 'ontologyItem':
				return this.createOntologyItemTreeItem(node);
			case 'error':
				return this.createErrorTreeItem(node);
		}
	}

	public getChildren(node?: ModelTreeNode): vscode.ProviderResult<ModelTreeNode[]> {
		if (node === undefined) {
			return this.diagramDocument === undefined ? [] : [this.createDiagramNode()];
		}

		if (node.kind === 'diagram') {
			if (this.diagramError !== undefined) {
				return [{
					kind: 'error',
					id: `${node.id}:error`,
					label: 'Invalid diagram document',
					message: this.diagramError,
				}];
			}

			return this.loadedOntologies.map((ontology) => this.createOntologyFileNode(ontology));
		}

		if (node.kind === 'ontologyFile') {
			if (node.ontology.error !== undefined) {
				return [{
					kind: 'error',
					id: `${node.id}:error`,
					label: 'Could not load ontology',
					message: node.ontology.error,
				}];
			}

			return getOntologyItemTypeOrder()
				.map((itemType) => {
					return this.createOntologyGroupNode(node.ontology, itemType);
				})
				.filter((group) => group.items.length > 0);
		}

		if (node.kind === 'ontologyGroup') {
			if (node.groupKind === 'itemType' && node.itemType === 'class') {
				return classHierarchyRoots(node.ontology, this.namespaces())
					.map((item) => this.createOntologyItemNode(node.ontology, item, []));
			}

			if (node.groupKind === 'itemType' && node.itemType === 'individual') {
				return this.createIndividualTypeGroupNodes(node.ontology, node.items);
			}

			return node.items.map((item) => this.createOntologyItemNode(node.ontology, item));
		}

		if (node.kind === 'ontologyItem' && node.item.type === 'class') {
			const ancestors = node.classAncestorReferences
				?? classAncestorPath(node.ontology, node.item, this.namespaces())
				?? [];
			const excludedReferences = [...ancestors, node.item.reference];
			return classHierarchyChildren(node.ontology, node.item, this.namespaces())
				.filter((item) => !excludedReferences.some((reference) => ontologyReferencesEqual(
					item.reference,
					reference,
					this.namespaces(),
				)))
				.map((item) => this.createOntologyItemNode(node.ontology, item, excludedReferences));
		}

		return [];
	}

	public getParent(node: ModelTreeNode): vscode.ProviderResult<ModelTreeNode> {
		if (node.kind === 'ontologyFile') {
			return this.createDiagramNode();
		}

		if (node.kind === 'ontologyGroup') {
			return node.groupKind === 'individualType'
				? this.createOntologyGroupNode(node.ontology, node.itemType)
				: this.createOntologyFileNode(node.ontology);
		}

		if (node.kind === 'ontologyItem') {
			if (node.item.type === 'class') {
				const ancestors = node.classAncestorReferences
					?? classAncestorPath(node.ontology, node.item, this.namespaces())
					?? [];
				const parentReference = ancestors.at(-1);
				const parent = parentReference === undefined
					? undefined
					: classItemForReference(node.ontology, parentReference, this.namespaces());
				return parent === undefined
					? this.createOntologyGroupNode(node.ontology, 'class')
					: this.createOntologyItemNode(node.ontology, parent, ancestors.slice(0, -1));
			}

			return this.createOntologyItemParentGroupNode(node.ontology, node.item);
		}

		if (node.kind === 'error') {
			return this.parentForErrorNode(node);
		}

		return undefined;
	}

	public handleDrag(source: readonly ModelTreeNode[], dataTransfer: vscode.DataTransfer): void {
		const itemNode = source.find((node): node is OntologyItemTreeNode => node.kind === 'ontologyItem');
		if (itemNode === undefined) {
			return;
		}

		const payload = dragPayloadForItemNode(itemNode);

		const serializedPayload = JSON.stringify(payload);
		dataTransfer.set(modelTreeDragMimeType, new vscode.DataTransferItem(serializedPayload));
		dataTransfer.set('text/plain', new vscode.DataTransferItem(serializedPayload));
		this.lastDraggedItem = payload;
		this.onDidDragItemEmitter.fire(payload);
	}

	public getLastDraggedItem(): ModelTreeItemDraggedEvent | undefined {
		return this.lastDraggedItem;
	}

	public async revealDiagramElement(elementId: string): Promise<boolean> {
		const diagram = this.parsedDiagram;
		if (diagram === undefined) {
			return false;
		}

		const node = diagram.nodes.find((candidate) => candidate.id.value === elementId);
		if (node !== undefined) {
			return this.revealOntologyItem((item) => ontologyReferencesEqual(item.reference, node.ontologyRef.value, diagram.namespaces));
		}

		const edge = diagram.edges.find((candidate) => candidate.id.value === elementId);
		if (edge === undefined) {
			return false;
		}

		if (edge.extra.ontology_item_type === 'subclassRelationship') {
			const source = diagram.nodes.find((candidate) => candidate.id.value === edge.source.value);
			const target = diagram.nodes.find((candidate) => candidate.id.value === edge.target.value);
			if (source === undefined || target === undefined) {
				return false;
			}

			return this.revealOntologyItem((item) => item.type === 'subclassRelationship'
				&& ontologyReferencesEqual(item.reference, edge.ontologyRef.value, diagram.namespaces)
				&& ontologyReferencesEqual(item.metadata.subclassReference ?? '', source.ontologyRef.value, diagram.namespaces)
				&& ontologyReferencesEqual(item.metadata.superclassReference ?? '', target.ontologyRef.value, diagram.namespaces));
		}

		if (edge.extra.ontology_item_type === 'objectPropertyAssertion') {
			const source = diagram.nodes.find((candidate) => candidate.id.value === edge.source.value);
			const target = diagram.nodes.find((candidate) => candidate.id.value === edge.target.value);
			if (source === undefined || target === undefined) {
				return false;
			}

			return this.revealOntologyItem((item) => item.type === 'objectPropertyAssertion'
				&& ontologyReferencesEqual(item.reference, edge.ontologyRef.value, diagram.namespaces)
				&& ontologyReferencesEqual(item.metadata.sourceOntologyRef ?? '', source.ontologyRef.value, diagram.namespaces)
				&& ontologyReferencesEqual(item.metadata.targetOntologyRef ?? '', target.ontologyRef.value, diagram.namespaces));
		}

		return this.revealOntologyItem((item) => ontologyReferencesEqual(item.reference, edge.ontologyRef.value, diagram.namespaces));
	}

	public dispose(): void {
		for (const disposable of this.disposables) {
			disposable.dispose();
		}
	}

	private async openOntologyFile(node?: ModelTreeNode): Promise<void> {
		const ontologyNode = node?.kind === 'ontologyFile'
			? node
			: this.selectedNode?.kind === 'ontologyFile'
				? this.selectedNode
				: undefined;
		if (ontologyNode === undefined) {
			return;
		}

		const document = await this.openTextDocument(ontologyNode.ontology.absolutePath);
		if (document !== undefined) {
			await vscode.window.showTextDocument(document, { preview: false });
		}
	}

	private async openOntologySource(node?: ModelTreeNode): Promise<void> {
		const itemNode = node?.kind === 'ontologyItem'
			? node
			: this.selectedNode?.kind === 'ontologyItem'
				? this.selectedNode
				: undefined;
		if (itemNode === undefined) {
			return;
		}

		const document = await this.openTextDocument(itemNode.ontology.absolutePath);
		if (document === undefined) {
			return;
		}

		const sourceRange = findOntologySourceRange(document.getText(), itemNode.item);
		if (sourceRange === undefined) {
			await vscode.window.showTextDocument(document, { preview: false });
			await vscode.window.showInformationMessage(`Opened "${itemNode.ontology.relativePath}", but no source location was found for "${itemNode.item.displayLabel}".`);
			return;
		}

		const selection = new vscode.Selection(
			document.positionAt(sourceRange.startOffset),
			document.positionAt(sourceRange.endOffset),
		);
		const editor = await vscode.window.showTextDocument(document, { preview: false, selection });
		editor.revealRange(selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
	}

	private async openTextDocument(absolutePath: string): Promise<vscode.TextDocument | undefined> {
		try {
			return await vscode.workspace.openTextDocument(vscode.Uri.file(absolutePath));
		} catch (error) {
			await vscode.window.showErrorMessage(`Could not open ontology file "${absolutePath}": ${error instanceof Error ? error.message : String(error)}`);
			return undefined;
		}
	}

	private async addOntology(): Promise<void> {
		const document = this.diagramDocument;
		const diagram = this.parsedDiagram;
		if (document === undefined || diagram === undefined) {
			return;
		}

		const selected = await vscode.window.showOpenDialog({
			canSelectFiles: true,
			canSelectFolders: false,
			canSelectMany: false,
			filters: {
				'Ontology files': [...ontologyFileExtensions],
			},
			openLabel: 'Add Ontology',
			title: 'Add Ontology',
		});

		const ontologyUri = selected?.[0];
		if (ontologyUri === undefined) {
			return;
		}

		const relativePath = path.relative(path.dirname(document.uri.fsPath), ontologyUri.fsPath).replaceAll('\\', '/');
		const existing = diagram.ontologies.find((ontology) => normalizePath(ontology.path) === normalizePath(relativePath));
		if (existing !== undefined) {
			await this.revealOntology(existing.path);
			return;
		}

		const discoveredImportPaths = await this.findOntologyImports(ontologyUri.fsPath);
		const existingOntologyPaths = new Set(diagram.ontologies.map((ontology) => normalizePath(ontology.path)));
		const addedImportPaths = uniqueStrings(discoveredImportPaths
			.map((ontologyPath) => path.relative(path.dirname(document.uri.fsPath), ontologyPath).replaceAll('\\', '/'))
			.filter((ontologyPath) => normalizePath(ontologyPath) !== normalizePath(relativePath))
			.filter((ontologyPath) => !existingOntologyPaths.has(normalizePath(ontologyPath))));

		const candidateDiagram = new OntologyDiagramDocument(
			diagram.metadata,
			[
				...diagram.ontologies,
				...addedImportPaths.map((ontologyPath) => new OntologyFileReference(ontologyPath)),
				new OntologyFileReference(relativePath),
			],
			diagram.namespaces,
			diagram.nodes,
			diagram.edges,
			diagram.notes,
			diagram.images,
			diagram.labels,
			diagram.extra,
			diagram.metadataElements,
		);
		const loaded = await loadReferencedOntologies(document.uri.fsPath, candidateDiagram);
		const newOntologyPaths = new Set([...addedImportPaths, relativePath].map(normalizePath));
		const failed = loaded.find((ontology) => newOntologyPaths.has(normalizePath(ontology.relativePath)) && ontology.error !== undefined);
		if (failed?.error !== undefined) {
			vscode.window.showErrorMessage(`Could not load ontology "${failed.relativePath}": ${failed.error}`);
			return;
		}

		await this.replaceDocumentContent(candidateDiagram);
		await this.refresh();
		await this.revealOntology(relativePath);
	}

	private async findOntologyImports(selectedOntologyPath: string): Promise<readonly string[]> {
		const ontologyFileGlob = `**/*.{${ontologyFileExtensions.join(',')}}`;
		const workspaceOntologyUris = await vscode.workspace.findFiles(ontologyFileGlob, '**/{node_modules,out,dist}/**');
		return findOntologyImportPaths(selectedOntologyPath, workspaceOntologyUris.map((uri) => uri.fsPath));
	}

	private async removeOntology(node?: ModelTreeNode): Promise<void> {
		const document = this.diagramDocument;
		const diagram = this.parsedDiagram;
		const ontologyNode = node?.kind === 'ontologyFile' ? node : this.selectedNode?.kind === 'ontologyFile' ? this.selectedNode : undefined;
		if (document === undefined || diagram === undefined || ontologyNode === undefined) {
			return;
		}

		const confirmation = await vscode.window.showWarningMessage(
			`Remove ontology "${ontologyNode.ontology.relativePath}" from this diagram? Diagram elements referencing it will be removed.`,
			{ modal: true },
			'Yes',
			'No',
		);
		if (confirmation !== 'Yes') {
			return;
		}

		const removedReferences = new Set(ontologyNode.ontology.items.map((item) => item.reference));
		const remainingNodes = diagram.nodes.filter((node) => !removedReferences.has(node.ontologyRef.value));
		const removedNodeIds = new Set(diagram.nodes.filter((node) => !remainingNodes.includes(node)).map((node) => node.id.value));
		const remainingEdges = diagram.edges.filter((edge) =>
			!removedReferences.has(edge.ontologyRef.value)
			&& !removedNodeIds.has(edge.source.value)
			&& !removedNodeIds.has(edge.target.value),
		);

		const nextDiagram = new OntologyDiagramDocument(
			diagram.metadata,
			diagram.ontologies.filter((ontology) => normalizePath(ontology.path) !== normalizePath(ontologyNode.ontology.relativePath)),
			diagram.namespaces,
			remainingNodes,
			remainingEdges,
			diagram.notes,
			diagram.images,
			diagram.labels,
			diagram.extra,
			diagram.metadataElements,
		);

		await this.replaceDocumentContent(nextDiagram);
		await this.refresh();
	}

	private async replaceDocumentContent(diagram: OntologyDiagramDocument): Promise<void> {
		const document = this.diagramDocument;
		if (document === undefined) {
			return;
		}

		const edit = new vscode.WorkspaceEdit();
		const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(document.getText().length));
		edit.replace(document.uri, fullRange, stringifyOntologyDiagramYaml(diagram));
		const applied = await vscode.workspace.applyEdit(edit);
		if (!applied) {
			throw new Error('Could not update diagram document.');
		}

		await document.save();
	}

	private async revealOntology(relativePath: string): Promise<void> {
		const treeView = this.treeView;
		if (treeView === undefined) {
			return;
		}

		const diagramNode = this.createDiagramNode();
		const ontology = this.loadedOntologies.find((loaded) => normalizePath(loaded.relativePath) === normalizePath(relativePath));
		if (ontology === undefined) {
			return;
		}

		await treeView.reveal(this.createOntologyFileNode(ontology), { select: true, focus: true, expand: true });
	}

	private async revealOntologyItem(matches: (item: OntologyItem) => boolean): Promise<boolean> {
		const treeView = this.treeView;
		if (treeView === undefined) {
			return false;
		}

		for (const ontology of this.loadedOntologies) {
			const item = ontology.items.find(matches);
			if (item === undefined) {
				continue;
			}

			await treeView.reveal(this.createOntologyItemNode(ontology, item), { select: true, focus: true });
			return true;
		}

		return false;
	}

	private async searchModelTree(): Promise<void> {
		const treeView = this.treeView;
		if (treeView === undefined) {
			return;
		}

		const picker = vscode.window.createQuickPick<ModelTreeSearchItem>();
		picker.title = 'Filter Model Tree';
		picker.placeholder = 'Search ontology items';
		picker.matchOnDescription = true;
		picker.matchOnDetail = true;
		picker.items = this.modelTreeSearchItems();

		await new Promise<void>((resolve) => {
			const activeDisposable = picker.onDidChangeActive((items) => {
				if (items[0] !== undefined) {
					void this.revealSearchItem(items[0].node, false);
				}
			});
			const acceptDisposable = picker.onDidAccept(() => {
				const item = picker.selectedItems[0] ?? picker.activeItems[0];
				if (item !== undefined) {
					void this.revealSearchItem(item.node, true);
				}
				picker.hide();
			});
			const hideDisposable = picker.onDidHide(() => {
				activeDisposable.dispose();
				acceptDisposable.dispose();
				hideDisposable.dispose();
				picker.dispose();
				resolve();
			});
			picker.show();
		});
	}

	private modelTreeSearchItems(): readonly ModelTreeSearchItem[] {
		return this.loadedOntologies
			.filter((ontology) => ontology.error === undefined)
			.flatMap((ontology) => ontology.items.map((item) => ({
				label: item.displayLabel,
				description: `${getOntologyItemTypeLabel(item.type)} · ${ontology.relativePath}`,
				detail: item.reference,
				node: this.createOntologyItemNode(ontology, item),
			})))
			.sort((left, right) => compareText(left.label, right.label)
				|| compareText(left.description ?? '', right.description ?? '')
				|| compareText(left.detail ?? '', right.detail ?? ''));
	}

	private async revealSearchItem(node: OntologyItemTreeNode, focus: boolean): Promise<void> {
		const treeView = this.treeView;
		if (treeView === undefined) {
			return;
		}

		await treeView.reveal(node, { select: true, focus });
	}

	private createDiagramNode(): DiagramTreeNode {
		const document = this.diagramDocument;
		const label = document === undefined ? 'No diagram' : path.basename(document.uri.fsPath);

		return {
			kind: 'diagram',
			id: document?.uri.toString() ?? 'diagram:none',
			label,
		};
	}

	private createOntologyFileNode(ontology: LoadedOntology): OntologyFileTreeNode {
		return {
			kind: 'ontologyFile',
			id: `${this.createDiagramNode().id}:ontology:${ontology.relativePath}`,
			label: ontology.relativePath,
			ontology,
		};
	}

	private createOntologyGroupNode(ontology: LoadedOntology, itemType: OntologyItemType): OntologyGroupTreeNode {
		const items = ontology.items.filter((item) => item.type === itemType);

		return {
			kind: 'ontologyGroup',
			groupKind: 'itemType',
			id: `${this.createOntologyFileNode(ontology).id}:group:${itemType}`,
			label: getOntologyItemTypeLabel(itemType),
			ontology,
			itemType,
			items,
		};
	}

	private createIndividualTypeGroupNodes(ontology: LoadedOntology, items: readonly OntologyItem[]): OntologyGroupTreeNode[] {
		const groups = new Map<string, OntologyGroupTreeNode>();

		for (const item of items) {
			const group = this.createIndividualTypeGroupNode(ontology, item);
			const existingGroup = groups.get(group.id);
			groups.set(group.id, {
				...group,
				items: [...(existingGroup?.items ?? []), item].sort(compareOntologyItemsByDisplayLabel),
			});
		}

		return [...groups.values()].sort(compareIndividualTypeGroups);
	}

	private createIndividualTypeGroupNode(ontology: LoadedOntology, item: OntologyItem): OntologyGroupTreeNode {
		const namespaces = this.parsedDiagram?.namespaces ?? new Map<string, string>();
		const typeReferences = sortedIndividualTypeReferences(item, ontology, namespaces);
		const groupLabel = individualTypeGroupLabel(typeReferences, ontology, namespaces);
		const groupKey = individualTypeGroupKey(typeReferences, namespaces);

		return {
			kind: 'ontologyGroup',
			groupKind: 'individualType',
			id: `${this.createOntologyGroupNode(ontology, 'individual').id}:type:${groupKey}`,
			label: groupLabel,
			ontology,
			itemType: 'individual',
			items: [],
			individualTypeReferences: typeReferences,
		};
	}

	private createOntologyItemNode(
		ontology: LoadedOntology,
		item: OntologyItem,
		classAncestorReferences?: readonly string[],
	): OntologyItemTreeNode {
		const resolvedClassAncestorReferences = item.type === 'class'
			? classAncestorReferences ?? classAncestorPath(ontology, item, this.namespaces()) ?? []
			: undefined;
		const itemKey = item.type === 'class'
			? [...(resolvedClassAncestorReferences ?? []), item.reference].map(encodeURIComponent).join('/')
			: `${encodeURIComponent(item.reference)}:${encodeURIComponent(item.displayLabel)}`;

		return {
			kind: 'ontologyItem',
			id: `${this.createOntologyGroupNode(ontology, item.type).id}:item:${itemKey}`,
			label: item.displayLabel,
			ontology,
			item,
			classAncestorReferences: resolvedClassAncestorReferences,
		};
	}

	private createOntologyItemParentGroupNode(ontology: LoadedOntology, item: OntologyItem): OntologyGroupTreeNode {
		return item.type === 'individual'
			? this.createIndividualTypeGroupNode(ontology, item)
			: this.createOntologyGroupNode(ontology, item.type);
	}

	private parentForErrorNode(node: ErrorTreeNode): ModelTreeNode | undefined {
		if (this.diagramError !== undefined) {
			return this.createDiagramNode();
		}

		const ontology = this.loadedOntologies.find((loaded) => node.id === `${this.createOntologyFileNode(loaded).id}:error`);
		return ontology === undefined ? undefined : this.createOntologyFileNode(ontology);
	}

	private createDiagramTreeItem(node: DiagramTreeNode): vscode.TreeItem {
		const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Expanded);
		item.id = node.id;
		item.contextValue = 'diagram';
		item.iconPath = new vscode.ThemeIcon('type-hierarchy');
		item.tooltip = this.diagramDocument?.uri.fsPath;
		return item;
	}

	private createOntologyFileTreeItem(node: OntologyFileTreeNode): vscode.TreeItem {
		const item = new vscode.TreeItem(
			node.label,
			node.ontology.error === undefined ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.Collapsed,
		);
		item.id = node.id;
		item.contextValue = 'ontologyFile';
		item.iconPath = new vscode.ThemeIcon(node.ontology.error === undefined ? 'file-code' : 'error');
		item.description = node.ontology.error === undefined ? undefined : 'error';
		item.tooltip = node.ontology.error ?? node.ontology.absolutePath;
		return item;
	}

	private createOntologyGroupTreeItem(node: OntologyGroupTreeNode): vscode.TreeItem {
		const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.Collapsed);
		item.id = node.id;
		item.contextValue = 'ontologyGroup';
		item.description = String(node.items.length);
		item.iconPath = this.iconPathForItemType(node.groupKind === 'individualType' ? 'class' : node.itemType);
		return item;
	}

	private createOntologyItemTreeItem(node: OntologyItemTreeNode): vscode.TreeItem {
		const namespaces = this.namespaces();
		const hasClassChildren = node.item.type === 'class'
			&& classHierarchyChildren(node.ontology, node.item, namespaces).some((item) => {
				return ![...(node.classAncestorReferences ?? []), node.item.reference]
					.some((reference) => ontologyReferencesEqual(item.reference, reference, namespaces));
			});
		const item = new vscode.TreeItem(
			node.label,
			hasClassChildren ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
		);
		item.id = node.id;
		item.contextValue = 'ontologyItem';
		item.description = ontologyItemDescription(node.item, node.label, node.ontology, namespaces);
		item.iconPath = this.iconPathForItemType(node.item.type);
		item.tooltip = ontologyItemTooltip(node, namespaces);
		return item;
	}

	private namespaces(): ReadonlyMap<string, string> {
		return this.parsedDiagram?.namespaces ?? new Map<string, string>();
	}

	private createErrorTreeItem(node: ErrorTreeNode): vscode.TreeItem {
		const item = new vscode.TreeItem(node.label, vscode.TreeItemCollapsibleState.None);
		item.id = node.id;
		item.contextValue = 'error';
		item.iconPath = new vscode.ThemeIcon('error');
		item.tooltip = node.message;
		item.description = 'error';
		return item;
	}

	private emitSelection(): void {
		const node = this.selectedNode;
		if (node === undefined) {
			return;
		}

		this.onDidChangeSelectionEmitter.fire(selectionPayloadForNode(node));
	}

	private updateDiagramContext(): void {
		vscode.commands.executeCommand('setContext', 'ontologyDiagramEditor.hasDiagram', this.diagramDocument !== undefined);
	}

	private updateSelectionContext(): void {
		vscode.commands.executeCommand('setContext', 'ontologyDiagramEditor.selectedOntologyFile', this.selectedNode?.kind === 'ontologyFile');
	}

	private iconPathForItemType(itemType: OntologyItemType): vscode.ThemeIcon | vscode.Uri {
		const icon = getOntologyItemIcon(itemType);
		if (this.extensionUri === undefined) {
			return new vscode.ThemeIcon(icon.themeIconId);
		}

		return vscode.Uri.joinPath(this.extensionUri, 'resources', 'ontology-item-icons', icon.resourceName);
	}
}

const untypedIndividualTypeGroupLabel = 'No asserted type';
const untypedIndividualTypeGroupKey = 'untyped';

function compareOntologyItemsByDisplayLabel(left: OntologyItem, right: OntologyItem): number {
	return compareText(left.displayLabel, right.displayLabel)
		|| compareText(left.reference, right.reference);
}

function compareIndividualTypeGroups(left: OntologyGroupTreeNode, right: OntologyGroupTreeNode): number {
	const leftUntyped = left.individualTypeReferences?.length === 0;
	const rightUntyped = right.individualTypeReferences?.length === 0;
	if (leftUntyped !== rightUntyped) {
		return leftUntyped ? 1 : -1;
	}

	return compareText(left.label, right.label)
		|| compareText(left.id, right.id);
}

function classHierarchyRoots(
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly OntologyItem[] {
	const classes = ontology.items
		.filter((item) => item.type === 'class')
		.sort(compareOntologyItemsByDisplayLabel);
	const roots = classes.filter((item) => classHierarchyParents(ontology, item, namespaces).length === 0);
	const reachable = new Set<OntologyItem>();
	const markReachable = (item: OntologyItem): void => {
		if (reachable.has(item)) {
			return;
		}

		reachable.add(item);
		for (const child of classHierarchyChildren(ontology, item, namespaces)) {
			markReachable(child);
		}
	};

	for (const root of roots) {
		markReachable(root);
	}

	// Invalid ontologies can contain subclass cycles. Give each disconnected cyclic
	// component a deterministic root so its classes remain visible in the tree.
	for (const item of classes) {
		if (!reachable.has(item)) {
			roots.push(item);
			markReachable(item);
		}
	}

	return roots.sort(compareOntologyItemsByDisplayLabel);
}

function classHierarchyParents(
	ontology: LoadedOntology,
	item: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
): readonly OntologyItem[] {
	const parents = new Set<OntologyItem>();
	for (const reference of item.metadata.superclassReferences ?? []) {
		const parent = classItemForReference(ontology, reference, namespaces);
		if (parent !== undefined && parent !== item) {
			parents.add(parent);
		}
	}

	return [...parents].sort(compareOntologyItemsByDisplayLabel);
}

function classHierarchyChildren(
	ontology: LoadedOntology,
	item: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
): readonly OntologyItem[] {
	return ontology.items
		.filter((candidate) => candidate.type === 'class'
			&& classHierarchyParents(ontology, candidate, namespaces).includes(item))
		.sort(compareOntologyItemsByDisplayLabel);
}

function classAncestorPath(
	ontology: LoadedOntology,
	target: OntologyItem,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] | undefined {
	const visit = (
		item: OntologyItem,
		ancestors: readonly string[],
		visited: ReadonlySet<OntologyItem>,
	): readonly string[] | undefined => {
		if (item === target) {
			return ancestors;
		}

		const nextVisited = new Set(visited);
		nextVisited.add(item);
		for (const child of classHierarchyChildren(ontology, item, namespaces)) {
			if (nextVisited.has(child)) {
				continue;
			}

			const result = visit(child, [...ancestors, item.reference], nextVisited);
			if (result !== undefined) {
				return result;
			}
		}

		return undefined;
	};

	for (const root of classHierarchyRoots(ontology, namespaces)) {
		const result = visit(root, [], new Set());
		if (result !== undefined) {
			return result;
		}
	}

	return undefined;
}

function classItemForReference(
	ontology: LoadedOntology,
	reference: string,
	namespaces: ReadonlyMap<string, string>,
): OntologyItem | undefined {
	return ontology.items.find((item) => item.type === 'class'
		&& ontologyReferencesEqual(item.reference, reference, namespaces));
}

function sortedIndividualTypeReferences(
	item: OntologyItem,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	return [...uniqueStrings(item.metadata.assertedClassReferences ?? [])].sort((left, right) =>
		compareText(ontologyReferenceDisplayName(left, ontology, namespaces), ontologyReferenceDisplayName(right, ontology, namespaces))
		|| compareText(left, right),
	);
}

function individualTypeGroupLabel(
	typeReferences: readonly string[],
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string {
	const displayNames = uniqueStrings(typeReferences.map((reference) => ontologyReferenceDisplayName(reference, ontology, namespaces)));
	return displayNames.length === 0 ? untypedIndividualTypeGroupLabel : displayNames.join(' | ');
}

function individualTypeGroupKey(typeReferences: readonly string[], namespaces: ReadonlyMap<string, string>): string {
	if (typeReferences.length === 0) {
		return untypedIndividualTypeGroupKey;
	}

	return `typed:${typeReferences
		.map((reference) => encodeURIComponent(expandedOntologyReference(reference, namespaces)))
		.join('|')}`;
}

function compareText(left: string, right: string): number {
	return left.localeCompare(right);
}

function ontologyItemDescription(
	item: OntologyItem,
	label: string,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string | undefined {
	if (item.type === 'subclassRelationship') {
		return undefined;
	}

	if (item.type === 'class') {
		return undefined;
	}

	if (item.type === 'objectProperty' || item.type === 'dataProperty') {
		return endpointTupleDescription(item, ontology, namespaces);
	}

	if (item.type === 'objectPropertyAssertion') {
		return assertionTupleDescription(item, ontology, namespaces);
	}

	if (item.type === 'individual') {
		return endpointDisplayNames(item.metadata.assertedClassReferences, ontology, namespaces);
	}

	return item.reference === label ? undefined : item.reference;
}

function ontologyItemTooltip(node: OntologyItemTreeNode, namespaces: ReadonlyMap<string, string>): string {
	return [
		node.item.displayLabel,
		`Reference: ${node.item.reference}`,
		`Source file: ${node.ontology.relativePath}`,
		`Type: ${getOntologyItemTypeLabel(node.item.type)}`,
		...ontologyItemEndpointTooltipLines(node.item, node.ontology, namespaces),
	].join('\n');
}

function endpointTupleDescription(item: OntologyItem, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string | undefined {
	const domain = endpointDisplayNames(item.metadata.domainReferences, ontology, namespaces);
	const range = endpointDisplayNames(item.metadata.rangeReferences, ontology, namespaces);
	if (domain === undefined && range === undefined) {
		return undefined;
	}

	return `(${domain ?? '?'}, ${range ?? '?'})`;
}

function ontologyItemEndpointTooltipLines(
	item: OntologyItem,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	if (item.type === 'class') {
		return endpointTooltipLines('Superclass', item.metadata.superclassReferences, ontology, namespaces);
	}

	if (item.type === 'objectProperty' || item.type === 'dataProperty' || item.type === 'annotationProperty') {
		return [
			...endpointTooltipLines('Domain', item.metadata.domainReferences, ontology, namespaces),
			...endpointTooltipLines('Range', item.metadata.rangeReferences, ontology, namespaces),
		];
	}

	if (item.type === 'subclassRelationship') {
		return [
			...endpointTooltipLines('Subclass', optionalReference(item.metadata.subclassReference), ontology, namespaces),
			...endpointTooltipLines('Superclass', optionalReference(item.metadata.superclassReference), ontology, namespaces),
		];
	}

	if (item.type === 'objectPropertyAssertion') {
		return [
			...endpointTooltipLines('Source', optionalReference(item.metadata.sourceOntologyRef), ontology, namespaces),
			...endpointTooltipLines('Target', optionalReference(item.metadata.targetOntologyRef), ontology, namespaces),
		];
	}

	return [];
}

function assertionTupleDescription(item: OntologyItem, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string | undefined {
	const source = endpointDisplayNames(optionalReference(item.metadata.sourceOntologyRef), ontology, namespaces);
	const target = endpointDisplayNames(optionalReference(item.metadata.targetOntologyRef), ontology, namespaces);
	if (source === undefined && target === undefined) {
		return undefined;
	}

	return `(${source ?? '?'}, ${target ?? '?'})`;
}

function endpointTooltipLines(
	label: string,
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	const values = endpointReferenceTexts(references, ontology, namespaces);
	return values.length === 0 ? [] : [`${label}: ${values.join(', ')}`];
}

function endpointDisplayNames(
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): string | undefined {
	const values = uniqueStrings((references ?? []).map((reference) => ontologyReferenceDisplayName(reference, ontology, namespaces)));
	return values.length === 0 ? undefined : values.join(' | ');
}

function endpointReferenceTexts(
	references: readonly string[] | undefined,
	ontology: LoadedOntology,
	namespaces: ReadonlyMap<string, string>,
): readonly string[] {
	return uniqueStrings((references ?? []).map((reference) => {
		const displayName = ontologyReferenceDisplayName(reference, ontology, namespaces);
		return displayName === reference ? reference : `${displayName} (${reference})`;
	}));
}

function ontologyReferenceDisplayName(reference: string, ontology: LoadedOntology, namespaces: ReadonlyMap<string, string>): string {
	const item = ontology.items.find((candidate) => ontologyReferencesEqual(candidate.reference, reference, namespaces));
	return item?.displayLabel ?? localOntologyReferenceName(reference);
}

function localOntologyReferenceName(reference: string): string {
	const separatorIndex = Math.max(reference.lastIndexOf('#'), reference.lastIndexOf('/'), reference.lastIndexOf(':'));
	const name = separatorIndex >= 0 ? reference.slice(separatorIndex + 1) : reference;
	return name.length === 0 ? reference : name;
}

function optionalReference(reference: string | undefined): readonly string[] | undefined {
	return reference === undefined ? undefined : [reference];
}

function uniqueStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
}

function selectionPayloadForNode(node: ModelTreeNode): ModelTreeSelectionEvent {
	if (node.kind === 'ontologyFile') {
		return {
			nodeKind: node.kind,
			displayLabel: node.label,
			ontologyFilePath: node.ontology.relativePath,
		};
	}

	if (node.kind === 'ontologyGroup') {
		return {
			nodeKind: node.kind,
			displayLabel: node.label,
			ontologyFilePath: node.ontology.relativePath,
			ontologyItemType: node.itemType,
		};
	}

	if (node.kind === 'ontologyItem') {
		return {
			nodeKind: node.kind,
			displayLabel: node.item.displayLabel,
			ontologyFilePath: node.ontology.relativePath,
			ontologyItemType: node.item.type,
			ontologyItemReference: node.item.reference,
			ontologyItemMetadata: node.item.metadata,
		};
	}

	return {
		nodeKind: node.kind,
		displayLabel: node.label,
	};
}

function dragPayloadForItemNode(node: OntologyItemTreeNode): ModelTreeItemDraggedEvent {
	return {
		sourceOntologyFilePath: node.ontology.relativePath,
		ontologyItemType: node.item.type,
		ontologyItemReference: node.item.reference,
		displayLabel: node.item.displayLabel,
		ontologyItemMetadata: node.item.metadata,
	};
}

function normalizePath(value: string): string {
	return value.replaceAll('\\', '/');
}

function ontologyReferencesEqual(left: string, right: string, namespaces: ReadonlyMap<string, string>): boolean {
	if (left === right) {
		return true;
	}

	return expandedOntologyReference(left, namespaces) === expandedOntologyReference(right, namespaces);
}

function expandedOntologyReference(value: string, namespaces: ReadonlyMap<string, string>): string {
	if (value.includes('://')) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0) {
		return value;
	}

	const namespace = namespaces.get(value.slice(0, separatorIndex));
	return namespace === undefined ? value : `${namespace}${value.slice(separatorIndex + 1)}`;
}
