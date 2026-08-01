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

import type { CanvasPropertyPanelOptions, PropertyTab } from './canvas-property-panel-types';
import { sharedValue, normalizeSharedString, mixedSelectField, markMixedField, buttonGroup, capitalize, authorsText, parseAuthorsText, borderTypeOptions, lineStyleOptions, edgeRouteLayoutOptions, propertyValueTextOverflowOptions, individualTypeDisplayOptions, nodeLabelTextOverflowOptions, defaultFontFamilyOptions, standardFontSizes, standardCornerRadii, shadowOptions, nodeImageFitOptions, fontFamilyOptions, cloneCommonStyle, cloneEdgeStyle, cloneLabelStyle, cloneFontStyle, cleanCommonStyle, cleanEdgeStyle, cleanLabelStyle, cleanFontStyle, cleanBorderStyle, blankToUndefined, shadowValue, hasAnyValue } from './canvas-property-panel-support';


export class CanvasPropertyEditor {
	public constructor(private readonly options: CanvasPropertyPanelOptions) {}

	public geometryFields(
		element: { readonly id: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number },
		commit: (update: BoundsUpdate) => void,
		minimumWidth: number,
		minimumHeight: number,
	): HTMLElement[] {
		let x = element.x;
		let y = element.y;
		let width = element.width;
		let height = element.height;
		const send = (): void => {
			width = Math.max(minimumWidth, width);
			height = Math.max(minimumHeight, height);
			const update = { id: element.id, x, y, width, height };
			this.options.registry.updateBounds(update);
			this.options.canvas.restoreBounds([update]);
			commit(update);
		};

		return [
			numberField('X', x, (value) => {
				x = value;
				send();
			}),
			numberField('Y', y, (value) => {
				y = value;
				send();
			}),
			numberField('Width', width, (value) => {
				width = value;
				send();
			}),
			numberField('Height', height, (value) => {
				height = value;
				send();
			}),
		];
	}

	public commonStyleSection(elementType: 'node' | 'note' | 'metadata' | 'legend', id: string, style: DiagramElementStyle | undefined): HTMLElement {
		const commit = (nextStyle: CommonStylePatch | undefined): void => {
			this.updateElementStyle(elementType, id, nextStyle);
		};
		const patch = (): CommonStylePatch => cloneCommonStyle(style);

		return sectionElement('Style', [
			this.colorField('Fill Color', style?.bg_color ?? '', (value) => {
				commit(cleanCommonStyle({ ...patch(), bg_color: blankToUndefined(value) }));
			}, 'surface'),
			this.colorField('Text Color', style?.text_color ?? '', (value) => {
				commit(cleanCommonStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}, 'foreground'),
			this.fontField(style?.font?.family, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, font: { ...next.font, family: blankToUndefined(value) } }));
			}),
			optionalNumberComboField('Font Size', style?.font?.size, standardFontSizes, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, font: { ...next.font, size: value } }));
			}),
			checkboxField('Bold', style?.font?.bold ?? false, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, font: { ...next.font, bold: value } }));
			}),
			checkboxField('Italic', style?.font?.italic ?? false, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, font: { ...next.font, italic: value } }));
			}),
			selectField('Border', style?.border?.type ?? '', borderTypeOptions, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, type: value } }));
			}),
			optionalNumberField('Border Weight', style?.border?.weight, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, weight: value } }));
			}),
			this.colorField('Border Color', style?.border?.color ?? '', (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, color: blankToUndefined(value) } }));
			}),
			optionalNumberComboField('Corner Radius', style?.corner_radius, standardCornerRadii, (value) => {
				commit(cleanCommonStyle({ ...patch(), corner_radius: value }));
			}),
			selectField('Drop Shadow', shadowValue(style?.shadow), shadowOptions, (value) => {
				commit(cleanCommonStyle({ ...patch(), shadow: value === undefined ? undefined : value === 'true' }));
			}),
			actionButton('Clear Style', 'secondary', () => {
				commit(undefined);
			}),
		]);
	}

	public imageStyleSection(id: string, style: DiagramElementStyle | undefined): HTMLElement {
		const commit = (nextStyle: CommonStylePatch | undefined): void => {
			this.updateElementStyle('image', id, nextStyle);
		};
		const patch = (): CommonStylePatch => cloneCommonStyle(style);

		return sectionElement('Style', [
			selectField('Border', style?.border?.type ?? '', borderTypeOptions, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, type: value } }));
			}),
			optionalNumberField('Border Weight', style?.border?.weight, (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, weight: value } }));
			}),
			this.colorField('Border Color', style?.border?.color ?? '', (value) => {
				const next = patch();
				commit(cleanCommonStyle({ ...next, border: { ...next.border, color: blankToUndefined(value) } }));
			}),
			selectField('Drop Shadow', shadowValue(style?.shadow), shadowOptions, (value) => {
				commit(cleanCommonStyle({ ...patch(), shadow: value === undefined ? undefined : value === 'true' }));
			}),
			actionButton('Clear Style', 'secondary', () => {
				commit(undefined);
			}),
		]);
	}

	public edgeStyleSection(id: string, style: DiagramEdgeStyle | undefined): HTMLElement {
		const commit = (nextStyle: EdgeStylePatch | undefined): void => {
			this.updateElementStyle('edge', id, nextStyle);
		};
		const patch = (): EdgeStylePatch => cloneEdgeStyle(style);

		return sectionElement('Style', [
			this.colorField('Line Color', style?.color ?? '', (value) => {
				commit(cleanEdgeStyle({ ...patch(), color: blankToUndefined(value) }));
			}),
			selectField('Line Style', style?.line_style ?? '', lineStyleOptions, (value) => {
				commit(cleanEdgeStyle({ ...patch(), line_style: value }));
			}),
			optionalNumberField('Line Weight', style?.weight, (value) => {
				commit(cleanEdgeStyle({ ...patch(), weight: value }));
			}),
			this.colorField('Label Text Color', style?.text_color ?? '', (value) => {
				commit(cleanEdgeStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}, 'foreground'),
			this.fontField(style?.font?.family, (value) => {
				const next = patch();
				commit(cleanEdgeStyle({ ...next, font: { ...next.font, family: blankToUndefined(value) } }));
			}),
			optionalNumberComboField('Font Size', style?.font?.size, standardFontSizes, (value) => {
				const next = patch();
				commit(cleanEdgeStyle({ ...next, font: { ...next.font, size: value } }));
			}),
			checkboxField('Bold', style?.font?.bold ?? false, (value) => {
				const next = patch();
				commit(cleanEdgeStyle({ ...next, font: { ...next.font, bold: value } }));
			}),
			checkboxField('Italic', style?.font?.italic ?? false, (value) => {
				const next = patch();
				commit(cleanEdgeStyle({ ...next, font: { ...next.font, italic: value } }));
			}),
			actionButton('Clear Style', 'secondary', () => {
				commit(undefined);
			}),
		]);
	}

	public labelStyleSection(id: string, style: DiagramLabelStyle | undefined): HTMLElement {
		const commit = (nextStyle: LabelStylePatch | undefined): void => {
			this.updateElementStyle('label', id, nextStyle);
		};
		const patch = (): LabelStylePatch => cloneLabelStyle(style);

		return sectionElement('Style', [
			this.colorField('Text Color', style?.text_color ?? '', (value) => {
				commit(cleanLabelStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}, 'foreground'),
			this.fontField(style?.font?.family, (value) => {
				const next = patch();
				commit(cleanLabelStyle({ ...next, font: { ...next.font, family: blankToUndefined(value) } }));
			}),
			optionalNumberComboField('Font Size', style?.font?.size, standardFontSizes, (value) => {
				const next = patch();
				commit(cleanLabelStyle({ ...next, font: { ...next.font, size: value } }));
			}),
			checkboxField('Bold', style?.font?.bold ?? false, (value) => {
				const next = patch();
				commit(cleanLabelStyle({ ...next, font: { ...next.font, bold: value } }));
			}),
			checkboxField('Italic', style?.font?.italic ?? false, (value) => {
				const next = patch();
				commit(cleanLabelStyle({ ...next, font: { ...next.font, italic: value } }));
			}),
			actionButton('Clear Style', 'secondary', () => {
				commit(undefined);
			}),
		]);
	}

	public updateElementStyle(elementType: StyledCanvasElementType, id: string, style: ElementStylePatch | undefined): void {
		this.options.registry.updateStyle(elementType, id, style);
		this.propertyEdited(elementType, id, ['style']);
		this.options.messageBus.publishCommand(new UpdateElementStyleCommand(elementType, id, style));
	}

	public updateNodeStyles(
		nodeIds: readonly string[],
		update: (style: CommonStylePatch) => CommonStylePatch | undefined,
	): void {
		const updates = nodeIds.flatMap((id) => {
			const element = this.options.registry.element(id);
			if (element?.kind !== 'node') {
				return [];
			}

			const style = cleanCommonStyle(update(cloneCommonStyle(element.value.style)) ?? {});
			this.options.registry.updateStyle('node', id, style);
			this.propertyEdited('node', id, ['style']);
			return [{ elementType: 'node' as const, id, style }];
		});
		if (updates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateElementStylesCommand(updates));
		}
	}

	public updateEdgeStyles(
		edgeIds: readonly string[],
		update: (style: EdgeStylePatch) => EdgeStylePatch | undefined,
	): void {
		const updates = edgeIds.flatMap((id) => {
			const element = this.options.registry.element(id);
			if (element?.kind !== 'edge') {
				return [];
			}

			const style = cleanEdgeStyle(update(cloneEdgeStyle(element.value.style)) ?? {});
			this.options.registry.updateStyle('edge', id, style);
			this.propertyEdited('edge', id, ['style']);
			return [{ elementType: 'edge' as const, id, style }];
		});
		if (updates.length > 0) {
			this.options.messageBus.publishCommand(new UpdateElementStylesCommand(updates));
		}
	}

	public updateEdgeRouteLayouts(edgeIds: readonly string[], routeLayout: DiagramEdge['route_layout']): void {
		for (const id of edgeIds) {
			this.options.registry.updateEdgeRouteLayout(id, routeLayout);
			this.propertyEdited('edge', id, ['route_layout']);
		}
		if (edgeIds.length > 0) {
			this.options.messageBus.publishCommand(new UpdateEdgeRouteLayoutsCommand(edgeIds, routeLayout));
		}
	}

	public optimizeEdges(edgeIds: readonly string[]): void {
		for (const id of edgeIds) {
			this.propertyEdited('edge', id, ['points', 'label']);
		}
		if (edgeIds.length > 0) {
			this.options.messageBus.publishCommand(new OptimizeEdgeRoutesCommand(edgeIds));
		}
	}

	public updateNodeLabelTextOverflow(nodeIds: readonly string[], textOverflow: 'truncate' | 'wrap'): void {
		for (const id of nodeIds) {
			this.updateElementContent({ kind: 'nodeLabelTextOverflow', id, textOverflow });
			this.propertyEdited('node', id, ['label_text_overflow']);
		}
		this.options.messageBus.publishCommand(new UpdateNodeLabelTextOverflowsCommand(nodeIds, textOverflow));
	}

	public updateNodeTypeDisplay(nodeIds: readonly string[], typeDisplay: 'inline' | 'stereotype'): void {
		for (const id of nodeIds) {
			this.updateElementContent({ kind: 'nodeTypeDisplay', id, typeDisplay });
			this.propertyEdited('node', id, ['type_display']);
		}
		this.options.messageBus.publishCommand(new UpdateNodeTypeDisplayCommand(nodeIds, typeDisplay));
	}

	public updateDiagramMetadata(patch: DiagramMetadataPatch, changedFields: readonly string[]): void {
		this.propertyEdited('diagram', 'diagram', changedFields);
		this.options.messageBus.publishCommand(new UpdateDiagramMetadataCommand(patch));
	}

	public fontField(value: string | undefined, commit: (value: string) => void): HTMLElement {
		return selectField('Font', value ?? '', fontFamilyOptions(value), (selectedValue) => {
			commit(selectedValue ?? '');
		});
	}

	public colorField(
		label: string,
		value: string,
		commit: (value: string) => void,
		role: CanvasColorRole = 'accent',
	): HTMLElement {
		return colorField(label, value, commit, canvasColorPalette(this.options.getTheme().mode, role));
	}

	public propertyEdited(elementType: CanvasElementType, elementIdentifier: string, changedFields: readonly string[]): void {
		this.options.messageBus.publishEvent(new CanvasPropertyEditedEvent({
			diagramFilePath: this.options.payload.file?.fsPath,
			elementIdentifier,
			elementType,
			changedFields,
		}));
	}

	public updateElementContent(update: Parameters<DiagramCanvasEngine['updateElementContent']>[0]): void {
		this.options.registry.updateContent(update);
		this.options.canvas.updateElementContent(update);
	}

	public commentFields(ontologyRef: string): HTMLElement[] {
		const comments = ontologyCommentsForReference(ontologyRef, this.options.payload);
		if (comments.length === 0) {
			return [];
		}

		return [readonlyField(comments.length === 1 ? 'Comment' : 'Comments', comments.join('\n\n'))];
	}

	public resizeNodeToFitDetails(node: DiagramNode, attributes: readonly { readonly text: string }[]): void {
		const theme = this.options.getTheme();
		const fontSize = node.style?.font?.size ?? theme.nodeFontSize;
		const fontFamily = node.style?.font?.family ?? theme.nodeFontFamily;
		const attributeItalic = node.style?.font?.italic ?? theme.nodeFontItalic;
		const attributeTextOverflow = nodeAttributeTextOverflow(node);
		const requiredWidth = requiredNodeWidthForDataProperties({
			title: nodeTitleText(node, this.options.payload),
			attributes,
			fontSize,
			fontFamily,
			titleBold: node.style?.font?.bold ?? theme.nodeFontBold,
			attributeItalic,
			attributeTextOverflow,
			minimumWidth: node.width,
		});
		const attributeFontSize = Math.max(9, fontSize - 1);
		const attributeLineCount = nodeAttributeTextLines({
			attributes,
			width: requiredWidth - 20,
			fontSize: attributeFontSize,
			fontFamily,
			italic: attributeItalic,
			textOverflow: attributeTextOverflow,
		}).length;
		const requiredHeight = requiredNodeHeightForDataProperties({
			attributeCount: attributes.length,
			attributeLineCount,
			fontSize,
			minimumHeight: Math.max(minimumNodeHeight, node.height),
		});
		if (requiredWidth <= node.width && requiredHeight <= node.height) {
			return;
		}

		const update = {
			id: node.id,
			x: node.x,
			y: node.y,
			width: requiredWidth,
			height: requiredHeight,
		};
		this.options.registry.updateBounds(update);
		this.options.canvas.restoreBounds([update]);
		this.propertyEdited('node', node.id, ['width', 'height']);
		this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand([update]));
	}
}
