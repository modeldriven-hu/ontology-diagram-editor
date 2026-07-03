import { DiagramLabel, type OntologyDiagramDocument } from '../../documents/odiagram';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateLabelTextUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		id: string,
		text: string,
	): DiagramMutationResult {
		if (text.trim().length === 0) {
			return { notification: 'Labels cannot be empty.' };
		}

		let changed = false;
		const nextLabels = diagram.labels.map((label) => {
			if (label.id.value !== id || label.text === text) {
				return label;
			}

			changed = true;
			return new DiagramLabel(
				label.id.value,
				label.bounds,
				text,
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
