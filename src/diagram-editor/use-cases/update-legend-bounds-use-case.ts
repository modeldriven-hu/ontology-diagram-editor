import { Bounds, DiagramLegendElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { LegendBoundsUpdate } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateLegendBoundsUseCase {
	public execute(diagram: OntologyDiagramDocument, updates: readonly LegendBoundsUpdate[]): DiagramMutationResult {
		const byId = new Map(updates.map((update) => [update.id, update]));
		const legendElements = diagram.legendElements.map((element) => {
			const update = byId.get(element.id.value);
			return update === undefined ? element : new DiagramLegendElement(element.id.value, new Bounds(update.x, update.y, update.width, update.height), element.colors, element.style, element.extra, element.colorMode, element.colorBy);
		});
		return { diagram: cloneDiagram(diagram, { legendElements }) };
	}
}
