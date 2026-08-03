import { Bounds, DiagramLink, OntologyDiagramValidationError, type OntologyDiagramDocument } from '../../documents/odiagram';
import type { CanvasPoint } from '../../shared/canvas-geometry';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { roundCoordinate } from './geometry';

const defaultDiagramLinkWidth = 160;
const defaultDiagramLinkHeight = 112;

export class CreateDiagramLinkUseCase {
	public execute(diagram: OntologyDiagramDocument, reference: string, position: CanvasPoint): DiagramMutationResult {
		return guarded(() => {
			const link = new DiagramLink(
				nextElementId(diagram.diagramLinks.map((existing) => existing.id.value), 'link'),
				new Bounds(roundCoordinate(position.x), roundCoordinate(position.y), defaultDiagramLinkWidth, defaultDiagramLinkHeight),
				reference,
			);
			return { diagram: cloneDiagram(diagram, { diagramLinks: [...diagram.diagramLinks, link] }) };
		});
	}
}

export class UpdateDiagramLinkReferenceUseCase {
	public execute(diagram: OntologyDiagramDocument, id: string, reference: string): DiagramMutationResult {
		return guarded(() => updateLinks(diagram, id, (link) => link.diagramRef === reference
			? link
			: new DiagramLink(link.id.value, link.bounds, reference, link.icon, link.extra)));
	}
}

export class UpdateDiagramLinkIconUseCase {
	public execute(diagram: OntologyDiagramDocument, id: string, icon: string | undefined): DiagramMutationResult {
		return guarded(() => updateLinks(diagram, id, (link) => link.icon === icon
			? link
			: new DiagramLink(link.id.value, link.bounds, link.diagramRef, icon, link.extra)));
	}
}

function updateLinks(
	diagram: OntologyDiagramDocument,
	id: string,
	update: (link: DiagramLink) => DiagramLink,
): DiagramMutationResult {
	let changed = false;
	const diagramLinks = diagram.diagramLinks.map((link) => {
		if (link.id.value !== id) {
			return link;
		}
		const next = update(link);
		changed = changed || next !== link;
		return next;
	});
	return changed ? { diagram: cloneDiagram(diagram, { diagramLinks }) } : {};
}

function guarded(action: () => DiagramMutationResult): DiagramMutationResult {
	try {
		return action();
	} catch (error) {
		if (error instanceof OntologyDiagramValidationError) {
			return { notification: error.message };
		}
		throw error;
	}
}
