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

export class EdgePropertyTabs {
	public constructor(
		private readonly options: CanvasPropertyPanelOptions,
		private readonly editor: CanvasPropertyEditor,
	) {}

	public multipleEdgeStyleSections(edges: readonly DiagramEdge[]): readonly HTMLElement[] {
		const edgeIds = edges.map((edge) => edge.id);
		const styles = edges.map((edge) => edge.style);
		const routeLayout = sharedValue(edges.map((edge) => edge.route_layout ?? ''));
		const lineColor = sharedValue(styles.map((style) => style?.color));
		const lineStyle = sharedValue(styles.map((style) => style?.line_style ?? ''));
		const lineWeight = sharedValue(styles.map((style) => style?.weight));
		const textColor = sharedValue(styles.map((style) => style?.text_color));
		const fontFamily = sharedValue(styles.map((style) => style?.font?.family));
		const fontSize = sharedValue(styles.map((style) => style?.font?.size));
		const bold = sharedValue(styles.map((style) => style?.font?.bold ?? false));
		const italic = sharedValue(styles.map((style) => style?.font?.italic ?? false));

		return [
			sectionElement('Routing', [
				mixedSelectField('Routing Type', routeLayout, edgeRouteLayoutOptions, (value) => {
					this.editor.updateEdgeRouteLayouts(edgeIds, value);
				}),
				actionButton('Optimize Edges', 'secondary', () => {
					this.editor.optimizeEdges(edgeIds);
				}),
			]),
			sectionElement('Style', [
				markMixedField(this.editor.colorField('Line Color', lineColor.mixed ? '' : lineColor.value ?? '', (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({ ...style, color: blankToUndefined(value) }));
				}), lineColor.mixed),
				mixedSelectField('Line Style', lineStyle, lineStyleOptions, (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({ ...style, line_style: value }));
				}),
				markMixedField(optionalNumberField('Line Weight', lineWeight.mixed ? undefined : lineWeight.value, (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({ ...style, weight: value }));
				}), lineWeight.mixed),
				markMixedField(this.editor.colorField('Label Text Color', textColor.mixed ? '' : textColor.value ?? '', (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({ ...style, text_color: blankToUndefined(value) }));
				}, 'foreground'), textColor.mixed),
				mixedSelectField('Font', normalizeSharedString(fontFamily), fontFamilyOptions(fontFamily.value), (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({
						...style,
						font: { ...style.font, family: blankToUndefined(value ?? '') },
					}));
				}),
				markMixedField(optionalNumberComboField('Font Size', fontSize.mixed ? undefined : fontSize.value, standardFontSizes, (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({
						...style,
						font: { ...style.font, size: value },
					}));
				}), fontSize.mixed),
				checkboxField('Bold', bold.value ?? false, (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({
						...style,
						font: { ...style.font, bold: value },
					}));
				}, bold.mixed),
				checkboxField('Italic', italic.value ?? false, (value) => {
					this.editor.updateEdgeStyles(edgeIds, (style) => ({
						...style,
						font: { ...style.font, italic: value },
					}));
				}, italic.mixed),
				actionButton('Clear Style', 'secondary', () => {
					this.editor.updateEdgeStyles(edgeIds, () => undefined);
				}),
			]),
		];
	}

	public edgeTabs(edge: DiagramEdge): readonly PropertyTab[] {
		const containmentDirection = edge.containment_direction ?? 'target_contains_source';
		const nodeIds = new Set((this.options.payload.diagram?.nodes ?? []).map((node) => node.id));
		const canRenderAsContainment = nodeIds.has(edge.source) && nodeIds.has(edge.target);
		const presentationFields = [
			...(canRenderAsContainment ? [selectField('Display as', edge.render_as ?? '', [
				{ value: '', label: 'Connection' },
				{ value: 'containment', label: 'Containment' },
			], (value) => {
				this.editor.propertyEdited('edge', edge.id, ['render_as', 'containment_direction']);
				this.options.messageBus.publishCommand(new UpdateEdgePresentationCommand(
					edge.id,
					value,
					value === 'containment' ? containmentDirection : undefined,
				));
			})] : []),
			...(edge.render_as === 'containment' ? [selectField('Container', containmentDirection, [
				{ value: 'target_contains_source', label: 'Target contains source' },
				{ value: 'source_contains_target', label: 'Source contains target' },
			], (value) => {
				this.editor.propertyEdited('edge', edge.id, ['containment_direction']);
				this.options.messageBus.publishCommand(new UpdateEdgePresentationCommand(
					edge.id,
					'containment',
					value ?? 'target_contains_source',
				));
			})] : []),
		];
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Ontology', [
						readonlyField('Ref', edge.ontology_ref),
						readonlyField('Label', edgeDisplayName(edge.ontology_ref, this.options.payload)),
						...this.editor.commentFields(edge.ontology_ref),
					]),
					sectionElement('Connection', [
						readonlyField('Source', edge.source),
						readonlyField('Target', edge.target),
					]),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					sectionElement('Routing', [
						selectField('Routing Type', edge.route_layout ?? '', edgeRouteLayoutOptions, (value) => {
							this.editor.updateEdgeRouteLayouts([edge.id], value);
						}),
						actionButton('Optimize Edge', 'secondary', () => {
							this.editor.optimizeEdges([edge.id]);
						}),
					]),
					...(presentationFields.length === 0 ? [] : [sectionElement('Presentation', presentationFields)]),
					this.editor.edgeStyleSection(edge.id, edge.style),
				],
			},
		];
	}

}

