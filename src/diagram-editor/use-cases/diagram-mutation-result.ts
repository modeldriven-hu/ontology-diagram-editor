import type { OntologyDiagramDocument } from '../../documents/odiagram';

export interface DiagramMutationResult {
	readonly diagram?: OntologyDiagramDocument;
	readonly notification?: string;
}
