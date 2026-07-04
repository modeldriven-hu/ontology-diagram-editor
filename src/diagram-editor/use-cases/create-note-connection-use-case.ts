import { Bounds, DiagramEdge, EdgeStyle, Point, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { closestBoundaryPointPair, roundCoordinate } from './geometry';

export const noteConnectionOntologyRef = 'https://ontology-diagram-editor.local/note-connection';

interface ConnectableElement {
	readonly id: string;
	readonly bounds: Bounds;
	readonly kind: 'node' | 'note' | 'image';
}

export class CreateNoteConnectionUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		noteId: string,
		targetId: string,
	): DiagramMutationResult {
		if (noteId === targetId) {
			return { notification: 'A note cannot be connected to itself.' };
		}

		const source = diagram.notes.find((note) => note.id.value === noteId);
		if (source === undefined) {
			return { notification: 'Select an existing note to create a note connection.' };
		}

		const target = connectableElements(diagram).find((element) => element.id === targetId);
		if (target === undefined) {
			return { notification: 'Notes can only connect to nodes, notes, or images.' };
		}

		const existingEdge = diagram.edges.find((edge) =>
			(edge.source.value === noteId && edge.target.value === targetId)
			|| (edge.source.value === targetId && edge.target.value === noteId),
		);
		if (existingEdge !== undefined) {
			return { notification: 'These elements are already connected.' };
		}

		const route = edgeRoute(source.bounds, target.bounds);
		const edge = new DiagramEdge(
			nextElementId(diagram.edges.map((existing) => existing.id.value), 'edge'),
			noteId,
			targetId,
			noteConnectionOntologyRef,
			route.label,
			route.points,
			new EdgeStyle(undefined, 'dotted'),
			{ ontology_item_type: 'noteConnection' },
			'orthogonal',
		);

		return {
			diagram: cloneDiagram(diagram, {
				edges: [...diagram.edges, edge],
			}),
		};
	}
}

function connectableElements(diagram: OntologyDiagramDocument): readonly ConnectableElement[] {
	return [
		...diagram.nodes.map((node) => ({ id: node.id.value, bounds: node.bounds, kind: 'node' as const })),
		...diagram.notes.map((note) => ({ id: note.id.value, bounds: note.bounds, kind: 'note' as const })),
		...diagram.images.map((image) => ({ id: image.id.value, bounds: image.bounds, kind: 'image' as const })),
	];
}

function edgeRoute(sourceBounds: Bounds, targetBounds: Bounds): {
	readonly label: Point;
	readonly points: readonly Point[];
} {
	const { source, target } = closestBoundaryPointPair(sourceBounds, targetBounds);

	return {
		label: midpoint(source, target),
		points: orthogonalPoints(source, target),
	};
}

function orthogonalPoints(source: Point, target: Point): readonly [Point, Point] | readonly [Point, Point, Point, Point] {
	if (source.x === target.x || source.y === target.y) {
		return [source, target];
	}

	const middleX = roundCoordinate((source.x + target.x) / 2);
	return [
		source,
		new Point(middleX, source.y),
		new Point(middleX, target.y),
		target,
	];
}

function midpoint(source: Point, target: Point): Point {
	return new Point(
		roundCoordinate((source.x + target.x) / 2),
		roundCoordinate((source.y + target.y) / 2),
	);
}
