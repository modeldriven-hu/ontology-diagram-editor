import { DiagramEdge, DiagramImage, DiagramLabel, DiagramMetadataElement, DiagramNode, DiagramNote, Point, type Bounds, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate, type ImageBoundsUpdate, type LabelBoundsUpdate, type MetadataBoundsUpdate, type NodeBoundsUpdate, type NoteBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recalculateConnectedEdgeEndpoints } from './geometry';

export interface ElementBoundsUpdates {
	readonly nodeUpdates: readonly NodeBoundsUpdate[];
	readonly noteUpdates: readonly NoteBoundsUpdate[];
	readonly imageUpdates: readonly ImageBoundsUpdate[];
	readonly labelUpdates: readonly LabelBoundsUpdate[];
	readonly metadataUpdates?: readonly MetadataBoundsUpdate[];
}

export class UpdateElementBoundsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: ElementBoundsUpdates,
	): DiagramMutationResult {
		const allUpdates = [
			...updates.nodeUpdates,
			...updates.noteUpdates,
			...updates.imageUpdates,
			...updates.labelUpdates,
			...(updates.metadataUpdates ?? []),
		];
		if (allUpdates.length === 0) {
			return {};
		}

		const invalidNodeUpdate = updates.nodeUpdates.find((update) => update.width < minimumNodeWidth || update.height < minimumNodeHeight);
		if (invalidNodeUpdate !== undefined) {
			return { notification: `Nodes must be at least ${minimumNodeWidth} x ${minimumNodeHeight}.` };
		}
		const invalidNoteUpdate = updates.noteUpdates.find((update) => update.width < minimumNoteWidth || update.height < minimumNoteHeight);
		if (invalidNoteUpdate !== undefined) {
			return { notification: `Notes must be at least ${minimumNoteWidth} x ${minimumNoteHeight}.` };
		}
		const invalidImageUpdate = updates.imageUpdates.find((update) => update.width < minimumImageWidth || update.height < minimumImageHeight);
		if (invalidImageUpdate !== undefined) {
			return { notification: `Images must be at least ${minimumImageWidth} x ${minimumImageHeight}.` };
		}
		const invalidLabelUpdate = updates.labelUpdates.find((update) => update.width < minimumLabelWidth || update.height < minimumLabelHeight);
		if (invalidLabelUpdate !== undefined) {
			return { notification: `Labels must be at least ${minimumLabelWidth} x ${minimumLabelHeight}.` };
		}
		const invalidMetadataUpdate = updates.metadataUpdates?.find((update) => update.width < minimumMetadataWidth || update.height < minimumMetadataHeight);
		if (invalidMetadataUpdate !== undefined) {
			return { notification: `Diagram information must be at least ${minimumMetadataWidth} x ${minimumMetadataHeight}.` };
		}

		const updateById = new Map<string, BoundsUpdate>(allUpdates.map((update) => [update.id, update]));
		const originalBoundsByElementId = new Map([
			...diagram.nodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
		const boundsByElementId = new Map(originalBoundsByElementId);
		const moveDeltaByElementId = movedElementDeltas(originalBoundsByElementId, updateById);
		let changed = false;

		const nextNodes = diagram.nodes.map((node) => {
			const update = updateById.get(node.id.value);
			if (update === undefined) {
				return node;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(node.bounds, nextBounds)) {
				return node;
			}

			changed = true;
			boundsByElementId.set(node.id.value, nextBounds);
			return new DiagramNode(
				node.id.value,
				node.ontologyRef.value,
				nextBounds,
				node.style,
				node.image,
				node.extra,
				node.showDataProperties,
				node.showType,
				node.showPropertyValues,
				node.propertyValueTextOverflow,
			);
		});
		const nextNotes = diagram.notes.map((note) => {
			const update = updateById.get(note.id.value);
			if (update === undefined) {
				return note;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(note.bounds, nextBounds)) {
				return note;
			}

			changed = true;
			boundsByElementId.set(note.id.value, nextBounds);
			return new DiagramNote(
				note.id.value,
				nextBounds,
				note.text,
				note.style,
				note.extra,
				note.exported,
			);
		});
		const nextImages = diagram.images.map((image) => {
			const update = updateById.get(image.id.value);
			if (update === undefined) {
				return image;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(image.bounds, nextBounds)) {
				return image;
			}

			changed = true;
			boundsByElementId.set(image.id.value, nextBounds);
			return new DiagramImage(
				image.id.value,
				nextBounds,
				image.source,
				image.style,
				image.extra,
			);
		});
		const nextLabels = diagram.labels.map((label) => {
			const update = updateById.get(label.id.value);
			if (update === undefined) {
				return label;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(label.bounds, nextBounds)) {
				return label;
			}

			changed = true;
			return new DiagramLabel(
				label.id.value,
				nextBounds,
				label.text,
				label.style,
				label.extra,
			);
		});
		const nextMetadataElements = diagram.metadataElements.map((element) => {
			const update = updateById.get(element.id.value);
			if (update === undefined) {
				return element;
			}
			const nextBounds = toBounds(update);
			if (boundsEqual(element.bounds, nextBounds)) {
				return element;
			}
			changed = true;
			return new DiagramMetadataElement(element.id.value, nextBounds, element.style, element.extra);
		});
		const nextEdges = diagram.edges.map((edge) => {
			return translateEdgeMovedWithEndpoints(edge, moveDeltaByElementId)
				?? recalculateConnectedEdgeEndpoints(edge, updateById, boundsByElementId);
		});
		changed = changed || nextEdges.some((edge, index) => edge !== diagram.edges[index]);

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				nodes: nextNodes,
				notes: nextNotes,
				images: nextImages,
				labels: nextLabels,
				metadataElements: nextMetadataElements,
				edges: nextEdges,
			}),
		};
	}
}

interface MoveDelta {
	readonly x: number;
	readonly y: number;
}

function movedElementDeltas(
	originalBoundsByElementId: ReadonlyMap<string, Bounds>,
	updateById: ReadonlyMap<string, BoundsUpdate>,
): ReadonlyMap<string, MoveDelta> {
	const deltas = new Map<string, MoveDelta>();
	for (const [id, originalBounds] of originalBoundsByElementId) {
		const update = updateById.get(id);
		if (update === undefined || update.width !== originalBounds.width || update.height !== originalBounds.height) {
			continue;
		}

		const delta = {
			x: update.x - originalBounds.x,
			y: update.y - originalBounds.y,
		};
		if (delta.x !== 0 || delta.y !== 0) {
			deltas.set(id, delta);
		}
	}

	return deltas;
}

function translateEdgeMovedWithEndpoints(
	edge: DiagramEdge,
	moveDeltaByElementId: ReadonlyMap<string, MoveDelta>,
): DiagramEdge | undefined {
	const sourceDelta = moveDeltaByElementId.get(edge.source.value);
	const targetDelta = moveDeltaByElementId.get(edge.target.value);
	if (sourceDelta === undefined || targetDelta === undefined || !deltasEqual(sourceDelta, targetDelta)) {
		return undefined;
	}

	return new DiagramEdge(
		edge.id.value,
		edge.source.value,
		edge.target.value,
		edge.ontologyRef.value,
		translatePoint(edge.label, sourceDelta),
		edge.points.map((point) => translatePoint(point, sourceDelta)),
		edge.style,
		edge.extra,
		edge.routeLayout,
	);
}

function translatePoint(point: Point, delta: MoveDelta): Point {
	return new Point(point.x + delta.x, point.y + delta.y);
}

function deltasEqual(left: MoveDelta, right: MoveDelta): boolean {
	return left.x === right.x && left.y === right.y;
}
