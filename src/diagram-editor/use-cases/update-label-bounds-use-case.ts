import { DiagramLabel, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumLabelHeight, minimumLabelWidth, type LabelBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateLabelBoundsUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		updates: readonly LabelBoundsUpdate[],
	): DiagramMutationResult {
		if (updates.length === 0) {
			return {};
		}

		const invalidUpdate = updates.find((update) => update.width < minimumLabelWidth || update.height < minimumLabelHeight);
		if (invalidUpdate !== undefined) {
			return { notification: `Labels must be at least ${minimumLabelWidth} x ${minimumLabelHeight}.` };
		}

		const updateById = new Map(updates.map((update) => [update.id, update]));
		let changed = false;
		const nextLabels = diagram.labels.map((label) => {
			const update = updateById.get(label.id.value);
			if (update === undefined) {
				return label;
			}

			const nextBounds = toBounds(update);
			if (boundsEqual(label.bounds, nextBounds)) {
				return label;
			}

			changed = true;
			return new DiagramLabel(
				label.id.value,
				nextBounds,
				label.text,
				label.style,
				label.extra,
			);
		});

		if (!changed) {
			return {};
		}

		return {
			diagram: cloneDiagram(diagram, {
				labels: nextLabels,
			}),
		};
	}
}
