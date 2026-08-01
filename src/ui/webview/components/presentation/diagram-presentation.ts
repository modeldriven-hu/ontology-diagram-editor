import type { DiagramEdge, DiagramElementStyle, DiagramNode } from '../../ontology-diagram-types';

export function imagePreserveAspectRatio(node: DiagramNode): 'xMidYMid meet' | 'xMidYMid slice' | 'xMidYMin slice' | 'xMinYMid slice' {
	switch (node.style?.image_fit) {
		case 'cover':
			return 'xMidYMid slice';
		case 'match_width':
			return 'xMidYMin slice';
		case 'match_height':
			return 'xMinYMid slice';
		default:
			return 'xMidYMid meet';
	}
}

export function isNoteConnection(edge: DiagramEdge): boolean {
	return edge.ontology_item_type === 'noteConnection';
}

export function elementCornerRadius(style: DiagramElementStyle | undefined, fallback: number): number {
	return style?.corner_radius ?? fallback;
}

export function plainPresentationText(value: string): string {
	if (!/<[a-z][\s\S]*>/iu.test(value)) {
		return value;
	}

	const documentValue = new DOMParser().parseFromString(value, 'text/html');
	return documentValue.body.textContent ?? value;
}
