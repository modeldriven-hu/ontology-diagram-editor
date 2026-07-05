import { DiagramImage, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumImageHeight, minimumImageWidth, type ImageBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recalculateConnectedEdgeEndpoints } from './geometry';

export class UpdateImageBoundsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: readonly ImageBoundsUpdate[],
	): DiagramMutationResult {
		if (updates.length === 0) {
			return {};
		}

		const invalidUpdate = updates.find((update) => update.width < minimumImageWidth || update.height < minimumImageHeight);
		if (invalidUpdate !== undefined) {
			return { notification: `Images must be at least ${minimumImageWidth} x ${minimumImageHeight}.` };
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		let changed = false;
		const boundsByElementId = new Map([
			...diagram.nodes.map((node) => [node.id.value, node.bounds] as const),
			...diagram.notes.map((note) => [note.id.value, note.bounds] as const),
			...diagram.images.map((image) => [image.id.value, image.bounds] as const),
		]);
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
		const nextEdges = diagram.edges.map((edge) => recalculateConnectedEdgeEndpoints(edge, updateById, boundsByElementId));
		changed = changed || nextEdges.some((edge, index) => edge !== diagram.edges[index]);

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				images: nextImages,
				edges: nextEdges,
			}),
		};
	}
}
