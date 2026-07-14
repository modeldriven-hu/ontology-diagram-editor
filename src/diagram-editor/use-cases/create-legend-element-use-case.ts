import { Bounds, DiagramLegendElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

export const defaultOntologyColorPalette = [
	'#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
	'#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
	'#2F6B9A', '#D37222', '#B83B3D', '#4E9B94', '#3D7D36',
	'#C9A227', '#875D99', '#D9677A', '#795548', '#7A7A7A',
] as const;

export class CreateLegendElementUseCase {
	public execute(diagram: OntologyDiagramDocument, position: CanvasPoint): DiagramMutationResult {
		if (diagram.legendElements.length > 0) {
			return { notification: 'The diagram already has an ontology legend.' };
		}
		const colors = new Map(diagram.ontologies.map((ontology, index) => [
			ontology.path,
			defaultOntologyColorPalette[index % defaultOntologyColorPalette.length],
		]));
		const element = new DiagramLegendElement(
			nextElementId(diagram.legendElements.map((existing) => existing.id.value), 'legend'),
			new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), 240, Math.max(84, 36 + diagram.ontologies.length * 24)),
			colors,
		);

		return { diagram: cloneDiagram(diagram, { legendElements: [...diagram.legendElements, element] }) };
	}
}
