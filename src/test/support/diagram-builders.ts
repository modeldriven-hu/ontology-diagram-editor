import { Bounds, DiagramEdge, DiagramImage, DiagramLabel, DiagramMetadata, DiagramNode, DiagramNote, OntologyDiagramDocument, Point } from '../../documents/odiagram';
import type { DiagramExportSavePort } from '../../diagram-editor/use-cases';

export class RecordingDiagramExportSavePort implements DiagramExportSavePort {
	public readonly targetRequests: Parameters<DiagramExportSavePort['chooseTarget']>[0][] = [];
	public readonly writes: { readonly targetPath: string; readonly content: Uint8Array }[] = [];

	public constructor(private readonly targetPath: string | undefined) {}

	public chooseTarget(request: Parameters<DiagramExportSavePort['chooseTarget']>[0]): Promise<string | undefined> {
		this.targetRequests.push(request);
		return Promise.resolve(this.targetPath);
	}

	public writeFile(targetPath: string, content: Uint8Array): Promise<void> {
		this.writes.push({ targetPath, content });
		return Promise.resolve();
	}
}

export function emptyDiagram(): OntologyDiagramDocument {
	return diagramWithNodes([]);
}

export function containmentTestDiagram(): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Containment'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[
			new DiagramNode('node_parent', 'ex:Parent', new Bounds(40, 40, 120, 60)),
			new DiagramNode('node_childA', 'ex:ChildA', new Bounds(240, 40, 100, 50)),
			new DiagramNode('node_childB', 'ex:ChildB', new Bounds(360, 40, 100, 50)),
			new DiagramNode('node_otherParent', 'ex:OtherParent', new Bounds(500, 40, 120, 60)),
		],
		[
			new DiagramEdge('edge_childA', 'node_childA', 'node_parent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
			new DiagramEdge('edge_childB', 'node_childB', 'node_parent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
			new DiagramEdge('edge_otherParent', 'node_childA', 'node_otherParent', 'ex:partOf', new Point(0, 0), [new Point(0, 0), new Point(1, 1)]),
		],
	);
}

export function diagramWithNodes(nodes: readonly DiagramNode[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		nodes,
		[],
	);
}

export function diagramWithImages(images: readonly DiagramImage[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		[],
		images,
	);
}

export function diagramWithNotes(notes: readonly DiagramNote[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		notes,
	);
}

export function diagramWithLabels(labels: readonly DiagramLabel[]): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		DiagramMetadata.createEmpty('Example'),
		[],
		new Map([['ex', 'https://example.com/ontology#']]),
		[],
		[],
		[],
		[],
		labels,
	);
}

export function overlaps(left: Bounds, right: Bounds): boolean {
	return left.x < right.x + right.width
		&& left.x + left.width > right.x
		&& left.y < right.y + right.height
		&& left.y + left.height > right.y;
}

