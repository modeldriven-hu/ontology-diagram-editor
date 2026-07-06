import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteElementsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		ids: readonly string[],
	): DiagramMutationResult {
		const selectedIds = new Set(ids);
		if (selectedIds.size === 0) {
			return {};
		}

		const nextNodes = diagram.nodes.filter((node) => !selectedIds.has(node.id.value));
		const nextNotes = diagram.notes.filter((note) => !selectedIds.has(note.id.value));
		const nextImages = diagram.images.filter((image) => !selectedIds.has(image.id.value));
		const nextLabels = diagram.labels.filter((label) => !selectedIds.has(label.id.value));
		const removedEndpointIds = new Set([
			...diagram.nodes.filter((node) => selectedIds.has(node.id.value)).map((node) => node.id.value),
			...diagram.notes.filter((note) => selectedIds.has(note.id.value)).map((note) => note.id.value),
			...diagram.images.filter((image) => selectedIds.has(image.id.value)).map((image) => image.id.value),
		]);
		const nextEdges = diagram.edges.filter((edge) =>
			!selectedIds.has(edge.id.value)
			&& !removedEndpointIds.has(edge.source.value)
			&& !removedEndpointIds.has(edge.target.value),
		);

		if (
			nextNodes.length === diagram.nodes.length
			&& nextNotes.length === diagram.notes.length
			&& nextImages.length === diagram.images.length
			&& nextLabels.length === diagram.labels.length
			&& nextEdges.length === diagram.edges.length
		) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				nodes: nextNodes,
				notes: nextNotes,
				images: nextImages,
				labels: nextLabels,
				edges: nextEdges,
			}),
		};
	}
}
