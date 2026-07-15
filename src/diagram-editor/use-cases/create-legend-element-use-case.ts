import { Bounds, DiagramLegendElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';
import { defaultLegendColors } from './legend-coloring';

export { defaultOntologyColorPalette } from './legend-coloring';

export class CreateLegendElementUseCase {
	public execute(diagram: OntologyDiagramDocument, position: CanvasPoint): DiagramMutationResult {
		if (diagram.legendElements.length > 0) {
			return { notification: 'The diagram already has an ontology legend.' };
		}
		const colors = defaultLegendColors(diagram, 'ontologySource');
		const element = new DiagramLegendElement(
			nextElementId(diagram.legendElements.map((existing) => existing.id.value), 'legend'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), 240, Math.max(84, 36 + diagram.ontologies.length * 24)),
			colors,
		);

		return { diagram: cloneDiagram(diagram, { legendElements: [...diagram.legendElements, element] }) };
	}
}
