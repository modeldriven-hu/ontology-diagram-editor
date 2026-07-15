import { Bounds, DiagramLegendElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { defaultLegendColors, legendColorKeys } from './legend-coloring';

/** Adds colours and space for categories introduced by newly materialized diagram elements. */
export class ApplyLegendColoringUseCase {
	public execute(diagram: OntologyDiagramDocument): DiagramMutationResult {
		let changed = false;
		const legendElements = diagram.legendElements.map((element) => {
			const colorBy = element.colorBy ?? 'ontologySource';
			if (colorBy === 'none') {
				return element;
			}

			const keys = legendColorKeys(diagram, colorBy);
			const defaultColors = defaultLegendColors(diagram, colorBy);
			const colors = new Map(element.colors);
			let colorsChanged = false;
			for (const key of keys) {
				if (!colors.has(key)) {
					colors.set(key, defaultColors.get(key)!);
					colorsChanged = true;
				}
			}

			const minimumHeight = Math.max(84, 36 + (keys.length * 24));
			const bounds = element.bounds.height >= minimumHeight
				? element.bounds
				: new Bounds(element.bounds.x, element.bounds.y, element.bounds.width, minimumHeight);
			if (!colorsChanged && bounds === element.bounds) {
				return element;
			}

			changed = true;
			return new DiagramLegendElement(element.id.value, bounds, colors, element.style, element.extra, element.colorMode, element.colorBy);
		});

		return changed ? { diagram: cloneDiagram(diagram, { legendElements }) } : {};
	}
}
