import type { DiagramNode, DiagramPayload } from '../ontology-diagram-types';

export interface NodeDataPropertyAttribute {
	readonly text: string;
}

export interface NodeDataPropertyLayout {
	readonly headerHeight: number;
	readonly attributeFontSize: number;
	readonly attributeLineHeight: number;
	readonly maximumAttributeLines: number;
	readonly visibleAttributeCount: number;
	readonly hiddenAttributeCount: number;
	readonly showOverflowIndicator: boolean;
}

export function nodeDataPropertyAttributes(node: DiagramNode, payload: DiagramPayload): readonly NodeDataPropertyAttribute[] {
	if (node.show_data_properties !== true) {
		return [];
	}

	return availableNodeDataPropertyAttributes(node, payload);
}

export function availableNodeDataPropertyAttributes(node: DiagramNode, payload: DiagramPayload): readonly NodeDataPropertyAttribute[] {
	const namespaces = payload.diagram?.namespaces ?? {};
	return (payload.ontology?.data_properties ?? [])
		.filter((property) => property.domainReferences.some((domain) => ontologyReferencesEqual(domain, node.ontology_ref, namespaces)))
		.map((property) => ({
			text: attributeText(property.displayLabel, property.reference, property.rangeReferences[0]),
		}))
		.sort((left, right) => left.text.localeCompare(right.text));
}

export function nodeDataPropertyLayout(options: {
	readonly nodeHeight: number;
	readonly fontSize: number;
	readonly attributeCount: number;
}): NodeDataPropertyLayout {
	const headerHeight = Math.min(44, Math.max(30, Math.round(options.nodeHeight * 0.34)));
	const attributeFontSize = Math.max(9, options.fontSize - 1);
	const attributeLineHeight = attributeFontSize + 5;
	const maximumAttributeLines = Math.max(0, Math.floor((options.nodeHeight - headerHeight - 8) / attributeLineHeight));
	const showOverflowIndicator = options.attributeCount > maximumAttributeLines && maximumAttributeLines > 0;
	const visibleAttributeCount = showOverflowIndicator
		? Math.max(0, maximumAttributeLines - 1)
		: Math.min(options.attributeCount, maximumAttributeLines);

	return {
		headerHeight,
		attributeFontSize,
		attributeLineHeight,
		maximumAttributeLines,
		visibleAttributeCount,
		hiddenAttributeCount: options.attributeCount - visibleAttributeCount,
		showOverflowIndicator,
	};
}

export function requiredNodeHeightForDataProperties(options: {
	readonly attributeCount: number;
	readonly fontSize: number;
	readonly minimumHeight: number;
}): number {
	if (options.attributeCount === 0) {
		return options.minimumHeight;
	}

	const maximumReasonableHeight = Math.max(options.minimumHeight, 44 + 8 + (options.attributeCount * (Math.max(9, options.fontSize - 1) + 5)) + 16);
	for (let height = Math.ceil(options.minimumHeight); height <= maximumReasonableHeight; height += 1) {
		const layout = nodeDataPropertyLayout({
			nodeHeight: height,
			fontSize: options.fontSize,
			attributeCount: options.attributeCount,
		});
		if (!layout.showOverflowIndicator && layout.visibleAttributeCount >= options.attributeCount) {
			return height;
		}
	}

	return maximumReasonableHeight;
}

export function requiredNodeWidthForDataProperties(options: {
	readonly title: string;
	readonly attributes: readonly NodeDataPropertyAttribute[];
	readonly fontSize: number;
	readonly fontFamily?: string;
	readonly titleBold?: boolean;
	readonly attributeItalic?: boolean;
	readonly minimumWidth: number;
}): number {
	if (options.attributes.length === 0) {
		return options.minimumWidth;
	}

	const attributeFontSize = Math.max(9, options.fontSize - 1);
	const titleWidth = measuredTextWidth({
		text: options.title,
		fontSize: options.fontSize,
		fontFamily: options.fontFamily,
		bold: options.titleBold,
	}) + 20;
	const attributeWidth = Math.max(...options.attributes.map((attribute) => measuredTextWidth({
		text: attribute.text,
		fontSize: attributeFontSize,
		fontFamily: options.fontFamily,
		italic: options.attributeItalic,
	}) + 20));

	return Math.ceil(Math.max(options.minimumWidth, titleWidth, attributeWidth));
}

export function truncateText(options: {
	readonly text: string;
	readonly width: number;
	readonly fontSize: number;
	readonly fontFamily?: string;
	readonly bold?: boolean;
	readonly italic?: boolean;
}): string {
	if (measuredTextWidth(options) <= options.width) {
		return options.text;
	}

	const ellipsis = '...';
	if (measuredTextWidth({ ...options, text: ellipsis }) > options.width) {
		return '';
	}

	let lower = 0;
	let upper = options.text.length;
	while (lower < upper) {
		const middle = Math.ceil((lower + upper) / 2);
		const candidate = `${options.text.slice(0, middle)}${ellipsis}`;
		if (measuredTextWidth({ ...options, text: candidate }) <= options.width) {
			lower = middle;
		} else {
			upper = middle - 1;
		}
	}

	return `${options.text.slice(0, lower)}${ellipsis}`;
}

function measuredTextWidth(options: {
	readonly text: string;
	readonly fontSize: number;
	readonly fontFamily?: string;
	readonly bold?: boolean;
	readonly italic?: boolean;
}): number {
	const canvas = textMeasureCanvas();
	const context = canvas?.getContext('2d');
	if (context === undefined || context === null) {
		return estimatedTextWidth(options.text, options.fontSize);
	}

	context.font = [
		options.italic === true ? 'italic' : '',
		options.bold === true ? '700' : '400',
		`${options.fontSize}px`,
		options.fontFamily ?? 'sans-serif',
	].filter((part) => part.length > 0).join(' ');

	return context.measureText(options.text).width;
}

let cachedTextMeasureCanvas: HTMLCanvasElement | undefined;

function textMeasureCanvas(): HTMLCanvasElement | undefined {
	if (typeof document === 'undefined') {
		return undefined;
	}
	if (cachedTextMeasureCanvas === undefined) {
		cachedTextMeasureCanvas = document.createElement('canvas');
	}

	return cachedTextMeasureCanvas;
}

export function ontologyDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}

function attributeText(displayLabel: string, reference: string, rangeReference: string | undefined): string {
	const name = displayLabel.trim().length > 0 ? displayLabel : ontologyDisplayName(reference);
	if (rangeReference === undefined || rangeReference.trim().length === 0) {
		return name;
	}

	return `${name}: ${ontologyDisplayName(rangeReference)}`;
}

function estimatedTextWidth(text: string, fontSize: number): number {
	return text.length * Math.max(1, fontSize * 0.62);
}

function ontologyReferencesEqual(left: string, right: string, namespaces: Readonly<Record<string, string>>): boolean {
	if (left === right) {
		return true;
	}

	return expandedOntologyReference(left, namespaces) === expandedOntologyReference(right, namespaces);
}

function expandedOntologyReference(value: string, namespaces: Readonly<Record<string, string>>): string {
	if (value.includes('://')) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0) {
		return value;
	}

	const namespace = namespaces[value.slice(0, separatorIndex)];
	return namespace === undefined ? value : `${namespace}${value.slice(separatorIndex + 1)}`;
}
