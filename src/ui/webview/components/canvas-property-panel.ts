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
import { CanvasPropertyTabBuilder } from './canvas-property-tab-builder';
import type { CanvasPropertyPanelOptions, PropertyTab } from './canvas-property-panel-types';
import { authorsText, blankToUndefined, buttonGroup, capitalize, parseAuthorsText, propertyElementTypeLabels, propertyElementTypeOrder } from './canvas-property-panel-support';

export class CanvasPropertyPanel {
	private selectedElement: CanvasPropertyElement | undefined;
	private selectedElementCount = 0;
	private selectedElementIdentifiers: readonly string[] = [];
	private readonly selectedTabByContext: Map<string, string>;
	private readonly tabBuilder: CanvasPropertyTabBuilder;

	public constructor(private readonly options: CanvasPropertyPanelOptions) {
		this.selectedTabByContext = options.selectedTabByContext ?? new Map<string, string>();
		this.tabBuilder = new CanvasPropertyTabBuilder(options);
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
				this.selectedElementIdentifiers = event.selectedElementIdentifiers;
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
		if (this.selectedElementCount > 1) {
			this.renderMultipleSelectionContext();
			return;
		}
		if (this.selectedElement === undefined) {
			this.renderDiagramContext();
			return;
		}

		this.renderElement(this.selectedElement);
	}

	private renderMultipleSelectionContext(): void {
		const elements = this.selectedElementIdentifiers
			.map((id) => this.options.registry.element(id))
			.filter((element): element is CanvasPropertyElement => element !== undefined);
		const groups = propertyElementTypeOrder.flatMap((kind) => {
			const identifiers = elements
				.filter((element) => element.kind === kind)
				.map((element) => element.value.id);
			return identifiers.length === 0 ? [] : [{ kind, identifiers }];
		});
		const nodes = elements
			.filter((element): element is Extract<CanvasPropertyElement, { readonly kind: 'node' }> => element.kind === 'node')
			.map((element) => element.value);
		if (nodes.length === this.selectedElementCount) {
			this.renderContextHeader('Nodes', `${nodes.length} selected`);
			this.renderTabs('multiple-nodes', [
				{
					id: 'display',
					label: 'Display',
					sections: this.tabBuilder.multipleNodeDisplaySections(nodes),
				},
				{
					id: 'style',
					label: 'Style',
					sections: this.tabBuilder.multipleNodeStyleSections(nodes),
				},
			]);
			return;
		}
		const edges = elements
			.filter((element): element is Extract<CanvasPropertyElement, { readonly kind: 'edge' }> => element.kind === 'edge')
			.map((element) => element.value);
		if (edges.length === this.selectedElementCount) {
			this.renderContextHeader('Edges', `${edges.length} selected`);
			this.renderTabs('multiple-edges', [{
				id: 'style',
				label: 'Style',
				sections: this.tabBuilder.multipleEdgeStyleSections(edges),
			}]);
			return;
		}

		this.renderContextHeader('Multiple selection', `${this.selectedElementCount} elements selected`);
		if (groups.length > 1) {
			this.options.body.appendChild(sectionElement('Limit Selection', [buttonGroup(groups.map((group) =>
				actionButton(`Select only ${propertyElementTypeLabels[group.kind]} (${group.identifiers.length})`, 'secondary', () => {
					this.options.selectElements(group.identifiers);
				}),
			))]));
			return;
		}

		const message = document.createElement('p');
		message.className = 'property-empty-message';
		message.textContent = 'Multi-element property editing is currently available for nodes and edges.';
		this.options.body.appendChild(message);
	}

	private renderDiagramContext(): void {
		const diagram = this.options.payload.diagram;
		const metadata = diagram?.metadata;
		this.renderContextHeader('Diagram');
		this.options.body.append(
			textField('Title', metadata?.title ?? '', (value) => {
				this.tabBuilder.updateDiagramMetadata({ title: value }, ['title']);
			}),
			textField('Authors', authorsText(metadata?.authors ?? []), (value) => {
				this.tabBuilder.updateDiagramMetadata({ authors: parseAuthorsText(value) }, ['authors']);
			}),
			textField('Version', metadata?.diagram_version ?? '', (value) => {
				this.tabBuilder.updateDiagramMetadata({ diagram_version: value }, ['diagram_version']);
			}),
			textField('Theme', metadata?.theme_file ?? '', (value) => {
				this.tabBuilder.updateDiagramMetadata({ theme_file: blankToUndefined(value) }, ['theme_file']);
			}),
			checkboxField('Show ontology labels', metadata?.show_ontology_information === true, (value) => {
				this.tabBuilder.updateDiagramMetadata({ show_ontology_information: value }, ['show_ontology_information']);
			}),
			readonlyField('Schema', metadata?.schema_version ?? ''),
			readonlyField('Ontologies', String(diagram?.ontologies?.length ?? 0)),
		);
	}

	private renderElement(element: CanvasPropertyElement): void {
		this.renderContextHeader(capitalize(element.kind), element.value.id);

		if (element.kind === 'node') {
			this.renderTabs(element.value.id, this.tabBuilder.nodeTabs(element.value));
		} else if (element.kind === 'edge') {
			this.renderTabs(element.value.id, this.tabBuilder.edgeTabs(element.value));
		} else if (element.kind === 'note') {
			this.renderTabs(element.value.id, this.tabBuilder.noteTabs(element.value));
		} else if (element.kind === 'label') {
			this.renderTabs(element.value.id, this.tabBuilder.labelTabs(element.value));
		} else if (element.kind === 'metadata') {
			this.renderTabs(element.value.id, this.tabBuilder.metadataTabs(element.value));
		} else if (element.kind === 'legend') {
			this.renderTabs(element.value.id, this.tabBuilder.legendTabs(element.value));
		} else {
			this.renderTabs(element.value.id, this.tabBuilder.imageTabs(element.value));
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

}
