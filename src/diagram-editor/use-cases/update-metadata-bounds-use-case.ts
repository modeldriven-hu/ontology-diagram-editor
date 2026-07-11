import { DiagramMetadataElement, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumMetadataHeight, minimumMetadataWidth, type MetadataBoundsUpdate } from '../../shared/canvas-geometry';
import { boundsEqual, toBounds } from './bounds';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateMetadataBoundsUseCase {
	public execute(diagram: OntologyDiagramDocument, updates: readonly MetadataBoundsUpdate[]): DiagramMutationResult {
		if (updates.some((update) => update.width < minimumMetadataWidth || update.height < minimumMetadataHeight)) {
			return { notification: `Diagram information must be at least ${minimumMetadataWidth} x ${minimumMetadataHeight}.` };
		}
		const updateById = new Map(updates.map((update) => [update.id, update]));
		let changed = false;
		const metadataElements = diagram.metadataElements.map((element) => {
			const update = updateById.get(element.id.value);
			if (update === undefined) {
				return element;
			}
			const bounds = toBounds(update);
			if (boundsEqual(element.bounds, bounds)) {
				return element;
			}
			changed = true;
			return new DiagramMetadataElement(element.id.value, bounds, element.style, element.extra);
		});
		return changed ? { diagram: cloneDiagram(diagram, { metadataElements }) } : {};
	}
}
