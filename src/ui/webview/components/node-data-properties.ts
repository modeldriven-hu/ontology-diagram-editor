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

export function nodeCompartmentAttributes(node: DiagramNode, payload: DiagramPayload): readonly NodeDataPropertyAttribute[] {
	if (node.ontology_item_type === 'individual') {
		return node.show_property_values === true ? availableNodePropertyValueAttributes(node, payload) : [];
	}

	return nodeDataPropertyAttributes(node, payload);
}

export function availableNodeDataPropertyAttributes(node: DiagramNode, payload: DiagramPayload): readonly NodeDataPropertyAttribute[] {
	const namespaces = payload.diagram?.namespaces ?? {};
	return (payload.ontology?.data_properties ?? [])
		.filter((property) => property.domainReferences.some((domain) => ontologyReferencesEqual(domain, node.ontology_ref, namespaces)))
		.map((property) => ({
			text: propertyDefinitionText(property.displayLabel, property.reference, property.rangeReferences[0], payload),
		}))
		.sort((left, right) => left.text.localeCompare(right.text));
}

export function availableNodePropertyValueAttributes(node: DiagramNode, payload: DiagramPayload): readonly NodeDataPropertyAttribute[] {
	return (individualForNode(node, payload)?.propertyAssertions ?? []).map((assertion) => ({
		text: propertyAssertionText(assertion, payload),
	}));
}

export function nodeTitleText(node: DiagramNode, payload: DiagramPayload): string {
	const title = node.ontology_item_type === 'individual'
		? ontologyReferenceDisplayName(node.ontology_ref, payload)
		: ontologyDisplayName(node.ontology_ref);
	if (!nodeShowsType(node)) {
		return title;
	}

	const typeNames = uniqueStrings((individualForNode(node, payload)?.assertedClassReferences ?? [])
		.map((reference) => ontologyReferenceDisplayName(reference, payload)));
	return typeNames.length === 0 ? title : `${title} : ${typeNames.join(', ')}`;
}

export function nodeShowsType(node: DiagramNode): boolean {
	return node.ontology_item_type === 'individual' && node.show_type !== false;
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
	const attributeFontSize = Math.max(9, options.fontSize - 1);
	const titleWidth = measuredTextWidth({
		text: options.title,
		fontSize: options.fontSize,
		fontFamily: options.fontFamily,
		bold: options.titleBold,
	}) + 20;
	const attributeWidth = options.attributes.length === 0 ? 0 : Math.max(...options.attributes.map((attribute) => measuredTextWidth({
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

export function measuredTextWidth(options: {
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

function propertyDefinitionText(displayLabel: string, reference: string, rangeReference: string | undefined, payload: DiagramPayload): string {
	const name = displayLabel.trim().length > 0 ? displayLabel : ontologyDisplayName(reference);
	if (rangeReference === undefined || rangeReference.trim().length === 0) {
		return name;
	}

	return `${name}: ${ontologyReferenceDisplayName(rangeReference, payload)}`;
}

function propertyAssertionText(assertion: {
	readonly propertyReference: string;
	readonly value: string;
	readonly valueType: 'literal' | 'resource';
	readonly language?: string;
}, payload: DiagramPayload): string {
	return `${ontologyReferenceDisplayName(assertion.propertyReference, payload)} = ${propertyAssertionValueText(assertion, payload)}`;
}

function propertyAssertionValueText(assertion: {
	readonly value: string;
	readonly valueType: 'literal' | 'resource';
	readonly language?: string;
}, payload: DiagramPayload): string {
	if (assertion.valueType === 'resource') {
		return ontologyReferenceDisplayName(assertion.value, payload);
	}

	const escapedValue = assertion.value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
	const language = assertion.language === undefined || assertion.language.length === 0 ? '' : `@${assertion.language}`;
	return `'${escapedValue}'${language}`;
}

function estimatedTextWidth(text: string, fontSize: number): number {
	return text.length * Math.max(1, fontSize * 0.62);
}

function individualForNode(node: DiagramNode, payload: DiagramPayload) {
	const namespaces = payload.diagram?.namespaces ?? {};
	return (payload.ontology?.individuals ?? [])
		.find((individual) => ontologyReferencesEqual(individual.reference, node.ontology_ref, namespaces));
}

function ontologyReferenceDisplayName(reference: string, payload: DiagramPayload): string {
	const namespaces = payload.diagram?.namespaces ?? {};
	const item = (payload.ontology?.items ?? [])
		.find((candidate) => ontologyReferencesEqual(candidate.reference, reference, namespaces));
	if (item !== undefined && item.displayLabel !== item.reference) {
		return item.displayLabel;
	}

	return ontologyDisplayName(reference);
}

function uniqueStrings(values: readonly string[]): readonly string[] {
	return [...new Set(values)];
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
