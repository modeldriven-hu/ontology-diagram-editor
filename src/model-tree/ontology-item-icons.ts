import type { OntologyItemType } from './ontology-model';

export interface OntologyItemIcon {
	readonly themeIconId: string;
	readonly canvasGlyph: string;
}

const itemTypeIcons: Record<OntologyItemType, OntologyItemIcon> = {
	class: {
		themeIconId: 'symbol-class',
		canvasGlyph: 'C',
	},
	objectProperty: {
		themeIconId: 'link',
		canvasGlyph: 'L',
	},
	dataProperty: {
		themeIconId: 'symbol-field',
		canvasGlyph: 'F',
	},
	annotationProperty: {
		themeIconId: 'tag',
		canvasGlyph: 'T',
	},
	subclassRelationship: {
		themeIconId: 'type-hierarchy-sub',
		canvasGlyph: 'S',
	},
	individual: {
		themeIconId: 'symbol-object',
		canvasGlyph: 'I',
	},
	datatype: {
		themeIconId: 'symbol-value',
		canvasGlyph: 'D',
	},
};

export function getOntologyItemIcon(type: OntologyItemType): OntologyItemIcon {
	return itemTypeIcons[type];
}

export function isOntologyItemType(value: string): value is OntologyItemType {
	return value in itemTypeIcons;
}
