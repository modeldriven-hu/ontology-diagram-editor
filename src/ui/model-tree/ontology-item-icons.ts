import type { OntologyItemType } from './ontology-model';

export interface OntologyItemIcon {
	readonly themeIconId: string;
	readonly canvasGlyph: string;
	readonly resourceName: string;
}

const itemTypeIcons: Record<OntologyItemType, OntologyItemIcon> = {
	class: {
		themeIconId: 'symbol-class',
		canvasGlyph: 'C',
		resourceName: 'class.svg',
	},
	objectProperty: {
		themeIconId: 'link',
		canvasGlyph: 'L',
		resourceName: 'object-property.svg',
	},
	objectPropertyAssertion: {
		themeIconId: 'arrow-right',
		canvasGlyph: 'A',
		resourceName: 'object-property.svg',
	},
	dataProperty: {
		themeIconId: 'symbol-field',
		canvasGlyph: 'F',
		resourceName: 'data-property.svg',
	},
	annotationProperty: {
		themeIconId: 'tag',
		canvasGlyph: 'T',
		resourceName: 'annotation-property.svg',
	},
	subclassRelationship: {
		themeIconId: 'type-hierarchy-sub',
		canvasGlyph: 'S',
		resourceName: 'subclass-relationship.svg',
	},
	individual: {
		themeIconId: 'symbol-object',
		canvasGlyph: 'I',
		resourceName: 'individual.svg',
	},
	datatype: {
		themeIconId: 'symbol-value',
		canvasGlyph: 'D',
		resourceName: 'datatype.svg',
	},
};

export function getOntologyItemIcon(type: OntologyItemType): OntologyItemIcon {
	return itemTypeIcons[type];
}

export function isOntologyItemType(value: string): value is OntologyItemType {
	return value in itemTypeIcons;
}
