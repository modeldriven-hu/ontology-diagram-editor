import { Bounds, DiagramMetadataElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import { defaultMetadataHeight, defaultMetadataWidth } from './diagram-editor-defaults';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export class CreateMetadataElementUseCase {
	public execute(diagram: OntologyDiagramDocument, position: CanvasPoint): DiagramMutationResult {
		const element = new DiagramMetadataElement(
			nextElementId(diagram.metadataElements.map((existing) => existing.id.value), 'metadata'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultMetadataWidth, defaultMetadataHeight),
		);

		return { diagram: cloneDiagram(diagram, { metadataElements: [...diagram.metadataElements, element] }) };
	}
}
