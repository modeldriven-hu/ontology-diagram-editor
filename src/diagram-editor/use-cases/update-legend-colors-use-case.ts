import { DiagramLegendElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateLegendColorsUseCase {
	public execute(diagram: OntologyDiagramDocument, id: string, colors: Readonly<Record<string, string>>, colorMode?: 'border' | 'background'): DiagramMutationResult {
		const current = diagram.legendElements.find((element) => element.id.value === id);
		if (current === undefined) {
			return {};
		}
		const nextColors = new Map(Object.entries(colors));
		if (JSON.stringify(Object.fromEntries(current.colors)) === JSON.stringify(Object.fromEntries(nextColors)) && current.colorMode === colorMode) {
			return {};
		}
		const legendElements = diagram.legendElements.map((element) => element.id.value === id
			? new DiagramLegendElement(element.id.value, element.bounds, nextColors, element.style, element.extra, colorMode)
			: element);
		return { diagram: cloneDiagram(diagram, { legendElements }) };
	}
}
