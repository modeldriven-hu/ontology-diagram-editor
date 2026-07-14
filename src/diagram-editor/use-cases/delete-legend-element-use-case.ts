import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteLegendElementUseCase {
	public execute(diagram: OntologyDiagramDocument, id: string): DiagramMutationResult {
		const legendElements = diagram.legendElements.filter((element) => element.id.value !== id);
		return legendElements.length === diagram.legendElements.length ? {} : { diagram: cloneDiagram(diagram, { legendElements }) };
	}
}
