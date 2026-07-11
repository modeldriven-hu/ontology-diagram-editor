import type { OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class DeleteMetadataElementUseCase {
	public execute(diagram: OntologyDiagramDocument, id: string): DiagramMutationResult {
		const metadataElements = diagram.metadataElements.filter((element) => element.id.value !== id);
		return metadataElements.length === diagram.metadataElements.length
			? {}
			: { diagram: cloneDiagram(diagram, { metadataElements }) };
	}
}
