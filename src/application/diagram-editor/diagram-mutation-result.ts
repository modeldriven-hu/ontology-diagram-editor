import type { OntologyDiagramDocument } from '../../odiagram';

export interface DiagramMutationResult {
	readonly diagram?: OntologyDiagramDocument;
	readonly notification?: string;
}
