import { DiagramLegendElement, type OntologyColorBy, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { recolorGalleryIconsForLegend } from './legend-gallery-icon-coloring';

export class UpdateLegendColorsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		colors: Readonly<Record<string, string>>,
		colorMode?: 'border' | 'background',
		colorBy?: OntologyColorBy,
		ontologySourcePaths: ReadonlyMap<string, string> = new Map(),
	): DiagramMutationResult {
		const current = diagram.legendElements.find((element) => element.id.value === id);
		if (current === undefined) {
			return {};
		}
		const nextColors = new Map(Object.entries(colors));
		const nextColorMode = colorMode ?? current.colorMode;
		const nextColorBy = colorBy ?? current.colorBy;
		if (JSON.stringify(Object.fromEntries(current.colors)) === JSON.stringify(Object.fromEntries(nextColors)) && current.colorMode === nextColorMode && current.colorBy === nextColorBy) {
			return {};
		}
		const updatedLegend = new DiagramLegendElement(current.id.value, current.bounds, nextColors, current.style, current.extra, nextColorMode, nextColorBy);
		const legendElements = diagram.legendElements.map((element) => element.id.value === id ? updatedLegend : element);
		return {
			diagram: cloneDiagram(diagram, {
				legendElements,
				nodes: recolorGalleryIconsForLegend(diagram.nodes, updatedLegend, ontologySourcePaths),
			}),
		};
	}
}
