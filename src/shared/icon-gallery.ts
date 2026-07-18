export interface IconGallerySetDefinition {
	readonly id: string;
	readonly name: string;
	readonly author: string;
	readonly license: string;
	readonly total: number;
}

export interface IconGallerySet extends IconGallerySetDefinition {
	readonly uri: string;
}

export const iconGallerySetDefinitions: readonly IconGallerySetDefinition[] = [
	{ id: 'mdi', name: 'Material Design Icons', author: 'Pictogrammers', license: 'Apache-2.0', total: 7_447 },
	{ id: 'carbon', name: 'Carbon', author: 'IBM', license: 'Apache-2.0', total: 2_571 },
	{ id: 'bi', name: 'Bootstrap Icons', author: 'The Bootstrap Authors', license: 'MIT', total: 2_078 },
];

export type ImageGalleryTargetType = 'node' | 'image';

export interface OpenImageGalleryMessage {
	readonly type: 'openImageGallery';
	readonly targetType: ImageGalleryTargetType;
	readonly targetId: string;
}
