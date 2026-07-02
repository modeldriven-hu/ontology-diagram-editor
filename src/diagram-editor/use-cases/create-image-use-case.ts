import { Bounds, DiagramImage, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

const defaultImageWidth = 240;
const defaultImageHeight = 160;

export class CreateImageUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		source: string,
		position: CanvasPoint,
	): DiagramMutationResult {
		const image = new DiagramImage(
			nextElementId(diagram.images.map((existing) => existing.id.value), 'image'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultImageWidth, defaultImageHeight),
			source,
		);

		return {
			diagram: cloneDiagram(diagram, {
				images: [...diagram.images, image],
			}),
		};
	}
}
