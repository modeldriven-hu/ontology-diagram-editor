import { type OntologyColorBy, type OntologyDiagramDocument } from '../../documents/odiagram';

export const defaultOntologyColorPalette = [
	'#4E79A7', '#F28E2B', '#E15759', '#76B7B2', '#59A14F',
	'#EDC948', '#B07AA1', '#FF9DA7', '#9C755F', '#BAB0AC',
	'#2F6B9A', '#D37222', '#B83B3D', '#4E9B94', '#3D7D36',
	'#C9A227', '#875D99', '#D9677A', '#795548', '#7A7A7A',
] as const;

const elementTypeOrder = [
	'class', 'individual', 'datatype', 'objectProperty', 'dataProperty', 'annotationProperty',
	'subclassRelationship', 'objectPropertyAssertion',
] as const;

export function legendColorKeys(diagram: OntologyDiagramDocument, colorBy: OntologyColorBy): readonly string[] {
	if (colorBy === 'ontologySource') {
		return diagram.ontologies.map((ontology) => ontology.path);
	}
	if (colorBy === 'none') {
		return [];
	}

	const types = new Set<string>();
	for (const node of diagram.nodes) {
		addElementType(types, node.extra.ontology_item_type);
	}
	for (const edge of diagram.edges) {
		if (edge.extra.ontology_item_type !== 'noteConnection') {
			addElementType(types, edge.extra.ontology_item_type);
		}
	}
	return [
		...elementTypeOrder.filter((type) => types.delete(type)),
		...Array.from(types).sort((left, right) => left.localeCompare(right)),
	];
}

export function defaultLegendColors(diagram: OntologyDiagramDocument, colorBy: OntologyColorBy): ReadonlyMap<string, string> {
	return new Map(legendColorKeys(diagram, colorBy).map((key, index) => [
		key,
		defaultOntologyColorPalette[index % defaultOntologyColorPalette.length],
	]));
}

function addElementType(types: Set<string>, value: unknown): void {
	if (typeof value === 'string' && value.length > 0) {
		types.add(value);
	}
}
