import { Bounds, DiagramNote, type OntologyDiagramDocument } from '../../documents/odiagram';
import { minimumNoteHeight, minimumNoteWidth } from '../../shared/canvas-geometry';
import { defaultCompactNoteFontSize, estimatedCompactNoteTextWidth, requiredCompactNoteSize } from '../../shared/note-compact-size';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';
import { nextElementId } from './element-id';
import { CreateNoteConnectionUseCase } from './create-note-connection-use-case';

interface PlacementBounds {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
}

const placementGap = 28;
const overlapPadding = 12;

export class CreateCommentNoteUseCase {
	public constructor(private readonly createNoteConnectionUseCase = new CreateNoteConnectionUseCase()) {}

	public execute(
		diagram: OntologyDiagramDocument,
		nodeId: string,
		comment: string,
	): DiagramMutationResult {
		const text = comment.trim();
		if (text.length === 0) {
			return { notification: 'Selected node has no ontology comment.' };
		}

		const node = diagram.nodes.find((candidate) => candidate.id.value === nodeId);
		if (node === undefined) {
			return { notification: 'Select a node with an ontology comment.' };
		}

		const noteId = nextElementId(diagram.notes.map((existing) => existing.id.value), 'note');
		const noteSize = compactNoteSize(text);
		const note = new DiagramNote(
			noteId,
			notePlacementBounds(diagram, node.bounds, noteSize),
			text,
		);
		const diagramWithNote = cloneDiagram(diagram, {
			notes: [...diagram.notes, note],
		});

		return this.createNoteConnectionUseCase.execute(diagramWithNote, noteId, nodeId);
	}
}

function compactNoteSize(text: string): { readonly width: number; readonly height: number } {
	return requiredCompactNoteSize({
		text,
		minimumWidth: minimumNoteWidth,
		minimumHeight: minimumNoteHeight,
		fontSize: defaultCompactNoteFontSize,
		measureTextWidth: (value) => estimatedCompactNoteTextWidth(value),
	});
}

function notePlacementBounds(
	diagram: OntologyDiagramDocument,
	nodeBounds: Bounds,
	noteSize: { readonly width: number; readonly height: number },
): Bounds {
	const occupiedBounds = positionedElementBounds(diagram);
	const candidate = notePlacementCandidates(nodeBounds, noteSize)
		.find((bounds) => !overlapsAny(bounds, occupiedBounds));

	const bounds = candidate ?? firstFallbackCandidate(nodeBounds, noteSize);
	return new Bounds(bounds.x, bounds.y, bounds.width, bounds.height);
}

function positionedElementBounds(diagram: OntologyDiagramDocument): readonly PlacementBounds[] {
	return [
		...diagram.nodes.map((node) => node.bounds),
		...diagram.notes.map((note) => note.bounds),
		...diagram.images.map((image) => image.bounds),
		...diagram.labels.map((label) => label.bounds),
	];
}

function notePlacementCandidates(
	nodeBounds: Bounds,
	noteSize: { readonly width: number; readonly height: number },
): readonly PlacementBounds[] {
	const candidates: PlacementBounds[] = [];
	const seen = new Set<string>();
	const distances = [placementGap, 80, 140, 220, 320, 460, 640];

	for (const distance of distances) {
		const positions = [
			{ x: nodeBounds.x + nodeBounds.width + distance, y: nodeBounds.y },
			{ x: nodeBounds.x - noteSize.width - distance, y: nodeBounds.y },
			{ x: nodeBounds.x, y: nodeBounds.y + nodeBounds.height + distance },
			{ x: nodeBounds.x, y: nodeBounds.y - noteSize.height - distance },
			{ x: nodeBounds.x + nodeBounds.width + distance, y: nodeBounds.y + nodeBounds.height - noteSize.height },
			{ x: nodeBounds.x - noteSize.width - distance, y: nodeBounds.y + nodeBounds.height - noteSize.height },
			{ x: nodeBounds.x + nodeBounds.width - noteSize.width, y: nodeBounds.y + nodeBounds.height + distance },
			{ x: nodeBounds.x + nodeBounds.width - noteSize.width, y: nodeBounds.y - noteSize.height - distance },
		];

		for (const position of positions) {
			const candidate = normalizedBounds({
				x: position.x,
				y: position.y,
				width: noteSize.width,
				height: noteSize.height,
			});
			const key = `${candidate.x}:${candidate.y}`;
			if (seen.has(key)) {
				continue;
			}

			seen.add(key);
			candidates.push(candidate);
		}
	}

	return candidates;
}

function firstFallbackCandidate(
	nodeBounds: Bounds,
	noteSize: { readonly width: number; readonly height: number },
): PlacementBounds {
	return normalizedBounds({
		x: nodeBounds.x + nodeBounds.width + placementGap,
		y: nodeBounds.y,
		width: noteSize.width,
		height: noteSize.height,
	});
}

function normalizedBounds(bounds: PlacementBounds): PlacementBounds {
	return {
		x: Math.max(0, Math.round(bounds.x)),
		y: Math.max(0, Math.round(bounds.y)),
		width: bounds.width,
		height: bounds.height,
	};
}

function overlapsAny(bounds: PlacementBounds, occupiedBounds: readonly PlacementBounds[]): boolean {
	return occupiedBounds.some((occupied) => rectanglesOverlap(bounds, inflateBounds(occupied, overlapPadding)));
}

function inflateBounds(bounds: PlacementBounds, padding: number): PlacementBounds {
	return {
		x: bounds.x - padding,
		y: bounds.y - padding,
		width: bounds.width + padding * 2,
		height: bounds.height + padding * 2,
	};
}

function rectanglesOverlap(left: PlacementBounds, right: PlacementBounds): boolean {
	return left.x < right.x + right.width
		&& left.x + left.width > right.x
		&& left.y < right.y + right.height
		&& left.y + left.height > right.y;
}
