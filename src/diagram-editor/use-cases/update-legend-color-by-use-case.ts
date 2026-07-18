import { Bounds, DiagramLegendElement, type OntologyColorBy, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { defaultLegendColors, legendColorKeys } from './legend-coloring';
import { recolorGalleryIconsForLegend } from './legend-gallery-icon-coloring';

export class UpdateLegendColorByUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		colorBy: OntologyColorBy,
		ontologySourcePaths: ReadonlyMap<string, string> = new Map(),
	): DiagramMutationResult {
		const current = diagram.legendElements.find((element) => element.id.value === id);
		if (current === undefined || current.colorBy === colorBy) {
			return {};
		}

		const colors = defaultLegendColors(diagram, colorBy);
		const height = Math.max(84, 36 + (legendColorKeys(diagram, colorBy).length * 24));
		const bounds = current.bounds.height === height
			? current.bounds
			: new Bounds(current.bounds.x, current.bounds.y, current.bounds.width, height);
		const updatedLegend = new DiagramLegendElement(current.id.value, bounds, colors, current.style, current.extra, current.colorMode, colorBy);
		const legendElements = diagram.legendElements.map((element) => element.id.value === id ? updatedLegend : element);
		return {
			diagram: cloneDiagram(diagram, {
				legendElements,
				nodes: recolorGalleryIconsForLegend(diagram.nodes, updatedLegend, ontologySourcePaths),
			}),
		};
	}
}
