import type { DiagramEdge, DiagramImage, DiagramLabel, DiagramLegendElement, DiagramLink, DiagramMetadataElement, DiagramNode, DiagramNote } from '../ontology-diagram-types';
import type { CanvasPropertyPanelOptions, PropertyTab } from './canvas-property-panel-types';
import { AuxiliaryPropertyTabs } from './auxiliary-property-tabs';
import { CanvasPropertyEditor } from './canvas-property-editor';
import { EdgePropertyTabs } from './edge-property-tabs';
import { NodePropertyTabs } from './node-property-tabs';

export class CanvasPropertyTabBuilder {
	private readonly editor: CanvasPropertyEditor;
	private readonly nodes: NodePropertyTabs;
	private readonly edges: EdgePropertyTabs;
	private readonly auxiliary: AuxiliaryPropertyTabs;

	public constructor(options: CanvasPropertyPanelOptions) {
		this.editor = new CanvasPropertyEditor(options);
		this.nodes = new NodePropertyTabs(options, this.editor);
		this.edges = new EdgePropertyTabs(options, this.editor);
		this.auxiliary = new AuxiliaryPropertyTabs(options, this.editor);
	}

	public legendTabs(element: DiagramLegendElement): readonly PropertyTab[] {
		return this.auxiliary.legendTabs(element);
	}

	public metadataTabs(element: DiagramMetadataElement): readonly PropertyTab[] {
		return this.auxiliary.metadataTabs(element);
	}

	public multipleNodeStyleSections(nodes: readonly DiagramNode[]): readonly HTMLElement[] {
		return this.nodes.multipleNodeStyleSections(nodes);
	}

	public multipleNodeDisplaySections(nodes: readonly DiagramNode[]): readonly HTMLElement[] {
		return this.nodes.multipleNodeDisplaySections(nodes);
	}

	public multipleEdgeStyleSections(edges: readonly DiagramEdge[]): readonly HTMLElement[] {
		return this.edges.multipleEdgeStyleSections(edges);
	}

	public nodeTabs(node: DiagramNode): readonly PropertyTab[] {
		return this.nodes.nodeTabs(node);
	}

	public edgeTabs(edge: DiagramEdge): readonly PropertyTab[] {
		return this.edges.edgeTabs(edge);
	}

	public noteTabs(note: DiagramNote): readonly PropertyTab[] {
		return this.auxiliary.noteTabs(note);
	}

	public labelTabs(label: DiagramLabel): readonly PropertyTab[] {
		return this.auxiliary.labelTabs(label);
	}

	public imageTabs(image: DiagramImage): readonly PropertyTab[] {
		return this.auxiliary.imageTabs(image);
	}

	public diagramLinkTabs(link: DiagramLink): readonly PropertyTab[] {
		return this.auxiliary.diagramLinkTabs(link);
	}

	public updateDiagramMetadata(...args: Parameters<CanvasPropertyEditor['updateDiagramMetadata']>): void {
		this.editor.updateDiagramMetadata(...args);
	}
}
