import { Bounds, DiagramNode, type JsonObject, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import type { ModelTreeItemDropPayload } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import { defaultNodeHeight, defaultNodeWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export class CreateNodeUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		payload: ModelTreeItemDropPayload,
		position: CanvasPoint,
		size?: { readonly width: number; readonly height: number },
	): DiagramMutationResult {
		if (!isNodeCapableOntologyItem(payload.ontologyItemType)) {
			return { notification: 'Only classes, individuals, and datatypes can create nodes for now.' };
		}

		const existingNode = diagram.nodes.find((node) => node.ontologyRef.value === payload.ontologyItemReference);
		if (existingNode !== undefined) {
			return { notification: `"${payload.displayLabel}" already has a node in this diagram.` };
		}

		const bounds = initialNodeBounds(payload, position, size);
		const node = new DiagramNode(
			nextElementId(diagram.nodes.map((existing) => existing.id.value), 'node'),
			payload.ontologyItemReference,
			bounds,
			undefined,
			undefined,
			nodeExtraFields(payload),
			undefined,
			payload.ontologyItemType === 'individual' ? true : undefined,
			payload.ontologyItemType === 'individual' ? true : undefined,
		);

		return {
			diagram: cloneDiagram(diagram, {
				nodes: [...diagram.nodes, node],
			}),
		};
	}
}

function isNodeCapableOntologyItem(type: string): boolean {
	return type === 'class' || type === 'individual' || type === 'datatype';
}

function nodeExtraFields(payload: ModelTreeItemDropPayload): JsonObject {
	return {
		ontology_item_type: payload.ontologyItemType,
	};
}

function initialNodeBounds(payload: ModelTreeItemDropPayload, position: CanvasPoint, size?: { readonly width: number; readonly height: number }): Bounds {
	const initialSize = size ?? initialNodeSize(payload);
	return new Bounds(
		roundCoordinate(position.x),
		roundCoordinate(position.y),
		Math.max(defaultNodeWidth, roundCoordinate(initialSize.width)),
		Math.max(defaultNodeHeight, roundCoordinate(initialSize.height)),
	);
}

function initialNodeSize(payload: ModelTreeItemDropPayload): { readonly width: number; readonly height: number } {
	if (payload.ontologyItemType !== 'individual') {
		return { width: defaultNodeWidth, height: defaultNodeHeight };
	}

	const metadata = isObject(payload.ontologyItemMetadata) ? payload.ontologyItemMetadata : {};
	const typeNames = stringArray(metadata.assertedClassReferences).map(humanizedReferenceName);
	const title = typeNames.length === 0 ? payload.displayLabel : `${payload.displayLabel} : ${typeNames.join(', ')}`;
	const slots = propertyAssertionTexts(metadata.propertyAssertions);
	const lines = [title, ...slots];
	const width = Math.max(defaultNodeWidth, Math.ceil(Math.max(...lines.map(estimatedTextWidth), 0) + 40));
	const height = slots.length === 0
		? defaultNodeHeight
		: Math.max(defaultNodeHeight, 44 + (slots.length * 19) + 20);

	return { width, height };
}

function propertyAssertionTexts(value: unknown): readonly string[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value.flatMap((assertion) => {
		if (!isObject(assertion)) {
			return [];
		}

		const propertyReference = stringValue(assertion.propertyReference);
		const propertyValue = stringValue(assertion.value);
		if (propertyReference === undefined || propertyValue === undefined) {
			return [];
		}

		const valueType = stringValue(assertion.valueType);
		const displayValue = valueType === 'resource'
			? humanizedReferenceName(propertyValue)
			: `'${propertyValue}'`;
		return [`${humanizedReferenceName(propertyReference)} = ${displayValue}`];
	});
}

function estimatedTextWidth(value: string): number {
	return value.length * 11;
}

function humanizedReferenceName(value: string): string {
	const hashIndex = value.lastIndexOf('#');
	const slashIndex = value.lastIndexOf('/');
	const compactIriIndex = value.includes('://') ? -1 : value.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const localName = separatorIndex >= 0 ? value.slice(separatorIndex + 1) : value;
	const spaced = localName.replace(/([a-z0-9])([A-Z])/gu, '$1 $2');
	return spaced.length === 0 ? value : spaced;
}

function stringArray(value: unknown): readonly string[] {
	return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && item.length > 0) : [];
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}
