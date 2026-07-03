import { minimumNodeHeight, type BoundsUpdate } from '../../../shared/canvas-geometry';
import { CanvasPropertyEditedEvent, CanvasPropertyPanelVisibilityChangedEvent, type CanvasElementType } from '../../../shared/canvas-editor-events';
import { DeleteEdgeCommand, PickImageSourceCommand, PickNodeImageCommand, UpdateElementStyleCommand, UpdateImageBoundsCommand, UpdateImageSourceCommand, UpdateLabelBoundsCommand, UpdateLabelTextCommand, UpdateNodeBoundsCommand, UpdateNodeDataPropertiesVisibilityCommand, UpdateNodeImageCommand, UpdateNoteBoundsCommand, UpdateNoteTextCommand } from '../../../shared/webview-commands';
import type { BorderStylePatch, CommonStylePatch, EdgeStylePatch, ElementStylePatch, LabelStylePatch, StyledCanvasElementType } from '../../../shared/webview-commands';
import type { DiagramEdge, DiagramElementStyle, DiagramEdgeStyle, DiagramImage, DiagramLabel, DiagramLabelStyle, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import type { CanvasElementRegistry, CanvasPropertyElement } from './canvas-element-registry';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import { actionButton, checkboxField, colorField, imageField, numberField, optionalNumberComboField, optionalNumberField, readonlyField, sectionElement, selectField, textAreaField } from './canvas-property-fields';
import type { DiagramCanvasEngine } from '../engine/diagram-canvas-engine';
import { edgeDisplayName } from './ontology-diagram-edges';
import { availableNodeDataPropertyAttributes, ontologyDisplayName, requiredNodeHeightForDataProperties, requiredNodeWidthForDataProperties } from './node-data-properties';
import type { WebviewTheme } from '../webview-theme';

interface CanvasPropertyPanelOptions {
	readonly canvas: Pick<DiagramCanvasEngine, 'restoreBounds' | 'updateElementContent'>;
	readonly payload: DiagramPayload;
	readonly registry: CanvasElementRegistry;
	readonly messageBus: CanvasMessageBus;
	readonly panel: HTMLElement;
	readonly resizeHandle: HTMLElement;
	readonly title: HTMLElement;
	readonly toggleButton: HTMLButtonElement;
	readonly body: HTMLElement;
	readonly getTheme: () => WebviewTheme;
	readonly showStatus: (message: string) => void;
	readonly resetEdgeLabel: (edgeId: string) => void;
	readonly focusAfterEscape: () => void;
	readonly initialCollapsed?: boolean;
	readonly initialWidth?: number;
	readonly onCollapsedChange?: (collapsed: boolean) => void;
	readonly onWidthChange?: (width: number) => void;
}

interface PropertyTab {
	readonly id: string;
	readonly label: string;
	readonly sections: readonly HTMLElement[];
}

export class CanvasPropertyPanel {
	private collapsed = false;
	private panelWidth?: number;
	private selectedElement: CanvasPropertyElement | undefined;
	private readonly selectedTabByContext = new Map<string, string>();

	public constructor(private readonly options: CanvasPropertyPanelOptions) {}

	public register(): void {
		if (this.options.initialWidth !== undefined) {
			this.applyWidth(this.options.initialWidth, false);
		}
		this.setCollapsed(this.options.initialCollapsed ?? false, false);
		this.registerResizeHandle();
		this.options.toggleButton.addEventListener('click', () => {
			this.setCollapsed(!this.collapsed);
		});
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
				});
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

	private setCollapsed(collapsed: boolean, notify = true): void {
		this.collapsed = collapsed;
		this.options.panel.classList.toggle('collapsed', collapsed);
		this.options.panel.closest('.editor')?.classList.toggle('property-panel-collapsed', collapsed);
		this.options.toggleButton.setAttribute('aria-expanded', String(!collapsed));
		this.options.messageBus.publishEvent(new CanvasPropertyPanelVisibilityChangedEvent({
			diagramFilePath: this.options.payload.file?.fsPath,
			visible: true,
			collapsed,
			panelHeight: this.options.panel.getBoundingClientRect().height,
		}));
		if (notify) {
			this.options.onCollapsedChange?.(collapsed);
		}
	}

	private registerResizeHandle(): void {
		let startX = 0;
		let startWidth = 0;
		let activePointerId: number | undefined;
		const editor = this.editorElement();

		this.options.resizeHandle.addEventListener('pointerdown', (event) => {
			if (this.collapsed || editor === undefined) {
				return;
			}

			activePointerId = event.pointerId;
			startX = event.clientX;
			startWidth = this.currentPanelWidth();
			this.options.resizeHandle.setPointerCapture(event.pointerId);
			editor.classList.add('property-panel-resizing');
			event.preventDefault();
		});

		this.options.resizeHandle.addEventListener('pointermove', (event) => {
			if (activePointerId !== event.pointerId) {
				return;
			}

			this.applyWidth(startWidth + startX - event.clientX);
		});

		const finishResize = (event: PointerEvent): void => {
			if (activePointerId !== event.pointerId) {
				return;
			}

			activePointerId = undefined;
			editor?.classList.remove('property-panel-resizing');
			if (this.options.resizeHandle.hasPointerCapture(event.pointerId)) {
				this.options.resizeHandle.releasePointerCapture(event.pointerId);
			}
		};

		this.options.resizeHandle.addEventListener('pointerup', finishResize);
		this.options.resizeHandle.addEventListener('pointercancel', finishResize);
		this.options.resizeHandle.addEventListener('keydown', (event) => {
			if (this.collapsed || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) {
				return;
			}

			const step = event.shiftKey ? 80 : 24;
			this.applyWidth(this.currentPanelWidth() + (event.key === 'ArrowLeft' ? step : -step));
			event.preventDefault();
		});
	}

	private currentPanelWidth(): number {
		return this.panelWidth ?? this.options.panel.getBoundingClientRect().width;
	}

	private applyWidth(width: number, notify = true): void {
		const editor = this.editorElement();
		if (editor === undefined) {
			return;
		}

		const clampedWidth = this.clampWidth(width);
		this.panelWidth = clampedWidth;
		editor.style.setProperty('--property-panel-width', `${clampedWidth}px`);
		if (notify) {
			this.options.onWidthChange?.(clampedWidth);
		}
	}

	private clampWidth(width: number): number {
		const editorWidth = this.editorElement()?.getBoundingClientRect().width ?? 0;
		const minimumWidth = 280;
		const maximumWidth = editorWidth > 0
			? Math.max(minimumWidth, Math.min(640, editorWidth - 360))
			: 640;

		return Math.round(Math.min(Math.max(width, minimumWidth), maximumWidth));
	}

	private editorElement(): HTMLElement | undefined {
		const editor = this.options.panel.closest('.editor');

		return editor instanceof HTMLElement ? editor : undefined;
	}

	private renderSelection(): void {
		this.options.body.textContent = '';
		if (this.selectedElement === undefined) {
			this.options.title.textContent = 'Diagram Properties';
			this.renderDiagramContext();
			return;
		}

		this.options.title.textContent = `${capitalize(this.selectedElement.kind)} Properties`;
		this.renderElement(this.selectedElement);
	}

	private renderDiagramContext(): void {
		const file = this.options.payload.file;
		const diagram = this.options.payload.diagram;
		this.renderTabs('diagram', [
			{
				id: 'summary',
				label: 'Summary',
				sections: [
					sectionElement('Diagram', [
						readonlyField('File', file?.fsPath ?? ''),
						readonlyField('Title', diagram?.metadata?.title ?? ''),
						readonlyField('Theme', diagram?.metadata?.theme_file ?? ''),
						readonlyField('Ontologies', String(diagram?.ontologies?.length ?? 0)),
					]),
				],
			},
		]);
	}

	private renderElement(element: CanvasPropertyElement): void {
		const identitySection = sectionElement('Identity', [
			readonlyField('Type', capitalize(element.kind)),
			readonlyField('ID', element.value.id),
		]);

		if (element.kind === 'node') {
			this.renderTabs(element.value.id, this.nodeTabs(element.value, identitySection));
		} else if (element.kind === 'edge') {
			this.renderTabs(element.value.id, this.edgeTabs(element.value, identitySection));
		} else if (element.kind === 'note') {
			this.renderTabs(element.value.id, this.noteTabs(element.value, identitySection));
		} else if (element.kind === 'label') {
			this.renderTabs(element.value.id, this.labelTabs(element.value, identitySection));
		} else {
			this.renderTabs(element.value.id, this.imageTabs(element.value, identitySection));
		}
	}

	private nodeTabs(node: DiagramNode, identitySection: HTMLElement): readonly PropertyTab[] {
		const dataPropertyAttributes = availableNodeDataPropertyAttributes(node, this.options.payload);
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					identitySection,
					sectionElement('Ontology', [
						readonlyField('Ref', node.ontology_ref),
						readonlyField('Data Properties', String(dataPropertyAttributes.length)),
						checkboxField('Show Data Properties', node.show_data_properties === true, (value) => {
							if (value) {
								this.resizeNodeToFitDataProperties(node, dataPropertyAttributes);
							}
							this.propertyEdited('node', node.id, ['show_data_properties']);
							this.options.messageBus.publishCommand(new UpdateNodeDataPropertiesVisibilityCommand(node.id, value));
						}),
					]),
					sectionElement('Image', [
						imageField('Image', node.image ?? '', (value) => {
							const image = value.trim() === '' ? undefined : value;
							this.updateElementContent({ kind: 'nodeImage', id: node.id, image });
							this.propertyEdited('node', node.id, ['image']);
							this.options.messageBus.publishCommand(new UpdateNodeImageCommand(node.id, image));
						}, () => {
							this.options.messageBus.publishCommand(new PickNodeImageCommand(node.id));
						}),
					]),
				],
			},
			{
				id: 'geometry',
				label: 'Geometry',
				sections: [
					sectionElement('Geometry', this.geometryFields(node, (update) => {
						this.propertyEdited('node', node.id, ['x', 'y', 'width', 'height']);
						this.options.messageBus.publishCommand(new UpdateNodeBoundsCommand([update]));
					})),
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

	private edgeTabs(edge: DiagramEdge, identitySection: HTMLElement): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					identitySection,
					sectionElement('Ontology', [
						readonlyField('Ref', edge.ontology_ref),
						readonlyField('Label', edgeDisplayName(edge.ontology_ref)),
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
			{
				id: 'actions',
				label: 'Actions',
				sections: [
					sectionElement('Actions', [
						actionButton('Reset Label Position', 'secondary', () => {
							this.options.resetEdgeLabel(edge.id);
						}),
						actionButton('Delete Edge', 'danger', () => {
							this.options.messageBus.publishCommand(new DeleteEdgeCommand(edge.id));
						}),
					]),
				],
			},
		];
	}

	private noteTabs(note: DiagramNote, identitySection: HTMLElement): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					identitySection,
					sectionElement('Text', [
						textAreaField('Text', note.text, (value) => {
							this.updateElementContent({ kind: 'noteText', id: note.id, text: value });
							this.propertyEdited('note', note.id, ['text']);
							this.options.messageBus.publishCommand(new UpdateNoteTextCommand(note.id, value));
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
					})),
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

	private labelTabs(label: DiagramLabel, identitySection: HTMLElement): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					identitySection,
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
					})),
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

	private imageTabs(image: DiagramImage, identitySection: HTMLElement): readonly PropertyTab[] {
		return [
			{
				id: 'details',
				label: 'Details',
				sections: [
					identitySection,
					sectionElement('Image', [
						imageField('Source', image.source, (value) => {
							this.updateElementContent({ kind: 'imageSource', id: image.id, source: value });
							this.propertyEdited('image', image.id, ['source']);
							this.options.messageBus.publishCommand(new UpdateImageSourceCommand(image.id, value));
						}, () => {
							this.options.messageBus.publishCommand(new PickImageSourceCommand(image.id));
						}),
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
					})),
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
	): HTMLElement[] {
		let x = element.x;
		let y = element.y;
		let width = element.width;
		let height = element.height;
		const send = (): void => {
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

	private commonStyleSection(elementType: 'node' | 'note', id: string, style: DiagramElementStyle | undefined): HTMLElement {
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

	private resizeNodeToFitDataProperties(node: DiagramNode, attributes: readonly { readonly text: string }[]): void {
		const fontSize = node.style?.font?.size ?? this.options.getTheme().fontSize;
		const requiredWidth = requiredNodeWidthForDataProperties({
			title: ontologyDisplayName(node.ontology_ref),
			attributes,
			fontSize,
			fontFamily: node.style?.font?.family ?? this.options.getTheme().fontFamily,
			titleBold: node.style?.font?.bold,
			attributeItalic: node.style?.font?.italic,
			minimumWidth: node.width,
		});
		const requiredHeight = requiredNodeHeightForDataProperties({
			attributeCount: attributes.length,
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
