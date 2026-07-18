import { minimumImageHeight, minimumImageWidth, minimumLabelHeight, minimumLabelWidth, minimumLegendHeight, minimumLegendWidth, minimumMetadataHeight, minimumMetadataWidth, minimumNodeHeight, minimumNodeWidth, minimumNoteHeight, minimumNoteWidth, type BoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasPropertyEditedEvent, type CanvasElementType } from '../../../shared/canvas-editor-events';
import { PickImageSourceCommand, UpdateDiagramMetadataCommand, UpdateElementStyleCommand, UpdateImageBoundsCommand, UpdateLabelBoundsCommand, UpdateLabelTextCommand, UpdateLegendBoundsCommand, UpdateLegendColorByCommand, UpdateLegendColorsCommand, UpdateMetadataBoundsCommand, UpdateNodeBoundsCommand, UpdateNodeDataPropertiesVisibilityCommand, UpdateNodeImageCommand, UpdateNodePropertyValueTextOverflowCommand, UpdateNodePropertyValuesVisibilityCommand, UpdateNodeTypeVisibilityCommand, UpdateNoteBoundsCommand, UpdateNoteExportVisibilityCommand, UpdateNoteTextCommand } from '../../../shared/webview-commands';
import type { BorderStylePatch, CommonStylePatch, DiagramMetadataPatch, EdgeStylePatch, ElementStylePatch, LabelStylePatch, StyledCanvasElementType } from '../../../shared/webview-commands';
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

interface CanvasPropertyPanelOptions {
	readonly canvas: Pick<DiagramCanvasEngine, 'restoreBounds' | 'updateElementContent'>;
	readonly payload: DiagramPayload;
	readonly registry: CanvasElementRegistry;
	readonly messageBus: CanvasMessageBus;
	readonly title: HTMLElement;
	readonly body: HTMLElement;
	readonly getTheme: () => WebviewTheme;
	readonly focusAfterEscape: () => void;
	readonly chooseNodeImage: (id: string) => void;
	readonly chooseStandaloneImage: (id: string) => void;
	readonly selectedTabByContext?: Map<string, string>;
}

interface PropertyTab {
	readonly id: string;
	readonly label: string;
	readonly sections: readonly HTMLElement[];
}

export class CanvasPropertyPanel {
	private selectedElement: CanvasPropertyElement | undefined;
	private selectedElementCount = 0;
	private readonly selectedTabByContext: Map<string, string>;

	public constructor(private readonly options: CanvasPropertyPanelOptions) {
		this.selectedTabByContext = options.selectedTabByContext ?? new Map<string, string>();
	}

	public register(): void {
		this.options.body.addEventListener('keydown', (event) => {
			event.stopPropagation();
			if (event.key === 'Escape') {
				event.preventDefault();
				this.renderSelection();
				this.options.focusAfterEscape();
			}
		});
		this.options.messageBus.subscribe((message) => {
			if (message.kind !== 'event') {
				return;
			}

			const event = message.payload;
			if (event.type === 'canvasSelectionChanged') {
				console.log('[ontology-diagram-editor] property-panel selection event received', {
					selectedElementIdentifier: event.selectedElementIdentifier,
					selectedElementType: event.selectedElementType,
					selectedElementCount: event.selectedElementIdentifiers.length,
				});
				this.selectedElementCount = event.selectedElementIdentifiers.length;
				this.selectedElement = event.selectedElementIdentifier === undefined
					? undefined
					: this.options.registry.element(event.selectedElementIdentifier);
				console.log('[ontology-diagram-editor] property-panel resolved selection', {
					kind: this.selectedElement?.kind,
					id: this.selectedElement?.value.id,
				});
				this.renderSelection();
			}
		});
		this.renderSelection();
	}

	private renderSelection(): void {
		this.options.body.textContent = '';
		if (this.selectedElement === undefined) {
			if (this.selectedElementCount > 1) {
				this.renderMultipleSelectionContext();
				return;
			}

			this.renderDiagramContext();
			return;
		}

		this.renderElement(this.selectedElement);
	}

	private renderMultipleSelectionContext(): void {
		this.renderContextHeader('Multiple selection', `${this.selectedElementCount} elements selected`);
		const message = document.createElement('p');
		message.className = 'property-empty-message';
		message.textContent = 'Select a single element to inspect and edit its properties.';
		this.options.body.appendChild(message);
	}

	private renderDiagramContext(): void {
		const file = this.options.payload.file;
		const diagram = this.options.payload.diagram;
		const metadata = diagram?.metadata;
		this.renderContextHeader('Diagram', fileName(file?.fsPath));
		this.renderTabs('diagram', [
			{
				id: 'summary',
				label: 'Summary',
				sections: [
					sectionElement('Diagram', [
						readonlyField('File', file?.fsPath ?? ''),
						readonlyField('Schema', metadata?.schema_version ?? ''),
						textField('Title', metadata?.title ?? '', (value) => {
							this.updateDiagramMetadata({ title: value }, ['title']);
						}),
						textField('Authors', authorsText(metadata?.authors ?? []), (value) => {
							this.updateDiagramMetadata({ authors: parseAuthorsText(value) }, ['authors']);
						}),
						textField('Version', metadata?.diagram_version ?? '', (value) => {
							this.updateDiagramMetadata({ diagram_version: value }, ['diagram_version']);
						}),
						textField('Theme', metadata?.theme_file ?? '', (value) => {
							this.updateDiagramMetadata({ theme_file: blankToUndefined(value) }, ['theme_file']);
						}),
						checkboxField('Show ontology labels', metadata?.show_ontology_information === true, (value) => {
							this.updateDiagramMetadata({ show_ontology_information: value }, ['show_ontology_information']);
						}),
						readonlyField('Ontologies', String(diagram?.ontologies?.length ?? 0)),
					]),
				],
			},
		]);
	}

	private renderElement(element: CanvasPropertyElement): void {
		this.renderContextHeader(capitalize(element.kind), element.value.id);

		if (element.kind === 'node') {
			this.renderTabs(element.value.id, this.nodeTabs(element.value));
		} else if (element.kind === 'edge') {
			this.renderTabs(element.value.id, this.edgeTabs(element.value));
		} else if (element.kind === 'note') {
			this.renderTabs(element.value.id, this.noteTabs(element.value));
		} else if (element.kind === 'label') {
			this.renderTabs(element.value.id, this.labelTabs(element.value));
		} else if (element.kind === 'metadata') {
			this.renderTabs(element.value.id, this.metadataTabs(element.value));
		} else if (element.kind === 'legend') {
			this.renderTabs(element.value.id, this.legendTabs(element.value));
		} else {
			this.renderTabs(element.value.id, this.imageTabs(element.value));
		}
	}

	private renderContextHeader(label: string, identifier?: string): void {
		this.options.title.textContent = '';
		const text = document.createElement('span');
		text.className = 'properties-context-text';
		const labelElement = document.createElement('strong');
		labelElement.className = 'properties-context-kind';
		labelElement.textContent = label;
		text.appendChild(labelElement);
		if (identifier !== undefined && identifier.length > 0) {
			const identifierElement = document.createElement('span');
			identifierElement.className = 'properties-context-id';
			identifierElement.textContent = identifier;
			identifierElement.title = identifier;
			text.appendChild(identifierElement);
		}
		this.options.title.appendChild(text);
	}

	private legendTabs(element: DiagramLegendElement): readonly PropertyTab[] {
		const entries = ontologyLegendEntries(this.options.payload);
		return [
			{ id: 'details', label: 'Details', sections: [sectionElement('Color Viewpoint', [
				selectField('Color Elements By', element.color_by ?? 'ontologySource', [
					{ value: 'ontologySource', label: 'Source Ontology' },
					{ value: 'elementType', label: 'Element Type' },
					{ value: 'none', label: 'None' },
				], (colorBy) => {
					this.propertyEdited('legend', element.id, ['color_by']);
					this.options.messageBus.publishCommand(new UpdateLegendColorByCommand(element.id, (colorBy ?? 'ontologySource') as 'ontologySource' | 'elementType' | 'none'));
				}),
			]), sectionElement('Color Application', [
				selectField('Apply Colors To', element.color_mode ?? 'border', [
					{ value: 'border', label: 'Node Borders' },
					{ value: 'background', label: 'Node Backgrounds' },
				], (colorMode) => {
					this.propertyEdited('legend', element.id, ['color_mode']);
					this.options.messageBus.publishCommand(new UpdateLegendColorsCommand(element.id, element.colors, colorMode ?? 'border', element.color_by));
				}),
			]), sectionElement('Legend Colors', entries.length === 0
				? [readonlyField('Status', 'Coloring is disabled.')]
				: entries.map((entry) => colorField(entry.label, element.colors[entry.key] ?? '#808080', (color) => {
					this.propertyEdited('legend', element.id, ['colors', entry.key]);
					this.options.messageBus.publishCommand(new UpdateLegendColorsCommand(element.id, { ...element.colors, [entry.key]: color }, element.color_mode, element.color_by));
				})))] },
			{ id: 'geometry', label: 'Geometry', sections: [sectionElement('Geometry', this.geometryFields(element, (update) => {
				this.propertyEdited('legend', element.id, ['x', 'y', 'width', 'height']);
				this.options.messageBus.publishCommand(new UpdateLegendBoundsCommand([update]));
			}, minimumLegendWidth, minimumLegendHeight))] },
			{ id: 'style', label: 'Style', sections: [this.commonStyleSection('legend', element.id, element.style)] },
		];
	}

	private metadataTabs(element: DiagramMetadataElement): readonly PropertyTab[] {
		const metadata = this.options.payload.diagram?.metadata;
		return [
			{ id: 'details', label: 'Details', sections: [sectionElement('Diagram Information', [
				readonlyField('Title', metadata?.title ?? ''),
				readonlyField('Author', authorsText(metadata?.authors ?? [])),
				readonlyField('Version', metadata?.diagram_version ?? ''),
			])] },
			{ id: 'geometry', label: 'Geometry', sections: [sectionElement('Geometry', this.geometryFields(element, (update) => {
				this.propertyEdited('metadata', element.id, ['x', 'y', 'width', 'height']);
				this.options.messageBus.publishCommand(new UpdateMetadataBoundsCommand([update]));
			}, minimumMetadataWidth, minimumMetadataHeight))] },
			{ id: 'style', label: 'Style', sections: [this.commonStyleSection('metadata', element.id, element.style)] },
		];
	}

	private nodeTabs(node: DiagramNode): readonly PropertyTab[] {
		const iconColor = embeddedGalleryIconColor(node.image);
		const dataPropertyAttributes = availableNodeDataPropertyAttributes(node, this.options.payload);
		const propertyValueAttributes = availableNodePropertyValueAttributes(node, this.options.payload);
		const annotationFields = ontologyAnnotationFieldsForReference(node.ontology_ref, this.options.payload);
		const ontologySections = [
			sectionElement('Ontology', [
				readonlyField('Ref', node.ontology_ref),
			]),
			...(annotationFields.length === 0 ? [] : [sectionElement('Annotations', annotationFields.map((annotation) =>
				readonlyField(annotation.label, annotation.value),
			))]),
			...(node.ontology_item_type === 'individual' ? [] : [
				sectionElement('Data Properties', [
					readonlyField('Data Properties', String(dataPropertyAttributes.length)),
					checkboxField('Show Data Properties', node.show_data_properties === true, (value) => {
						if (value) {
							this.resizeNodeToFitDetails({ ...node, show_data_properties: value }, dataPropertyAttributes);
						}
						this.propertyEdited('node', node.id, ['show_data_properties']);
						this.options.messageBus.publishCommand(new UpdateNodeDataPropertiesVisibilityCommand(node.id, value));
					}),
				]),
			]),
			...(node.ontology_item_type === 'individual' ? [
				sectionElement('Instance', [
					readonlyField('Property Values', String(propertyValueAttributes.length)),
					checkboxField('Show Type', node.show_type !== false, (value) => {
						const nextNode = { ...node, show_type: value };
						if (value) {
							this.resizeNodeToFitDetails(nextNode, node.show_property_values === true ? propertyValueAttributes : []);
						}
						this.propertyEdited('node', node.id, ['show_type']);
						this.options.messageBus.publishCommand(new UpdateNodeTypeVisibilityCommand(node.id, value));
					}),
					checkboxField('Show Property Values', node.show_property_values === true, (value) => {
						const nextNode = { ...node, show_property_values: value };
						if (value) {
							this.resizeNodeToFitDetails(nextNode, propertyValueAttributes);
						}
						this.propertyEdited('node', node.id, ['show_property_values']);
						this.options.messageBus.publishCommand(new UpdateNodePropertyValuesVisibilityCommand(node.id, value));
					}),
					selectField('Long Values', node.property_value_text_overflow ?? 'truncate', propertyValueTextOverflowOptions, (value) => {
						const textOverflow = value ?? 'truncate';
						const nextNode = {
							...node,
							property_value_text_overflow: textOverflow === 'wrap' ? textOverflow : undefined,
						};
						this.updateElementContent({ kind: 'nodePropertyValueTextOverflow', id: node.id, textOverflow });
						if (node.show_property_values === true) {
							this.resizeNodeToFitDetails(nextNode, propertyValueAttributes);
						}
						this.propertyEdited('node', node.id, ['property_value_text_overflow']);
						this.options.messageBus.publishCommand(new UpdateNodePropertyValueTextOverflowCommand(node.id, textOverflow));
					}),
				]),
			] : []),
		];
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Image', [
						imageField('Image', () => {
							this.options.chooseNodeImage(node.id);
						}, node.image === undefined ? undefined : () => {
							this.updateElementContent({ kind: 'nodeImage', id: node.id, image: undefined });
							this.propertyEdited('node', node.id, ['image']);
							this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, undefined));
						}),
						...(iconColor === undefined || node.image === undefined ? [] : [colorField('Icon Color', iconColor, (color) => {
							const image = recolorEmbeddedGalleryIcon(node.image ?? '', color);
							if (image === undefined) {
								return;
							}
							this.updateElementContent({ kind: 'nodeImage', id: node.id, image });
							this.propertyEdited('node', node.id, ['image']);
							this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, image));
						})]),
						...(node.image === undefined ? [] : [selectField('Fit', node.style?.image_fit ?? 'contain', nodeImageFitOptions, (value) => {
							const style = cloneCommonStyle(node.style);
							this.updateElementStyle('node', node.id, cleanCommonStyle({ ...style, image_fit: value ?? 'contain' }));
						})]),
					]),
				],
			},
			{ id: 'ontology', label: 'Ontology', sections: ontologySections },
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.geometryFields(node, (update) => {
						this.propertyEdited('node', node.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand([update]));
					}, minimumNodeWidth, minimumNodeHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.commonStyleSection('node', node.id, node.style),
				],
			},
		];
	}

	private edgeTabs(edge: DiagramEdge): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Ontology', [
						readonlyField('Ref', edge.ontology_ref),
						readonlyField('Label', edgeDisplayName(edge.ontology_ref)),
						...this.commentFields(edge.ontology_ref),
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
					this.edgeStyleSection(edge.id, edge.style),
				],
			},
		];
	}

	private noteTabs(note: DiagramNote): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Text', [
						textAreaField('Text', note.text, (value) => {
							this.updateElementContent({ kind: 'noteText', id: note.id, text: value });
							this.propertyEdited('note', note.id, ['text']);
							this.options.messageBus.publishCommand(new UpdateNoteTextCommand(note.id, value));
						}),
					]),
					sectionElement('Export', [
						checkboxField('Include in Export', note.export !== false, (value) => {
							this.updateElementContent({ kind: 'noteExport', id: note.id, exported: value });
							this.propertyEdited('note', note.id, ['export']);
							this.options.messageBus.publishCommand(new UpdateNoteExportVisibilityCommand(note.id, value));
						}),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.geometryFields(note, (update) => {
						this.propertyEdited('note', note.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateNoteBoundsCommand([update]));
					}, minimumNoteWidth, minimumNoteHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.commonStyleSection('note', note.id, note.style),
				],
			},
		];
	}

	private labelTabs(label: DiagramLabel): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					sectionElement('Text', [
						textAreaField('Text', label.text, (value) => {
							this.updateElementContent({ kind: 'labelText', id: label.id, text: value });
							this.propertyEdited('label', label.id, ['text']);
							this.options.messageBus.publishCommand(new UpdateLabelTextCommand(label.id, value));
						}),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.geometryFields(label, (update) => {
						this.propertyEdited('label', label.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateLabelBoundsCommand([update]));
					}, minimumLabelWidth, minimumLabelHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.labelStyleSection(label.id, label.style),
				],
			},
		];
	}

	private imageTabs(image: DiagramImage): readonly PropertyTab[] {
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
						...(iconColor === undefined ? [] : [colorField('Icon Color', iconColor, (color) => {
							const source = recolorEmbeddedGalleryIcon(image.source, color);
							if (source === undefined) {
								return;
							}
							this.propertyEdited('image', image.id, ['source']);
							this.options.messageBus.publishCommand(new PickImageSourceCommand(image.id, source, false));
						})]),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.geometryFields(image, (update) => {
						this.propertyEdited('image', image.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateImageBoundsCommand([update]));
					}, minimumImageWidth, minimumImageHeight)),
				],
			},
			{
				id: 'style',
				label: 'Style',
				sections: [
					this.imageStyleSection(image.id, image.style),
				],
			},
		];
	}

	private renderTabs(contextId: string, tabs: readonly PropertyTab[]): void {
		const selectedTabId = this.selectedTabByContext.get(contextId);
		const activeTab = tabs.find((tab) => tab.id === selectedTabId) ?? tabs[0];
		if (activeTab === undefined) {
			return;
		}

		const wrapper = document.createElement('div');
		wrapper.className = 'property-tabs';
		const tabList = document.createElement('div');
		tabList.className = 'property-tab-list';
		tabList.setAttribute('role', 'tablist');
		const panes = document.createElement('div');
		panes.className = 'property-tab-panes';

		const tabButtons = new Map<string, HTMLButtonElement>();
		const tabPanes = new Map<string, HTMLElement>();
		const activateTab = (tabId: string): void => {
			this.selectedTabByContext.set(contextId, tabId);
			for (const [id, button] of tabButtons) {
				const selected = id === tabId;
				button.setAttribute('aria-selected', String(selected));
				button.tabIndex = selected ? 0 : -1;
			}
			for (const [id, pane] of tabPanes) {
				pane.hidden = id !== tabId;
			}
		};

		tabs.forEach((tab, index) => {
			const tabIdentifier = `property-tab-${contextId}-${tab.id}`.replace(/[^A-Za-z0-9_-]/g, '-');
			const paneIdentifier = `${tabIdentifier}-pane`;
			const button = document.createElement('button');
			button.className = 'property-tab';
			button.type = 'button';
			button.id = tabIdentifier;
			button.textContent = tab.label;
			button.setAttribute('role', 'tab');
			button.setAttribute('aria-controls', paneIdentifier);
			button.addEventListener('click', () => {
				activateTab(tab.id);
			});
			button.addEventListener('keydown', (event) => {
				if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') {
					return;
				}

				event.preventDefault();
				const direction = event.key === 'ArrowRight' ? 1 : -1;
				const nextIndex = (index + direction + tabs.length) % tabs.length;
				const nextTab = tabs[nextIndex];
				if (nextTab !== undefined) {
					activateTab(nextTab.id);
					tabButtons.get(nextTab.id)?.focus();
				}
			});
			tabList.appendChild(button);
			tabButtons.set(tab.id, button);

			const pane = document.createElement('div');
			pane.className = 'property-tab-pane';
			pane.id = paneIdentifier;
			pane.setAttribute('role', 'tabpanel');
			pane.setAttribute('aria-labelledby', tabIdentifier);
			pane.append(...tab.sections);
			panes.appendChild(pane);
			tabPanes.set(tab.id, pane);
		});

		wrapper.append(tabList, panes);
		this.options.body.appendChild(wrapper);
		activateTab(activeTab.id);
	}

	private geometryFields(
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

	private commonStyleSection(elementType: 'node' | 'note' | 'metadata' | 'legend', id: string, style: DiagramElementStyle | undefined): HTMLElement {
		const commit = (nextStyle: CommonStylePatch | undefined): void => {
			this.updateElementStyle(elementType, id, nextStyle);
		};
		const patch = (): CommonStylePatch => cloneCommonStyle(style);

		return sectionElement('Style', [
			colorField('Fill Color', style?.bg_color ?? '', (value) => {
				commit(cleanCommonStyle({ ...patch(), bg_color: blankToUndefined(value) }));
			}),
			colorField('Text Color', style?.text_color ?? '', (value) => {
				commit(cleanCommonStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}),
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
			colorField('Border Color', style?.border?.color ?? '', (value) => {
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

	private imageStyleSection(id: string, style: DiagramElementStyle | undefined): HTMLElement {
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
			colorField('Border Color', style?.border?.color ?? '', (value) => {
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

	private edgeStyleSection(id: string, style: DiagramEdgeStyle | undefined): HTMLElement {
		const commit = (nextStyle: EdgeStylePatch | undefined): void => {
			this.updateElementStyle('edge', id, nextStyle);
		};
		const patch = (): EdgeStylePatch => cloneEdgeStyle(style);

		return sectionElement('Style', [
			colorField('Line Color', style?.color ?? '', (value) => {
				commit(cleanEdgeStyle({ ...patch(), color: blankToUndefined(value) }));
			}),
			selectField('Line Style', style?.line_style ?? '', lineStyleOptions, (value) => {
				commit(cleanEdgeStyle({ ...patch(), line_style: value }));
			}),
			optionalNumberField('Line Weight', style?.weight, (value) => {
				commit(cleanEdgeStyle({ ...patch(), weight: value }));
			}),
			colorField('Label Text Color', style?.text_color ?? '', (value) => {
				commit(cleanEdgeStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}),
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

	private labelStyleSection(id: string, style: DiagramLabelStyle | undefined): HTMLElement {
		const commit = (nextStyle: LabelStylePatch | undefined): void => {
			this.updateElementStyle('label', id, nextStyle);
		};
		const patch = (): LabelStylePatch => cloneLabelStyle(style);

		return sectionElement('Style', [
			colorField('Text Color', style?.text_color ?? '', (value) => {
				commit(cleanLabelStyle({ ...patch(), text_color: blankToUndefined(value) }));
			}),
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

	private updateElementStyle(elementType: StyledCanvasElementType, id: string, style: ElementStylePatch | undefined): void {
		this.options.registry.updateStyle(elementType, id, style);
		this.propertyEdited(elementType, id, ['style']);
		this.options.messageBus.publishCommand(new UpdateElementStyleCommand(elementType, id, style));
	}

	private updateDiagramMetadata(patch: DiagramMetadataPatch, changedFields: readonly string[]): void {
		this.propertyEdited('diagram', 'diagram', changedFields);
		this.options.messageBus.publishCommand(new UpdateDiagramMetadataCommand(patch));
	}

	private fontField(value: string | undefined, commit: (value: string) => void): HTMLElement {
		return selectField('Font', value ?? '', fontFamilyOptions(value), (selectedValue) => {
			commit(selectedValue ?? '');
		});
	}

	private propertyEdited(elementType: CanvasElementType, elementIdentifier: string, changedFields: readonly string[]): void {
		this.options.messageBus.publishEvent(new CanvasPropertyEditedEvent({
			diagramFilePath: this.options.payload.file?.fsPath,
			elementIdentifier,
			elementType,
			changedFields,
		}));
	}

	private updateElementContent(update: Parameters<DiagramCanvasEngine['updateElementContent']>[0]): void {
		this.options.registry.updateContent(update);
		this.options.canvas.updateElementContent(update);
	}

	private commentFields(ontologyRef: string): HTMLElement[] {
		const comments = ontologyCommentsForReference(ontologyRef, this.options.payload);
		if (comments.length === 0) {
			return [];
		}

		return [readonlyField(comments.length === 1 ? 'Comment' : 'Comments', comments.join('\n\n'))];
	}

	private resizeNodeToFitDetails(node: DiagramNode, attributes: readonly { readonly text: string }[]): void {
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

function capitalize(value: string): string {
	return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function fileName(filePath: string | undefined): string | undefined {
	return filePath?.split(/[/\\]/u).filter((part) => part.length > 0).at(-1);
}

function authorsText(authors: readonly string[]): string {
	return authors.join(', ');
}

function parseAuthorsText(value: string): readonly string[] {
	return value
		.split(',')
		.map((author) => author.trim())
		.filter((author) => author.length > 0);
}

const borderTypeOptions = [
	{ value: '', label: 'Default' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' },
	{ value: 'none', label: 'None' },
] as const;

const lineStyleOptions = [
	{ value: '', label: 'Default' },
	{ value: 'solid', label: 'Solid' },
	{ value: 'dashed', label: 'Dashed' },
	{ value: 'dotted', label: 'Dotted' },
	{ value: 'none', label: 'None' },
] as const;

const propertyValueTextOverflowOptions = [
	{ value: 'truncate', label: 'Truncate' },
	{ value: 'wrap', label: 'Wrap' },
] as const;

const defaultFontFamilyOptions = [
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

const standardFontSizes = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 64] as const;
const standardCornerRadii = [0, 2, 4, 6, 8, 12, 16, 24, 32] as const;

const shadowOptions = [
	{ value: '', label: 'Default' },
	{ value: 'true', label: 'On' },
	{ value: 'false', label: 'Off' },
] as const;

const nodeImageFitOptions = [
	{ value: 'contain', label: 'Contain' },
	{ value: 'cover', label: 'Cover' },
	{ value: 'match_width', label: 'Match Width' },
	{ value: 'match_height', label: 'Match Height' },
] as const;

function fontFamilyOptions(currentValue: string | undefined): readonly { readonly value: string; readonly label: string }[] {
	const current = currentValue?.trim();
	if (current === undefined || current.length === 0 || defaultFontFamilyOptions.some((option) => option.value === current)) {
		return defaultFontFamilyOptions;
	}

	return [
		{ value: current, label: current },
		...defaultFontFamilyOptions,
	];
}

function cloneCommonStyle(style: DiagramElementStyle | undefined): CommonStylePatch {
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

function cloneEdgeStyle(style: DiagramEdgeStyle | undefined): EdgeStylePatch {
	return {
		color: style?.color,
		line_style: style?.line_style,
		weight: style?.weight,
		text_color: style?.text_color,
		font: cloneFontStyle(style?.font),
	};
}

function cloneLabelStyle(style: DiagramLabelStyle | undefined): LabelStylePatch {
	return {
		text_color: style?.text_color,
		font: cloneFontStyle(style?.font),
	};
}

function cloneFontStyle(style: DiagramElementStyle['font'] | undefined): NonNullable<CommonStylePatch['font']> | undefined {
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

function cleanCommonStyle(style: CommonStylePatch): CommonStylePatch | undefined {
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

function cleanEdgeStyle(style: EdgeStylePatch): EdgeStylePatch | undefined {
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

function cleanLabelStyle(style: LabelStylePatch): LabelStylePatch | undefined {
	const font = cleanFontStyle(style.font);
	const cleaned = {
		text_color: style.text_color,
		font,
	};

	return hasAnyValue(cleaned) ? cleaned : undefined;
}

function cleanFontStyle(style: CommonStylePatch['font'] | undefined): CommonStylePatch['font'] | undefined {
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

function cleanBorderStyle(style: BorderStylePatch | undefined): BorderStylePatch | undefined {
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

function blankToUndefined(value: string): string | undefined {
	const trimmed = value.trim();

	return trimmed.length === 0 ? undefined : trimmed;
}

function shadowValue(value: boolean | undefined): '' | 'true' | 'false' {
	return value === undefined ? '' : String(value) as 'true' | 'false';
}

function hasAnyValue(value: Record<string, unknown>): boolean {
	return Object.values(value).some((entry) => entry !== undefined);
}
