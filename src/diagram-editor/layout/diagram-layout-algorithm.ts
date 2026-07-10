import type { Bounds, OntologyDiagramDocument, Point } from '../../documents/odiagram';
import type { DiagramLayoutAlgorithmId } from '../../shared/diagram-layout';

export interface DiagramLayoutEdgeRoute {
	readonly label: Point;
	readonly points: readonly Point[];
}

export interface DiagramLayoutResult {
	readonly nodeBoundsById: ReadonlyMap<string, Bounds>;
	readonly edgeRoutesById?: ReadonlyMap<string, DiagramLayoutEdgeRoute>;
}

export interface DiagramLayoutAlgorithm {
	readonly id: DiagramLayoutAlgorithmId;
	layout(diagram: OntologyDiagramDocument): Promise<DiagramLayoutResult>;
}
