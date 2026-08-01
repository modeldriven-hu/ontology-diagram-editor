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

export class AuxiliaryPropertyTabs {
	public constructor(
		private readonly options: CanvasPropertyPanelOptions,
		private readonly editor: CanvasPropertyEditor,
	) {}

	public legendTabs(element: DiagramLegendElement): readonly PropertyTab[] {
		const entries = ontologyLegendEntries(this.options.payload);
		return [
			{ id: 'details', label: 'Details', sections: [sectionElement('Color Viewpoint', [
				selectField('Color Elements By', element.color_by ?? 'ontologySource', [
					{ value: 'ontologySource', label: 'Source Ontology' },
					{ value: 'elementType', label: 'Element Type' },
					{ value: 'none', label: 'None' },
				], (colorBy) => {
					this.editor.propertyEdited('legend', element.id, ['color_by']);
					this.options.messageBus.publishCommand(new UpdateLegendColorByCommand(element.id, (colorBy ?? 'ontologySource') as 'ontologySource' | 'elementType' | 'none'));
				}),
			]), sectionElement('Color Application', [
				selectField('Apply Colors To', element.color_mode ?? 'border', [
					{ value: 'border', label: 'Node Borders' },
					{ value: 'background', label: 'Node Backgrounds' },
				], (colorMode) => {
					this.editor.propertyEdited('legend', element.id, ['color_mode']);
					this.options.messageBus.publishCommand(new UpdateLegendColorsCommand(element.id, element.colors, colorMode ?? 'border', element.color_by));
				}),
			]), sectionElement('Legend Colors', entries.length === 0
				? [readonlyField('Status', 'Coloring is disabled.')]
				: entries.map((entry) => this.editor.colorField(entry.label, element.colors[entry.key] ?? '#808080', (color) => {
					this.editor.propertyEdited('legend', element.id, ['colors', entry.key]);
					this.options.messageBus.publishCommand(new UpdateLegendColorsCommand(element.id, { ...element.colors, [entry.key]: color }, element.color_mode, element.color_by));
				}, element.color_mode === 'background' ? 'surface' : 'accent')))] },
			{ id: 'geometry', label: 'Geometry', sections: [sectionElement('Geometry', this.editor.geometryFields(element, (update) => {
				this.editor.propertyEdited('legend', element.id, ['x', 'y', 'width', 'height']);
				this.options.messageBus.publishCommand(new UpdateLegendBoundsCommand([update]));
			}, minimumLegendWidth, minimumLegendHeight))] },
			{ id: 'style', label: 'Style', sections: [this.editor.commonStyleSection('legend', element.id, element.style)] },
		];
	}

	public metadataTabs(element: DiagramMetadataElement): readonly PropertyTab[] {
		const metadata = this.options.payload.diagram?.metadata;
		return [
			{ id: 'details', label: 'Details', sections: [sectionElement('Diagram Information', [
				readonlyField('Title', metadata?.title ?? ''),
				readonlyField('Author', authorsText(metadata?.authors ?? [])),
				readonlyField('Version', metadata?.diagram_version ?? ''),
			])] },
			{ id: 'geometry', label: 'Geometry', sections: [sectionElement('Geometry', this.editor.geometryFields(element, (update) => {
				this.editor.propertyEdited('metadata', element.id, ['x', 'y', 'width', 'height']);
				this.options.messageBus.publishCommand(new UpdateMetadataBoundsCommand([update]));
			}, minimumMetadataWidth, minimumMetadataHeight))] },
			{ id: 'style', label: 'Style', sections: [this.editor.commonStyleSection('metadata', element.id, element.style)] },
		];
	}

	public noteTabs(note: DiagramNote): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Text', [
						textAreaField('Text', note.text, (value) => {
							this.editor.updateElementContent({ kind: 'noteText', id: note.id, text: value });
							this.editor.propertyEdited('note', note.id, ['text']);
							this.options.messageBus.publishCommand(new UpdateNoteTextCommand(note.id, value));
						}),
					]),
					sectionElement('Export', [
						checkboxField('Include in Export', note.export !== false, (value) => {
							this.editor.updateElementContent({ kind: 'noteExport', id: note.id, exported: value });
							this.editor.propertyEdited('note', note.id, ['export']);
							this.options.messageBus.publishCommand(new UpdateNoteExportVisibilityCommand(note.id, value));
						}),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.editor.geometryFields(note, (update) => {
						this.editor.propertyEdited('note', note.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateNoteBoundsCommand([update]));
					}, minimumNoteWidth, minimumNoteHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.editor.commonStyleSection('note', note.id, note.style),
				],
			},
		];
	}

	public labelTabs(label: DiagramLabel): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Text', [
						textAreaField('Text', label.text, (value) => {
							this.editor.updateElementContent({ kind: 'labelText', id: label.id, text: value });
							this.editor.propertyEdited('label', label.id, ['text']);
							this.options.messageBus.publishCommand(new UpdateLabelTextCommand(label.id, value));
						}),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.editor.geometryFields(label, (update) => {
						this.editor.propertyEdited('label', label.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateLabelBoundsCommand([update]));
					}, minimumLabelWidth, minimumLabelHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.editor.labelStyleSection(label.id, label.style),
				],
			},
		];
	}

	public imageTabs(image: DiagramImage): readonly PropertyTab[] {
		const iconColor = embeddedGalleryIconColor(image.source);
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Image', [
						imageField('Source', () => {
							this.options.chooseStandaloneImage(image.id);
						}),
						...(iconColor === undefined ? [] : [this.editor.colorField('Icon Color', iconColor, (color) => {
							const source = recolorEmbeddedGalleryIcon(image.source, color);
							if (source === undefined) {
								return;
							}
							this.editor.propertyEdited('image', image.id, ['source']);
							this.options.messageBus.publishCommand(new PickImageSourceCommand(image.id, source, false));
						})]),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.editor.geometryFields(image, (update) => {
						this.editor.propertyEdited('image', image.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateImageBoundsCommand([update]));
					}, minimumImageWidth, minimumImageHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.editor.imageStyleSection(image.id, image.style),
				],
			},
		];
	}

}

