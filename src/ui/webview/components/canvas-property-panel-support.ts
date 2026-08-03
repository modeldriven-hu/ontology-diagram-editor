import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumLegendHeight, minimumLegendWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasPropertyEditedEvent, type CanvasElementType } from '../../../shared/canvas-editor-events';
import { OptimizeEdgeRoutesCommand, PickImageSourceCommand, UpdateDiagramMetadataCommand, UpdateEdgePresentationCommand, UpdateEdgeRouteLayoutsCommand, UpdateElementStyleCommand, UpdateElementStylesCommand, UpdateImageBoundsCommand, UpdateLabelBoundsCommand, UpdateLabelTextCommand, UpdateLegendBoundsCommand, UpdateLegendColorByCommand, UpdateLegendColorsCommand, UpdateMetadataBoundsCommand, UpdateNodeBoundsCommand, UpdateNodeDataPropertiesVisibilityCommand, UpdateNodeImageCommand, UpdateNodeLabelTextOverflowCommand, UpdateNodeLabelTextOverflowsCommand, UpdateNodePropertyValueTextOverflowCommand, UpdateNodePropertyValuesVisibilityCommand, UpdateNodeTypeDisplayCommand, UpdateNodeTypeVisibilityCommand, UpdateNoteBoundsCommand, UpdateNoteExportVisibilityCommand, UpdateNoteTextCommand } from '../../../shared/webview-commands';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, EdgeStylePatch, ElementStylePatch, LabelStylePatch, StyledCanvasElementType } from '../../../shared/webview-commands';
import { serializedContainmentEndpoints } from '../../../shared/diagram-containment';
import type { DiagramEdge, DiagramElementStyle, DiagramEdgeStyle, DiagramImage, DiagramLabel, DiagramLabelStyle, DiagramLegendElement, DiagramMetadataElement, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { ontologyLegendEntries } from './ontology-legend';
import type { CanvasElementRegistry, CanvasPropertyElement } from './canvas-element-registry';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import { actionButton, checkboxField, colorField, imageField, numberField, optionalNumberComboField, optionalNumberField, readonlyField, sectionElement, selectField, textAreaField, textField } from './canvas-property-fields';
import type { DiagramCanvasEngine } from '../engine/diagram-canvas-engine';
import { edgeDisplayName } from './ontology-diagram-edges';
import { availableNodeDataPropertyAttributes, availableNodePropertyValueAttributes, nodeAttributeTextLines, nodeAttributeTextOverflow, nodeTitleText, requiredNodeHeightForDataProperties, requiredNodeWidthForDataProperties } from './node-data-properties';
import { ontologyCommentsForReference } from './ontology-comments';
import { ontologyAnnotationFieldsForReference } from './ontology-annotations';
import type { WebviewTheme } from '../webview-theme';
import { embeddedGalleryIconColor, recolorEmbeddedGalleryIcon } from '../../../shared/embedded-gallery-icon';
import { canvasColorPalette, type CanvasColorRole } from './canvas-color-palettes';


export interface SharedValue<TValue> {
	readonly value: TValue | undefined;
	readonly mixed: boolean;
}

export type PropertyElementKind = CanvasPropertyElement['kind'];

export const propertyElementTypeOrder: readonly PropertyElementKind[] = [
	'node',
	'edge',
	'note',
	'image',
	'label',
	'metadata',
	'legend',
	'link',
];

export const propertyElementTypeLabels: Readonly<Record<PropertyElementKind, string>> = {
	node: 'Nodes',
	edge: 'Edges',
	note: 'Notes',
	image: 'Images',
	label: 'Labels',
	metadata: 'Diagram Information',
	legend: 'Legends',
	link: 'Diagram Links',
};

export const mixedSelectionValue = '__mixed_selection_value__';

export function sharedValue<TValue>(values: readonly TValue[]): SharedValue<TValue> {
	const first = values[0];
	return {
		value: first,
		mixed: values.some((value) => !Object.is(value, first)),
	};
}

export function normalizeSharedString(value: SharedValue<string | undefined>): SharedValue<string | ''> {
	return {
		value: value.value ?? '',
		mixed: value.mixed,
	};
}

export function mixedSelectField<TValue extends string>(
	label: string,
	shared: SharedValue<TValue | ''>,
	options: readonly { readonly value: TValue | ''; readonly label: string }[],
	commit: (value: TValue | undefined) => void,
): HTMLElement {
	const value = shared.mixed ? mixedSelectionValue : shared.value ?? '';
	const mixedOptions = shared.mixed
		? [{ value: mixedSelectionValue, label: 'Mixed' } as const, ...options]
		: options;
	return selectField<TValue | typeof mixedSelectionValue>(label, value, mixedOptions, (selectedValue) => {
		if (selectedValue !== mixedSelectionValue) {
			commit(selectedValue);
		}
	});
}

export function markMixedField(field: HTMLElement, mixed: boolean): HTMLElement {
	if (mixed) {
		const input = field.querySelector<HTMLInputElement>('.property-input');
		if (input !== null) {
			input.placeholder = 'Mixed';
			input.title = 'Selected elements have different values';
		}
	}

	return field;
}

export function buttonGroup(buttons: readonly HTMLElement[]): HTMLElement {
	const group = document.createElement('div');
	group.className = 'property-button-group';
	group.append(...buttons);
	return group;
}

export function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

export function authorsText(authors: readonly string[]): string {
	return authors.join(', ');
}

export function parseAuthorsText(value: string): readonly string[] {
	return value
		.split(',')
		.map((author) => author.trim())
		.filter((author) => author.length > 0);
}

export const borderTypeOptions = [
	{ value: '', label: 'Default' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' },
	{ value: 'none', label: 'None' },
] as const;

export const lineStyleOptions = [
	{ value: '', label: 'Default' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' },
	{ value: 'none', label: 'None' },
] as const;

export const edgeRouteLayoutOptions = [
	{ value: '', label: 'Default (orthogonal)' },
	{ value: 'orthogonal', label: 'Orthogonal' },
	{ value: 'direct', label: 'Direct' },
	{ value: 'one_side', label: 'One Side' },
	{ value: 'manhattan', label: 'Manhattan' },
	{ value: 'metro', label: 'Metro' },
	{ value: 'entity_relation', label: 'Entity Relation' },
] as const;

export const propertyValueTextOverflowOptions = [
	{ value: 'truncate', label: 'Truncate' },
	{ value: 'wrap', label: 'Wrap' },
] as const;

export const individualTypeDisplayOptions = [
	{ value: 'inline', label: 'Name : Type' },
	{ value: 'stereotype', label: '«Type» above Name' },
] as const;

export const nodeLabelTextOverflowOptions = [
	{ value: 'truncate', label: 'Truncate with ...' },
	{ value: 'wrap', label: 'Wrap' },
] as const;

export const defaultFontFamilyOptions = [
	{ value: '', label: 'Default' },
	{ value: 'system-ui', label: 'System UI' },
	{ value: 'sans-serif', label: 'Sans Serif' },
	{ value: 'serif', label: 'Serif' },
	{ value: 'monospace', label: 'Monospace' },
	{ value: 'Arial', label: 'Arial' },
	{ value: 'Helvetica Neue', label: 'Helvetica Neue' },
	{ value: 'Verdana', label: 'Verdana' },
	{ value: 'Tahoma', label: 'Tahoma' },
	{ value: 'Trebuchet MS', label: 'Trebuchet MS' },
	{ value: 'Georgia', label: 'Georgia' },
	{ value: 'Times New Roman', label: 'Times New Roman' },
	{ value: 'Menlo', label: 'Menlo' },
	{ value: 'Monaco', label: 'Monaco' },
	{ value: 'Consolas', label: 'Consolas' },
	{ value: 'Courier New', label: 'Courier New' },
] as const;

export const standardFontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64] as const;
export const standardCornerRadii = [0, 2, 4, 6, 8, 12, 16, 24, 32] as const;

export const shadowOptions = [
	{ value: '', label: 'Default' },
	{ value: 'true', label: 'On' },
	{ value: 'false', label: 'Off' },
] as const;

export const nodeImageFitOptions = [
	{ value: 'contain', label: 'Contain' },
	{ value: 'cover', label: 'Cover' },
	{ value: 'match_width', label: 'Match Width' },
	{ value: 'match_height', label: 'Match Height' },
] as const;

export function fontFamilyOptions(currentValue: string | undefined): readonly { readonly value: string; readonly label: string }[] {
	const current = currentValue?.trim();
	if (current === undefined || current.length === 0 || defaultFontFamilyOptions.some((option) => option.value === current)) {
		return defaultFontFamilyOptions;
	}

	return [
		{ value: current, label: current },
		...defaultFontFamilyOptions,
	];
}

export function cloneCommonStyle(style: DiagramElementStyle | undefined): CommonStylePatch {
	return {
		bg_color: style?.bg_color,
		text_color: style?.text_color,
		font: cloneFontStyle(style?.font),
		border: style?.border === undefined
			? undefined
			: {
				type: style.border.type,
				weight: style.border.weight,
				color: style.border.color,
			},
		corner_radius: style?.corner_radius,
		shadow: style?.shadow,
		image_fit: style?.image_fit,
	};
}

export function cloneEdgeStyle(style: DiagramEdgeStyle | undefined): EdgeStylePatch {
	return {
		color: style?.color,
		line_style: style?.line_style,
		weight: style?.weight,
		text_color: style?.text_color,
		font: cloneFontStyle(style?.font),
	};
}

export function cloneLabelStyle(style: DiagramLabelStyle | undefined): LabelStylePatch {
	return {
		text_color: style?.text_color,
		font: cloneFontStyle(style?.font),
	};
}

export function cloneFontStyle(style: DiagramElementStyle['font'] | undefined): NonNullable<CommonStylePatch['font']> | undefined {
	if (style === undefined) {
		return undefined;
	}

	return {
		family: style.family,
		bold: style.bold,
		italic: style.italic,
		size: style.size,
	};
}

export function cleanCommonStyle(style: CommonStylePatch): CommonStylePatch | undefined {
	const font = cleanFontStyle(style.font);
	const border = cleanBorderStyle(style.border);
	const cleaned = {
		bg_color: style.bg_color,
		text_color: style.text_color,
		font,
		border,
		corner_radius: style.corner_radius,
		shadow: style.shadow,
		image_fit: style.image_fit,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

export function cleanEdgeStyle(style: EdgeStylePatch): EdgeStylePatch | undefined {
	const font = cleanFontStyle(style.font);
	const cleaned = {
		color: style.color,
		line_style: style.line_style,
		weight: style.weight,
		text_color: style.text_color,
		font,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

export function cleanLabelStyle(style: LabelStylePatch): LabelStylePatch | undefined {
	const font = cleanFontStyle(style.font);
	const cleaned = {
		text_color: style.text_color,
		font,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

export function cleanFontStyle(style: CommonStylePatch['font'] | undefined): CommonStylePatch['font'] | undefined {
	if (style === undefined) {
		return undefined;
	}

	const cleaned = {
		family: style.family,
		bold: style.bold,
		italic: style.italic,
		size: style.size,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

export function cleanBorderStyle(style: BorderStylePatch | undefined): BorderStylePatch | undefined {
	if (style === undefined) {
		return undefined;
	}

	const cleaned = {
		type: style.type,
		weight: style.weight,
		color: style.color,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

export function blankToUndefined(value: string): string | undefined {
	const trimmed = value.trim();

	return trimmed.length === 0 ? undefined : trimmed;
}

export function shadowValue(value: boolean | undefined): '' | 'true' | 'false' {
	return value === undefined ? '' : String(value) as 'true' | 'false';
}

export function hasAnyValue(value: Record<string, unknown>): boolean {
	return Object.values(value).some((entry) => entry !== undefined);
}
