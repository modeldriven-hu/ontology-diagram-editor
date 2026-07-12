import { Bounds, Point, type DiagramEdge, type OntologyDiagramDocument } from '../../documents/odiagram';
import { defaultElkLayeredLayerSpacing, defaultElkLayeredNodeSpacing, normalizeElkLayeredSpacing, type DiagramLayoutAlgorithmId, type ElkLayeredLayoutOptions } from '../../shared/diagram-layout';
import type { DiagramLayoutAlgorithm, DiagramLayoutEdgeRoute, DiagramLayoutResult } from './diagram-layout-algorithm';
import { roundLayoutCoordinate } from './layout-coordinate';

interface ElkPoint {
	readonly x: number;
	readonly y: number;
}

interface ElkLabel {
	readonly id: string;
	readonly text?: string;
	readonly x?: number;
	readonly y?: number;
	readonly width?: number;
	readonly height?: number;
}

interface ElkEdgeSection {
	readonly id: string;
	readonly startPoint: ElkPoint;
	readonly endPoint: ElkPoint;
	readonly bendPoints?: readonly ElkPoint[];
}

interface ElkExtendedEdge {
	readonly id: string;
	readonly sources: readonly string[];
	readonly targets: readonly string[];
	readonly labels?: readonly ElkLabel[];
	readonly sections?: readonly ElkEdgeSection[];
}

interface ElkNode {
	readonly id: string;
	readonly x?: number;
	readonly y?: number;
	readonly width?: number;
	readonly height?: number;
	readonly layoutOptions?: Readonly<Record<string, string>>;
	readonly children?: readonly ElkNode[];
	readonly edges?: readonly ElkExtendedEdge[];
}

interface ElkLayoutEngine {
	layout(graph: ElkNode): Promise<ElkNode>;
}

type ElkLayoutEngineConstructor = new () => ElkLayoutEngine;

// elkjs 0.11.1's declaration does not compile under TypeScript 6 strict mode.
// Keep the workaround local while retaining the package's runtime implementation.
const ElkConstructor = require('elkjs/lib/elk.bundled.js') as ElkLayoutEngineConstructor;

const edgeLabelHeight = 24;
const minimumEdgeLabelWidth = 80;

export class ElkLayeredLayoutAlgorithm implements DiagramLayoutAlgorithm {
	public readonly id: DiagramLayoutAlgorithmId = 'elk-layered';

	public constructor(protected readonly elk: ElkLayoutEngine = new ElkConstructor()) {}

	public async layout(diagram: OntologyDiagramDocument, elkLayeredOptions?: ElkLayeredLayoutOptions): Promise<DiagramLayoutResult> {
		const graph = await this.elk.layout(elkGraph(diagram, {
			...this.layoutOptions,
			...this.spacingOptions(elkLayeredOptions),
		}));
		return {
			nodeBoundsById: nodeBounds(graph, diagram),
			edgeRoutesById: edgeRoutes(graph, diagram),
		};
	}

	protected readonly layoutOptions: Readonly<Record<string, string>> = {
		'elk.algorithm': 'layered',
		'elk.direction': 'RIGHT',
		'elk.edgeRouting': 'ORTHOGONAL',
		'elk.padding': '[top=80,left=80,bottom=80,right=80]',
		'elk.spacing.nodeNode': String(defaultElkLayeredNodeSpacing),
		'elk.layered.spacing.nodeNodeBetweenLayers': String(defaultElkLayeredLayerSpacing),
		'elk.spacing.edgeNode': '24',
		'elk.spacing.edgeEdge': '16',
		'elk.separateConnectedComponents': 'true',
		'elk.randomSeed': '1',
	};

	protected spacingOptions(elkLayeredOptions: ElkLayeredLayoutOptions | undefined): Readonly<Record<string, string>> {
		return {
			'elk.spacing.nodeNode': String(normalizeElkLayeredSpacing(
				elkLayeredOptions?.nodeSpacing,
				defaultElkLayeredNodeSpacing,
			)),
			'elk.layered.spacing.nodeNodeBetweenLayers': String(normalizeElkLayeredSpacing(
				elkLayeredOptions?.layerSpacing,
				defaultElkLayeredLayerSpacing,
			)),
		};
	}
}

export class ElkForceLayoutAlgorithm extends ElkLayeredLayoutAlgorithm {
	public override readonly id: DiagramLayoutAlgorithmId = 'elk-force';

	protected override readonly layoutOptions: Readonly<Record<string, string>> = {
		'elk.algorithm': 'force',
		'elk.edgeRouting': 'POLYLINE',
		'elk.padding': '[top=80,left=80,bottom=80,right=80]',
		'elk.spacing.nodeNode': '96',
		'elk.spacing.edgeNode': '24',
		'elk.separateConnectedComponents': 'true',
		'elk.randomSeed': '1',
		'elk.force.iterations': '300',
	};

	protected override spacingOptions(): Readonly<Record<string, string>> {
		return {};
	}
}

export class ElkMrTreeLayoutAlgorithm extends ElkLayeredLayoutAlgorithm {
	public override readonly id: DiagramLayoutAlgorithmId = 'elk-mrtree';

	protected override readonly layoutOptions: Readonly<Record<string, string>> = {
		'elk.algorithm': 'mrtree',
		'elk.direction': 'RIGHT',
		'elk.edgeRouting': 'ORTHOGONAL',
		'elk.padding': '[top=80,left=80,bottom=80,right=80]',
		'elk.spacing.nodeNode': '72',
		'elk.spacing.edgeNode': '48',
		'elk.separateConnectedComponents': 'true',
	};

	protected override spacingOptions(): Readonly<Record<string, string>> {
		return {};
	}
}

function elkGraph(
	diagram: OntologyDiagramDocument,
	layoutOptions: Readonly<Record<string, string>>,
): ElkNode {
	const nodeIds = new Set(diagram.nodes.map((node) => node.id.value));
	return {
		id: 'root',
		layoutOptions,
		children: [...diagram.nodes]
			.sort((left, right) => left.id.value.localeCompare(right.id.value))
			.map((node) => ({
				id: node.id.value,
				width: node.bounds.width,
				height: node.bounds.height,
			})),
		edges: diagram.edges
			.filter((edge) => nodeIds.has(edge.source.value) && nodeIds.has(edge.target.value))
			.sort((left, right) => left.id.value.localeCompare(right.id.value))
			.map(elkEdge),
	};
}

function elkEdge(edge: DiagramEdge): ElkExtendedEdge {
	const label = edgeDisplayName(edge.ontologyRef.value);
	return {
		id: edge.id.value,
		sources: [edge.source.value],
		targets: [edge.target.value],
		labels: [{
			id: `${edge.id.value}_label`,
			text: label,
			width: Math.max(minimumEdgeLabelWidth, label.length * 7),
			height: edgeLabelHeight,
		}],
	};
}

function nodeBounds(graph: ElkNode, diagram: OntologyDiagramDocument): ReadonlyMap<string, Bounds> {
	const originalById = new Map(diagram.nodes.map((node) => [node.id.value, node] as const));
	const result = new Map<string, Bounds>();
	for (const child of graph.children ?? []) {
		const original = originalById.get(child.id);
		if (original === undefined || child.x === undefined || child.y === undefined) {
			continue;
		}

		result.set(child.id, new Bounds(
			roundLayoutCoordinate(child.x),
			roundLayoutCoordinate(child.y),
			original.bounds.width,
			original.bounds.height,
		));
	}

	return result;
}

function edgeRoutes(graph: ElkNode, diagram: OntologyDiagramDocument): ReadonlyMap<string, DiagramLayoutEdgeRoute> {
	const originalById = new Map(diagram.edges.map((edge) => [edge.id.value, edge] as const));
	const result = new Map<string, DiagramLayoutEdgeRoute>();
	for (const edge of graph.edges ?? []) {
		const original = originalById.get(edge.id);
		const points = sectionPoints(edge.sections);
		if (original === undefined || points.length < 2) {
			continue;
		}

		const routePoints = original.routeLayout === 'direct'
			? [points[0], points[points.length - 1]]
			: points;
		result.set(edge.id, {
			points: routePoints,
			label: original.routeLayout === 'direct'
				? routeMidpoint(routePoints)
				: elkLabelPoint(edge) ?? routeMidpoint(routePoints),
		});
	}

	return result;
}

function sectionPoints(sections: readonly ElkEdgeSection[] | undefined): readonly Point[] {
	if (sections === undefined || sections.length === 0) {
		return [];
	}

	const section = sections[0];
	return withoutConsecutiveDuplicates([
		point(section.startPoint),
		...(section.bendPoints ?? []).map(point),
		point(section.endPoint),
	]);
}

function point(value: ElkPoint): Point {
	return new Point(roundLayoutCoordinate(value.x), roundLayoutCoordinate(value.y));
}

function withoutConsecutiveDuplicates(points: readonly Point[]): readonly Point[] {
	return points.filter((current, index) => index === 0
		|| current.x !== points[index - 1].x
		|| current.y !== points[index - 1].y);
}

function elkLabelPoint(edge: ElkExtendedEdge): Point | undefined {
	const label = edge.labels?.[0];
	if (label?.x === undefined || label.y === undefined) {
		return undefined;
	}

	return new Point(
		roundLayoutCoordinate(label.x + ((label.width ?? 0) / 2)),
		roundLayoutCoordinate(label.y + ((label.height ?? 0) / 2)),
	);
}

function routeMidpoint(points: readonly Point[]): Point {
	return new Point(
		roundLayoutCoordinate((points[0].x + points[points.length - 1].x) / 2),
		roundLayoutCoordinate((points[0].y + points[points.length - 1].y) / 2),
	);
}

function edgeDisplayName(ontologyRef: string): string {
	const hashIndex = ontologyRef.lastIndexOf('#');
	const slashIndex = ontologyRef.lastIndexOf('/');
	const compactIriIndex = ontologyRef.includes('://') ? -1 : ontologyRef.lastIndexOf(':');
	const separatorIndex = Math.max(hashIndex, slashIndex, compactIriIndex);
	const displayName = separatorIndex >= 0 ? ontologyRef.slice(separatorIndex + 1) : ontologyRef;

	return displayName.length > 0 ? displayName : ontologyRef;
}
