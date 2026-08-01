import type * as vscode from 'vscode';
import type { LoadedOntology, OntologyItem, OntologyItemType } from './ontology-model';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';

export const modelTreeViewId = 'ontology-diagram-editor.modelTree';
export const filterModelTreeCommand = 'ontology-diagram-editor.modelTree.filter';
export const showUnaddedOntologyItemsCommand = 'ontology-diagram-editor.modelTree.showUnaddedItems';
export const refreshModelTreeCommand = 'ontology-diagram-editor.modelTree.refresh';
export const addOntologyCommand = 'ontology-diagram-editor.modelTree.addOntology';
export const removeOntologyCommand = 'ontology-diagram-editor.modelTree.removeOntology';
export const openOntologyFileCommand = 'ontology-diagram-editor.modelTree.openOntologyFile';
export const openOntologySourceCommand = 'ontology-diagram-editor.modelTree.openOntologySource';
export const addAllToDiagramCommand = 'ontology-diagram-editor.modelTree.addAllToDiagram';

export type ModelTreeNode = DiagramTreeNode | OntologyFileTreeNode | OntologyGroupTreeNode | OntologyItemTreeNode | ErrorTreeNode;
export type NodeKind = 'diagram' | 'ontologyFile' | 'ontologyGroup' | 'ontologyItem' | 'error';
export type OntologyGroupKind = 'itemType' | 'individualType';

export interface BaseTreeNode {
	readonly kind: NodeKind;
	readonly id: string;
	readonly label: string;
}

export interface DiagramTreeNode extends BaseTreeNode {
	readonly kind: 'diagram';
}

export interface OntologyFileTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyFile';
	readonly ontology: LoadedOntology;
}

export interface OntologyGroupTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyGroup';
	readonly groupKind: OntologyGroupKind;
	readonly ontology: LoadedOntology;
	readonly itemType: OntologyItemType;
	readonly items: readonly OntologyItem[];
	readonly individualTypeReferences?: readonly string[];
}

export interface OntologyItemTreeNode extends BaseTreeNode {
	readonly kind: 'ontologyItem';
	readonly ontology: LoadedOntology;
	readonly item: OntologyItem;
	readonly classAncestorReferences?: readonly string[];
}

export interface ErrorTreeNode extends BaseTreeNode {
	readonly kind: 'error';
	readonly message: string;
}

export interface ModelTreeSearchItem extends vscode.QuickPickItem {
	readonly node: OntologyItemTreeNode;
}

export interface OntologyPickerItem extends vscode.QuickPickItem {
	readonly ontology: LoadedOntology;
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

export interface ModelTreeItemsDragPayload {
	readonly items: readonly ModelTreeItemDraggedEvent[];
}

export interface DiagramRefreshRequestedEvent {
	readonly diagramUri: vscode.Uri;
}

export interface ModelTreeItemsAddRequestedEvent {
	readonly diagramUri: vscode.Uri;
	readonly items: readonly ModelTreeItemDropPayload[];
}

export const modelTreeDragMimeType = 'application/vnd.code.tree.ontology-diagram-editor.model-tree';


