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

import { CanvasPropertyEditor } from './canvas-property-editor';

export class NodePropertyTabs {
	public constructor(
		private readonly options: CanvasPropertyPanelOptions,
		private readonly editor: CanvasPropertyEditor,
	) {}

	public multipleNodeStyleSections(nodes: readonly DiagramNode[]): readonly HTMLElement[] {
		const nodeIds = nodes.map((node) => node.id);
		const styles = nodes.map((node) => node.style);
		const fillColor = sharedValue(styles.map((style) => style?.bg_color));
		const textColor = sharedValue(styles.map((style) => style?.text_color));
		const fontFamily = sharedValue(styles.map((style) => style?.font?.family));
		const fontSize = sharedValue(styles.map((style) => style?.font?.size));
		const bold = sharedValue(styles.map((style) => style?.font?.bold ?? false));
		const italic = sharedValue(styles.map((style) => style?.font?.italic ?? false));
		const borderType = sharedValue(styles.map((style) => style?.border?.type ?? ''));
		const borderWeight = sharedValue(styles.map((style) => style?.border?.weight));
		const borderColor = sharedValue(styles.map((style) => style?.border?.color));
		const cornerRadius = sharedValue(styles.map((style) => style?.corner_radius));
		const shadow = sharedValue(styles.map((style) => shadowValue(style?.shadow)));

		return [
			sectionElement('Style', [
				markMixedField(this.editor.colorField('Fill Color', fillColor.mixed ? '' : fillColor.value ?? '', (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({ ...style, bg_color: blankToUndefined(value) }));
				}, 'surface'), fillColor.mixed),
				markMixedField(this.editor.colorField('Text Color', textColor.mixed ? '' : textColor.value ?? '', (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({ ...style, text_color: blankToUndefined(value) }));
				}, 'foreground'), textColor.mixed),
				mixedSelectField('Font', normalizeSharedString(fontFamily), fontFamilyOptions(fontFamily.value), (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						font: { ...style.font, family: blankToUndefined(value ?? '') },
					}));
				}),
				markMixedField(optionalNumberComboField('Font Size', fontSize.mixed ? undefined : fontSize.value, standardFontSizes, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						font: { ...style.font, size: value },
					}));
				}), fontSize.mixed),
				checkboxField('Bold', bold.value ?? false, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						font: { ...style.font, bold: value },
					}));
				}, bold.mixed),
				checkboxField('Italic', italic.value ?? false, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						font: { ...style.font, italic: value },
					}));
				}, italic.mixed),
				mixedSelectField('Border', borderType, borderTypeOptions, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						border: { ...style.border, type: value },
					}));
				}),
				markMixedField(optionalNumberField('Border Weight', borderWeight.mixed ? undefined : borderWeight.value, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						border: { ...style.border, weight: value },
					}));
				}), borderWeight.mixed),
				markMixedField(this.editor.colorField('Border Color', borderColor.mixed ? '' : borderColor.value ?? '', (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						border: { ...style.border, color: blankToUndefined(value) },
					}));
				}), borderColor.mixed),
				markMixedField(optionalNumberComboField('Corner Radius', cornerRadius.mixed ? undefined : cornerRadius.value, standardCornerRadii, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({ ...style, corner_radius: value }));
				}), cornerRadius.mixed),
				mixedSelectField('Drop Shadow', shadow, shadowOptions, (value) => {
					this.editor.updateNodeStyles(nodeIds, (style) => ({
						...style,
						shadow: value === undefined ? undefined : value === 'true',
					}));
				}),
				actionButton('Clear Style', 'secondary', () => {
					this.editor.updateNodeStyles(nodeIds, () => undefined);
				}),
			]),
		];
	}

	public multipleNodeDisplaySections(nodes: readonly DiagramNode[]): readonly HTMLElement[] {
		const nodeIds = nodes.map((node) => node.id);
		const labelOverflow = sharedValue(nodes.map((node) => node.label_text_overflow ?? 'truncate'));
		const individualSections = nodes.every((node) => node.ontology_item_type === 'individual')
			? [sectionElement('Instance', [
				mixedSelectField('Display Type', sharedValue(nodes.map((node) => node.type_display ?? 'inline')), individualTypeDisplayOptions, (value) => {
					this.editor.updateNodeTypeDisplay(nodeIds, value ?? 'inline');
				}),
			])]
			: [];
		return [
			sectionElement('Label', [
				mixedSelectField('Overflow', labelOverflow, nodeLabelTextOverflowOptions, (value) => {
					this.editor.updateNodeLabelTextOverflow(nodeIds, value ?? 'truncate');
				}),
			]),
			...individualSections,
		];
	}

	public nodeTabs(node: DiagramNode): readonly PropertyTab[] {
		const iconColor = embeddedGalleryIconColor(node.image);
		const dataPropertyAttributes = availableNodeDataPropertyAttributes(node, this.options.payload);
		const propertyValueAttributes = availableNodePropertyValueAttributes(node, this.options.payload);
		const annotationFields = ontologyAnnotationFieldsForReference(node.ontology_ref, this.options.payload);
		const containmentEdges = (this.options.payload.diagram?.edges ?? []).filter((edge) =>
			edge.render_as === 'containment'
			&& edge.containment_direction !== undefined
			&& (edge.source === node.id || edge.target === node.id));
		const containmentSections = containmentEdges.length === 0 ? [] : [sectionElement('Containment', containmentEdges.flatMap((edge) => {
			const endpoints = serializedContainmentEndpoints(edge);
			const role = endpoints.parentNodeId === node.id
				? `Contains ${endpoints.childNodeId}`
				: `Inside ${endpoints.parentNodeId}`;
			return [
				readonlyField(edgeDisplayName(edge.ontology_ref, this.options.payload), role),
				actionButton(`Show ${edgeDisplayName(edge.ontology_ref, this.options.payload)} as connection`, 'secondary', () => {
					this.editor.propertyEdited('edge', edge.id, ['render_as', 'containment_direction']);
					this.options.messageBus.publishCommand(new UpdateEdgePresentationCommand(edge.id));
				}),
			];
		}))];
		const ontologySections = [
			sectionElement('Ontology', [
				readonlyField('Ref', node.ontology_ref),
			]),
			...(annotationFields.length === 0 ? [] : [sectionElement('Annotations', annotationFields.map((annotation) =>
				readonlyField(annotation.label, annotation.value),
			))]),
			...(node.ontology_item_type === 'individual'
				? [sectionElement('Instance', [readonlyField('Property Values', String(propertyValueAttributes.length))])]
				: [sectionElement('Data Properties', [readonlyField('Data Properties', String(dataPropertyAttributes.length))])]),
		];
		const displaySections = [
			...(node.ontology_item_type === 'individual' ? [
				sectionElement('Instance', [
					checkboxField('Show Type', node.show_type !== false, (value) => {
						const nextNode = { ...node, show_type: value };
						if (value) {
							this.editor.resizeNodeToFitDetails(nextNode, node.show_property_values === true ? propertyValueAttributes : []);
						}
						this.editor.propertyEdited('node', node.id, ['show_type']);
						this.options.messageBus.publishCommand(new UpdateNodeTypeVisibilityCommand(node.id, value));
					}),
					selectField('Display Type', node.type_display ?? 'inline', individualTypeDisplayOptions, (value) => {
						const typeDisplay = value ?? 'inline';
						const nextNode = {
							...node,
							type_display: typeDisplay === 'stereotype' ? typeDisplay : undefined,
						};
						this.editor.updateElementContent({ kind: 'nodeTypeDisplay', id: node.id, typeDisplay });
						if (node.show_type !== false) {
							this.editor.resizeNodeToFitDetails(nextNode, node.show_property_values === true ? propertyValueAttributes : []);
						}
						this.editor.propertyEdited('node', node.id, ['type_display']);
						this.options.messageBus.publishCommand(new UpdateNodeTypeDisplayCommand([node.id], typeDisplay));
					}),
					checkboxField('Show Property Values', node.show_property_values === true, (value) => {
						const nextNode = { ...node, show_property_values: value };
						if (value) {
							this.editor.resizeNodeToFitDetails(nextNode, propertyValueAttributes);
						}
						this.editor.propertyEdited('node', node.id, ['show_property_values']);
						this.options.messageBus.publishCommand(new UpdateNodePropertyValuesVisibilityCommand(node.id, value));
					}),
					selectField('Long Values', node.property_value_text_overflow ?? 'truncate', propertyValueTextOverflowOptions, (value) => {
						const textOverflow = value ?? 'truncate';
						const nextNode = {
							...node,
							property_value_text_overflow: textOverflow === 'wrap' ? textOverflow : undefined,
						};
						this.editor.updateElementContent({ kind: 'nodePropertyValueTextOverflow', id: node.id, textOverflow });
						if (node.show_property_values === true) {
							this.editor.resizeNodeToFitDetails(nextNode, propertyValueAttributes);
						}
						this.editor.propertyEdited('node', node.id, ['property_value_text_overflow']);
						this.options.messageBus.publishCommand(new UpdateNodePropertyValueTextOverflowCommand(node.id, textOverflow));
					}),
				]),
			] : [
				sectionElement('Data Properties', [
					checkboxField('Show Data Properties', node.show_data_properties === true, (value) => {
						if (value) {
							this.editor.resizeNodeToFitDetails({ ...node, show_data_properties: value }, dataPropertyAttributes);
						}
						this.editor.propertyEdited('node', node.id, ['show_data_properties']);
						this.options.messageBus.publishCommand(new UpdateNodeDataPropertiesVisibilityCommand(node.id, value));
					}),
				]),
			]),
			sectionElement('Label', [
				selectField('Overflow', node.label_text_overflow ?? 'truncate', nodeLabelTextOverflowOptions, (value) => {
					const textOverflow = value ?? 'truncate';
					this.editor.updateElementContent({ kind: 'nodeLabelTextOverflow', id: node.id, textOverflow });
					this.editor.propertyEdited('node', node.id, ['label_text_overflow']);
					this.options.messageBus.publishCommand(new UpdateNodeLabelTextOverflowCommand(node.id, textOverflow));
				}),
			]),
			sectionElement('Image', [
				imageField('Image', () => {
					this.options.chooseNodeImage(node.id);
				}, node.image === undefined ? undefined : () => {
					this.editor.updateElementContent({ kind: 'nodeImage', id: node.id, image: undefined });
					this.editor.propertyEdited('node', node.id, ['image']);
					this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, undefined));
				}),
				...(iconColor === undefined || node.image === undefined ? [] : [this.editor.colorField('Icon Color', iconColor, (color) => {
					const image = recolorEmbeddedGalleryIcon(node.image ?? '', color);
					if (image === undefined) {
						return;
					}
					this.editor.updateElementContent({ kind: 'nodeImage', id: node.id, image });
					this.editor.propertyEdited('node', node.id, ['image']);
					this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, image));
				})]),
				...(node.image === undefined ? [] : [selectField('Fit', node.style?.image_fit ?? 'contain', nodeImageFitOptions, (value) => {
					const style = cloneCommonStyle(node.style);
					this.editor.updateElementStyle('node', node.id, cleanCommonStyle({ ...style, image_fit: value ?? 'contain' }));
				})]),
			]),
			...containmentSections,
		];
		return [
			{
				id: 'display',
				label: 'Display',
				sections: displaySections,
			},
			{ id: 'ontology', label: 'Ontology', sections: ontologySections },
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.editor.geometryFields(node, (update) => {
						this.editor.propertyEdited('node', node.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand([update]));
					}, minimumNodeWidth, minimumNodeHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.editor.commonStyleSection('node', node.id, node.style),
				],
			},
		];
	}

}

