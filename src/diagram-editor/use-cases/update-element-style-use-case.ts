import {
	BorderStyle,
	CommonStyle,
	DiagramEdge,
	DiagramLabel,
	DiagramNode,
	DiagramNote,
	EdgeStyle,
	FontStyle,
	LabelStyle,
	OntologyDiagramValidationError,
	type BorderType,
	type EdgeLineStyle,
	type OntologyDiagramDocument,
} from '../../documents/odiagram';
import type { ElementStylePatch, StyledCanvasElementType } from '../../shared/webview-commands';
import { cloneDiagram } from './diagram-document-copy';
import type { DiagramMutationResult } from './diagram-mutation-result';

export class UpdateElementStyleUseCase {
	public execute(
		diagram: OntologyDiagramDocument,
		elementType: StyledCanvasElementType,
		id: string,
		style: ElementStylePatch | undefined,
	): DiagramMutationResult {
		try {
			if (elementType === 'node') {
				return updateNodeStyle(diagram, id, style);
			}
			if (elementType === 'edge') {
				return updateEdgeStyle(diagram, id, style);
			}
			if (elementType === 'note') {
				return updateNoteStyle(diagram, id, style);
			}

			return updateLabelStyle(diagram, id, style);
		} catch (error) {
			if (error instanceof OntologyDiagramValidationError) {
				return { notification: error.message };
			}

			throw error;
		}
	}
}

function updateNodeStyle(
	diagram: OntologyDiagramDocument,
	id: string,
	style: ElementStylePatch | undefined,
): DiagramMutationResult {
	let changed = false;
	const nextNodes = diagram.nodes.map((node) => {
		if (node.id.value !== id) {
			return node;
		}

		const nextStyle = style === undefined ? undefined : commonStyle(style);
		if (JSON.stringify(node.style?.toPersistenceObject()) === JSON.stringify(nextStyle?.toPersistenceObject())) {
			return node;
		}

		changed = true;
		return new DiagramNode(node.id.value, node.ontologyRef.value, node.bounds, nextStyle, node.image, node.extra, node.showDataProperties);
	});

	return changed ? { diagram: cloneDiagram(diagram, { nodes: nextNodes }) } : {};
}

function updateEdgeStyle(
	diagram: OntologyDiagramDocument,
	id: string,
	style: ElementStylePatch | undefined,
): DiagramMutationResult {
	let changed = false;
	const nextEdges = diagram.edges.map((edge) => {
		if (edge.id.value !== id) {
			return edge;
		}

		const nextStyle = style === undefined ? undefined : edgeStyle(style);
		if (JSON.stringify(edge.style?.toPersistenceObject()) === JSON.stringify(nextStyle?.toPersistenceObject())) {
			return edge;
		}

		changed = true;
		return new DiagramEdge(
			edge.id.value,
			edge.source.value,
			edge.target.value,
			edge.ontologyRef.value,
			edge.label,
			edge.points,
			nextStyle,
			edge.extra,
		);
	});

	return changed ? { diagram: cloneDiagram(diagram, { edges: nextEdges }) } : {};
}

function updateNoteStyle(
	diagram: OntologyDiagramDocument,
	id: string,
	style: ElementStylePatch | undefined,
): DiagramMutationResult {
	let changed = false;
	const nextNotes = diagram.notes.map((note) => {
		if (note.id.value !== id) {
			return note;
		}

		const nextStyle = style === undefined ? undefined : commonStyle(style);
		if (JSON.stringify(note.style?.toPersistenceObject()) === JSON.stringify(nextStyle?.toPersistenceObject())) {
			return note;
		}

		changed = true;
		return new DiagramNote(note.id.value, note.bounds, note.text, nextStyle, note.extra);
	});

	return changed ? { diagram: cloneDiagram(diagram, { notes: nextNotes }) } : {};
}

function updateLabelStyle(
	diagram: OntologyDiagramDocument,
	id: string,
	style: ElementStylePatch | undefined,
): DiagramMutationResult {
	let changed = false;
	const nextLabels = diagram.labels.map((label) => {
		if (label.id.value !== id) {
			return label;
		}

		const nextStyle = style === undefined ? undefined : labelStyle(style);
		if (JSON.stringify(label.style?.toPersistenceObject()) === JSON.stringify(nextStyle?.toPersistenceObject())) {
			return label;
		}

		changed = true;
		return new DiagramLabel(label.id.value, label.bounds, label.text, nextStyle, label.extra);
	});

	return changed ? { diagram: cloneDiagram(diagram, { labels: nextLabels }) } : {};
}

function commonStyle(style: ElementStylePatch): CommonStyle {
	const common = style as {
		readonly bg_color?: string;
		readonly text_color?: string;
		readonly font?: ElementStylePatch['font'];
		readonly border?: {
			readonly type?: BorderType;
			readonly weight?: number;
			readonly color?: string;
		};
		readonly corner_radius?: number;
		readonly shadow?: boolean;
	};

	return new CommonStyle(
		blankToUndefined(common.bg_color),
		blankToUndefined(common.text_color),
		common.font === undefined ? undefined : fontStyle(common.font),
		common.border === undefined
			? undefined
			: new BorderStyle(common.border.type, common.border.weight, blankToUndefined(common.border.color)),
		{},
		common.corner_radius,
		common.shadow,
	);
}

function edgeStyle(style: ElementStylePatch): EdgeStyle {
	const edge = style as {
		readonly color?: string;
		readonly line_style?: EdgeLineStyle;
		readonly weight?: number;
		readonly text_color?: string;
		readonly font?: ElementStylePatch['font'];
	};

	return new EdgeStyle(
		blankToUndefined(edge.color),
		edge.line_style,
		edge.weight,
		blankToUndefined(edge.text_color),
		edge.font === undefined ? undefined : fontStyle(edge.font),
	);
}

function labelStyle(style: ElementStylePatch): LabelStyle {
	const label = style as {
		readonly text_color?: string;
		readonly font?: ElementStylePatch['font'];
	};

	return new LabelStyle(
		blankToUndefined(label.text_color),
		label.font === undefined ? undefined : fontStyle(label.font),
	);
}

function fontStyle(font: NonNullable<ElementStylePatch['font']>): FontStyle {
	return new FontStyle(
		blankToUndefined(font.family),
		font.bold,
		font.italic,
		font.size,
	);
}

function blankToUndefined(value: string | undefined): string | undefined {
	if (value === undefined || value.trim().length === 0) {
		return undefined;
	}

	return value;
}
