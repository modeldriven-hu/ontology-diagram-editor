import { Bounds, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { DiagramLayoutAlgorithm, DiagramLayoutResult } from './diagram-layout-algorithm';
import { roundLayoutCoordinate } from './layout-coordinate';

const canvasMargin = 80;
const horizontalGap = 72;
const verticalGap = 72;

export class GridLayoutAlgorithm implements DiagramLayoutAlgorithm {
	public readonly id = 'grid';

	public async layout(diagram: OntologyDiagramDocument): Promise<DiagramLayoutResult> {
		const columnCount = Math.ceil(Math.sqrt(diagram.nodes.length));
		const rowCount = Math.ceil(diagram.nodes.length / columnCount);
		const columnWidths = Array.from({ length: columnCount }, () => 0);
		const rowHeights = Array.from({ length: rowCount }, () => 0);

		diagram.nodes.forEach((node, index) => {
			const column = index % columnCount;
			const row = Math.floor(index / columnCount);
			columnWidths[column] = Math.max(columnWidths[column], node.bounds.width);
			rowHeights[row] = Math.max(rowHeights[row], node.bounds.height);
		});

		const columnPositions = positions(columnWidths, canvasMargin, horizontalGap);
		const rowPositions = positions(rowHeights, canvasMargin, verticalGap);
		const nodeBoundsById = new Map<string, Bounds>();
		diagram.nodes.forEach((node, index) => {
			const column = index % columnCount;
			const row = Math.floor(index / columnCount);
			nodeBoundsById.set(node.id.value, new Bounds(
				roundLayoutCoordinate(columnPositions[column]),
				roundLayoutCoordinate(rowPositions[row]),
				node.bounds.width,
				node.bounds.height,
			));
		});

		return { nodeBoundsById };
	}
}

function positions(sizes: readonly number[], margin: number, gap: number): readonly number[] {
	const result: number[] = [];
	let position = margin;
	for (const size of sizes) {
		result.push(position);
		position += size + gap;
	}

	return result;
}
