import type { CanvasPoint } from '../../../shared/canvas-geometry';
import { CreateNodeCommand, type ModelTreeItemDropPayload } from '../../../shared/webview-commands';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import { edgeDisplayName } from './ontology-diagram-edges';
import type { DiagramNode, DiagramPayload } from '../ontology-diagram-types';

interface CanvasDropControllerOptions {
	readonly scrollElement: HTMLElement;
	readonly contentElement: HTMLElement;
	readonly payload: DiagramPayload;
	readonly modelTreeDragMimeType: string;
	readonly messageBus: CanvasMessageBus;
	readonly showStatus: (message: string) => void;
}

interface ResolvedEdgePreview {
	readonly edgeOntologyRef: string;
	readonly sourceOntologyRef: string;
	readonly targetOntologyRef: string;
	readonly edgeKind: 'association' | 'generalization';
}

interface BoundsPreview {
	readonly x: number;
	readonly y: number;
	readonly width: number;
	readonly height: number;
	readonly ontologyRef: string;
}

interface ValidEdgePreview {
	readonly valid: true;
	readonly edgeOntologyRef: string;
	readonly edgeKind: 'association' | 'generalization';
	readonly points: readonly CanvasPoint[];
	readonly label: CanvasPoint;
	readonly createdNodes: readonly BoundsPreview[];
}

interface InvalidEdgePreview {
	readonly valid: false;
	readonly position: CanvasPoint;
	readonly message: string;
}

type EdgePreview = ValidEdgePreview | InvalidEdgePreview;

const svgNamespace = 'http://www.w3.org/2000/svg';
const defaultNodeWidth = 180;
const defaultNodeHeight = 72;

export class CanvasDropController {
	private previewElement: SVGSVGElement | undefined;
	private lastPreviewMessage: string | undefined;

	public constructor(private readonly options: CanvasDropControllerOptions) {}

	public register(): void {
		this.options.scrollElement.addEventListener('dragover', (event) => {
			event.preventDefault();
			const dragPayload = this.readDragPayload(event.dataTransfer);
			const dropPosition = this.dropPosition(event);
			const preview = dragPayload === undefined ? undefined : edgePreview(this.options.payload, dragPayload, dropPosition);

			if (event.dataTransfer !== null) {
				event.dataTransfer.dropEffect = 'copy';
			}
			this.options.scrollElement.classList.add('drop-active');
			this.options.scrollElement.classList.toggle('drop-rejected', preview?.valid === false);
			if (preview === undefined) {
				this.clearPreview();
				return;
			}

			this.renderPreview(preview);
			if (!preview.valid && preview.message !== this.lastPreviewMessage) {
				this.lastPreviewMessage = preview.message;
				this.options.showStatus(preview.message);
			}
		});

		this.options.scrollElement.addEventListener('dragleave', (event) => {
			if (event.relatedTarget instanceof Node && this.options.scrollElement.contains(event.relatedTarget)) {
				return;
			}

			this.options.scrollElement.classList.remove('drop-active', 'drop-rejected');
			this.clearPreview();
		});

		this.options.scrollElement.addEventListener('drop', (event) => {
			event.preventDefault();
			this.options.scrollElement.classList.remove('drop-active', 'drop-rejected');
			this.clearPreview();

			const dragPayload = this.readDragPayload(event.dataTransfer);
			const preview = dragPayload === undefined ? undefined : edgePreview(this.options.payload, dragPayload, this.dropPosition(event));
			if (preview?.valid === false) {
				this.options.showStatus(preview.message);
				return;
			}

			this.options.messageBus.publishCommand(new CreateNodeCommand({
				payload: dragPayload,
				position: this.dropPosition(event),
			}));
		});
	}

	private renderPreview(preview: EdgePreview): void {
		const svg = this.previewSvg();
		svg.replaceChildren();
		svg.classList.toggle('invalid', !preview.valid);
		this.resizePreview(svg);

		if (!preview.valid) {
			svg.append(
				svgElement('circle', {
					cx: preview.position.x,
					cy: preview.position.y,
					r: 14,
					class: 'edge-drop-preview-invalid-marker',
				}),
				svgText(preview.position.x + 22, preview.position.y + 5, preview.message, 'edge-drop-preview-status'),
			);
			return;
		}

		const markerId = `edge-drop-preview-marker-${preview.edgeKind}`;
		svg.append(svgDefinitions(markerId, preview.edgeKind));
		svg.append(svgElement('polyline', {
			points: preview.points.map((point) => `${point.x},${point.y}`).join(' '),
			class: 'edge-drop-preview-route',
			'marker-end': `url(#${markerId})`,
		}));
		for (const node of preview.createdNodes) {
			svg.append(
				svgElement('rect', {
					x: node.x,
					y: node.y,
					width: node.width,
					height: node.height,
					rx: 8,
					ry: 8,
					class: 'edge-drop-preview-node',
				}),
				svgText(node.x + node.width / 2, node.y + node.height / 2 + 4, edgeDisplayName(node.ontologyRef), 'edge-drop-preview-node-label'),
			);
		}
		svg.append(svgText(
			preview.label.x,
			preview.label.y - 8,
			previewText(preview),
			'edge-drop-preview-label',
		));
	}

	private previewSvg(): SVGSVGElement {
		if (this.previewElement !== undefined) {
			return this.previewElement;
		}

		const svg = document.createElementNS(svgNamespace, 'svg');
		svg.classList.add('edge-drop-preview');
		this.options.contentElement.appendChild(svg);
		this.previewElement = svg;

		return svg;
	}

	private resizePreview(svg: SVGSVGElement): void {
		const width = Math.max(this.options.contentElement.scrollWidth, this.options.contentElement.clientWidth, 1800);
		const height = Math.max(this.options.contentElement.scrollHeight, this.options.contentElement.clientHeight, 1200);
		svg.setAttribute('width', String(width));
		svg.setAttribute('height', String(height));
		svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
	}

	private clearPreview(): void {
		this.previewElement?.remove();
		this.previewElement = undefined;
		this.lastPreviewMessage = undefined;
	}

	private dropPosition(event: DragEvent): CanvasPoint {
		const rect = this.options.contentElement.getBoundingClientRect();

		return {
			x: Math.max(0, event.clientX - rect.left),
			y: Math.max(0, event.clientY - rect.top),
		};
	}

	private readDragPayload(dataTransfer: DataTransfer | null): ModelTreeItemDropPayload | undefined {
		if (dataTransfer === null) {
			return undefined;
		}

		const raw = dataTransfer.getData(this.options.modelTreeDragMimeType)
			|| dataTransfer.getData('application/vnd.code.tree.ontology-diagram-editor.model-tree')
			|| dataTransfer.getData('text/plain');
		if (raw.length === 0) {
			return undefined;
		}

		try {
			return JSON.parse(raw) as ModelTreeItemDropPayload;
		} catch {
			return undefined;
		}
	}
}

function edgePreview(payload: DiagramPayload, dragPayload: ModelTreeItemDropPayload, position: CanvasPoint): EdgePreview | undefined {
	const resolved = resolvePreviewEndpoints(dragPayload);
	if (resolved === undefined) {
		return undefined;
	}
	if (resolved === 'ambiguous') {
		return {
			valid: false,
			position,
			message: 'Edge creation needs exactly one source and one target ontology item.',
		};
	}

	const nodes = payload.diagram?.nodes ?? [];
	const namespaces = payload.diagram?.namespaces ?? {};
	const sourceMatches = nodes.filter((node) => ontologyReferencesEqual(node.ontology_ref, resolved.sourceOntologyRef, namespaces));
	const targetMatches = nodes.filter((node) => ontologyReferencesEqual(node.ontology_ref, resolved.targetOntologyRef, namespaces));
	if (sourceMatches.length > 1 || targetMatches.length > 1) {
		return {
			valid: false,
			position,
			message: 'Edge endpoint ontology items must not appear more than once on the canvas.',
		};
	}

	const endpointPreview = previewEndpointBounds(nodes, resolved, sourceMatches[0], targetMatches[0], position);
	const points = endpointPreview.source === endpointPreview.target
		? selfLoopPoints(endpointPreview.source)
		: edgePoints(endpointPreview.source, endpointPreview.target);

	return {
		valid: true,
		edgeOntologyRef: resolved.edgeOntologyRef,
		edgeKind: resolved.edgeKind,
		points,
		label: points.length === 4 ? selfLoopLabel(points as readonly [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint]) : midpoint(points[0], points[1]),
		createdNodes: endpointPreview.created,
	};
}

function resolvePreviewEndpoints(payload: ModelTreeItemDropPayload): ResolvedEdgePreview | 'ambiguous' | undefined {
	const metadata = payload.ontologyItemMetadata;
	if (!isObject(metadata)) {
		return isConnectionCapableOntologyItem(payload.ontologyItemType) ? 'ambiguous' : undefined;
	}

	if (payload.ontologyItemType === 'objectProperty') {
		return resolvedPropertyPreview(
			payload.ontologyItemReference,
			singleString(metadata.domainReferences),
			singleString(metadata.rangeReferences),
			'association',
		);
	}

	if (payload.ontologyItemType === 'dataProperty') {
		return resolvedPropertyPreview(
			payload.ontologyItemReference,
			singleString(metadata.domainReferences),
			singleString(metadata.rangeReferences),
			'association',
		);
	}

	if (payload.ontologyItemType === 'subclassRelationship') {
		return resolvedPropertyPreview(
			'rdfs:subClassOf',
			stringValue(metadata.subclassReference),
			stringValue(metadata.superclassReference),
			'generalization',
		);
	}

	return undefined;
}

function resolvedPropertyPreview(
	edgeOntologyRef: string,
	sourceOntologyRef: string | 'ambiguous' | undefined,
	targetOntologyRef: string | 'ambiguous' | undefined,
	edgeKind: 'association' | 'generalization',
): ResolvedEdgePreview | 'ambiguous' {
	if (sourceOntologyRef === 'ambiguous' || targetOntologyRef === 'ambiguous' || sourceOntologyRef === undefined || targetOntologyRef === undefined) {
		return 'ambiguous';
	}

	return {
		edgeOntologyRef,
		sourceOntologyRef,
		targetOntologyRef,
		edgeKind,
	};
}

function previewEndpointBounds(
	existingNodes: readonly DiagramNode[],
	resolved: ResolvedEdgePreview,
	existingSource: DiagramNode | undefined,
	existingTarget: DiagramNode | undefined,
	position: CanvasPoint,
): { readonly source: BoundsPreview; readonly target: BoundsPreview; readonly created: readonly BoundsPreview[] } {
	const created: BoundsPreview[] = [];
	if (resolved.sourceOntologyRef === resolved.targetOntologyRef) {
		const node = existingSource === undefined
			? avoidOverlappingBounds(selfEndpointBounds(position, resolved.sourceOntologyRef), existingNodes, created)
			: nodeBounds(existingSource);
		if (existingSource === undefined) {
			created.push(node);
		}

		return { source: node, target: node, created };
	}

	const source = existingSource === undefined
		? avoidOverlappingBounds(sourceBounds(position, existingTarget, resolved.sourceOntologyRef), existingNodes, created)
		: nodeBounds(existingSource);
	if (existingSource === undefined) {
		created.push(source);
	}

	const target = existingTarget === undefined
		? avoidOverlappingBounds(targetBounds(source, resolved.targetOntologyRef), existingNodes, created)
		: nodeBounds(existingTarget);
	if (existingTarget === undefined) {
		created.push(target);
	}

	return { source, target, created };
}

function nodeBounds(node: DiagramNode): BoundsPreview {
	return {
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
		ontologyRef: node.ontology_ref,
	};
}

function selfEndpointBounds(position: CanvasPoint, ontologyRef: string): BoundsPreview {
	return {
		x: roundCoordinate(position.x - defaultNodeWidth / 2),
		y: roundCoordinate(position.y),
		width: defaultNodeWidth,
		height: defaultNodeHeight,
		ontologyRef,
	};
}

function sourceBounds(position: CanvasPoint, existingTarget: DiagramNode | undefined, ontologyRef: string): BoundsPreview {
	if (existingTarget !== undefined) {
		return {
			x: roundCoordinate(existingTarget.x - defaultNodeWidth - 160),
			y: roundCoordinate(existingTarget.y),
			width: defaultNodeWidth,
			height: defaultNodeHeight,
			ontologyRef,
		};
	}

	return {
		x: roundCoordinate(position.x - defaultNodeWidth - 80),
		y: roundCoordinate(position.y),
		width: defaultNodeWidth,
		height: defaultNodeHeight,
		ontologyRef,
	};
}

function targetBounds(source: BoundsPreview, ontologyRef: string): BoundsPreview {
	return {
		x: roundCoordinate(source.x + source.width + 160),
		y: roundCoordinate(source.y),
		width: defaultNodeWidth,
		height: defaultNodeHeight,
		ontologyRef,
	};
}

function avoidOverlappingBounds(
	bounds: BoundsPreview,
	existingNodes: readonly DiagramNode[],
	createdNodes: readonly BoundsPreview[],
): BoundsPreview {
	let candidate = bounds;
	while ([...existingNodes.map(nodeBounds), ...createdNodes].some((existing) => boundsOverlap(candidate, existing))) {
		candidate = {
			...candidate,
			y: candidate.y + defaultNodeHeight + 40,
		};
	}

	return candidate;
}

function boundsOverlap(left: BoundsPreview, right: BoundsPreview): boolean {
	return left.x < right.x + right.width
		&& left.x + left.width > right.x
		&& left.y < right.y + right.height
		&& left.y + left.height > right.y;
}

function edgePoints(sourceBounds: BoundsPreview, targetBounds: BoundsPreview): readonly [CanvasPoint, CanvasPoint] {
	const sourceCenter = center(sourceBounds);
	const targetCenter = center(targetBounds);

	return [
		boundaryPoint(sourceBounds, targetCenter),
		boundaryPoint(targetBounds, sourceCenter),
	];
}

function selfLoopPoints(bounds: BoundsPreview): readonly [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint] {
	const right = bounds.x + bounds.width;
	const bottom = bounds.y + bounds.height;
	const startY = bounds.y + bounds.height * 0.35;
	const loopX = right + Math.max(80, bounds.width * 0.45);
	const loopY = bottom + Math.max(56, bounds.height * 0.75);
	const endX = bounds.x + bounds.width * 0.65;

	return [
		{ x: roundCoordinate(right), y: roundCoordinate(startY) },
		{ x: roundCoordinate(loopX), y: roundCoordinate(startY) },
		{ x: roundCoordinate(loopX), y: roundCoordinate(loopY) },
		{ x: roundCoordinate(endX), y: roundCoordinate(bottom) },
	];
}

function selfLoopLabel(points: readonly [CanvasPoint, CanvasPoint, CanvasPoint, CanvasPoint]): CanvasPoint {
	return {
		x: roundCoordinate(points[1].x + 8),
		y: roundCoordinate(((points[1].y + points[2].y) / 2) - 12),
	};
}

function boundaryPoint(bounds: BoundsPreview, toward: CanvasPoint): CanvasPoint {
	const centerX = bounds.x + bounds.width / 2;
	const centerY = bounds.y + bounds.height / 2;
	const dx = toward.x - centerX;
	const dy = toward.y - centerY;
	if (dx === 0 && dy === 0) {
		return {
			x: roundCoordinate(bounds.x + bounds.width),
			y: roundCoordinate(centerY),
		};
	}

	const scale = Math.min(
		dx === 0 ? Number.POSITIVE_INFINITY : (bounds.width / 2) / Math.abs(dx),
		dy === 0 ? Number.POSITIVE_INFINITY : (bounds.height / 2) / Math.abs(dy),
	);

	return {
		x: roundCoordinate(centerX + dx * scale),
		y: roundCoordinate(centerY + dy * scale),
	};
}

function midpoint(source: CanvasPoint, target: CanvasPoint): CanvasPoint {
	return {
		x: roundCoordinate((source.x + target.x) / 2),
		y: roundCoordinate((source.y + target.y) / 2),
	};
}

function center(bounds: BoundsPreview): CanvasPoint {
	return {
		x: bounds.x + bounds.width / 2,
		y: bounds.y + bounds.height / 2,
	};
}

function previewText(preview: ValidEdgePreview): string {
	const createdCount = preview.createdNodes.length;
	const suffix = createdCount === 0
		? ''
		: createdCount === 1
			? ' - creates missing endpoint'
			: ' - creates missing endpoints';

	return `${edgeDisplayName(preview.edgeOntologyRef)}${suffix}`;
}

function svgDefinitions(markerId: string, edgeKind: 'association' | 'generalization'): SVGDefsElement {
	const defs = document.createElementNS(svgNamespace, 'defs');
	const marker = svgElement('marker', {
		id: markerId,
		viewBox: edgeKind === 'generalization' ? '0 0 12 10' : '0 0 10 10',
		refX: edgeKind === 'generalization' ? 11 : 9,
		refY: 5,
		markerWidth: edgeKind === 'generalization' ? 10 : 8,
		markerHeight: edgeKind === 'generalization' ? 10 : 8,
		orient: 'auto',
	});
	marker.append(svgElement('path', edgeKind === 'generalization'
		? { d: 'M 1 1 L 11 5 L 1 9 Z', class: 'edge-drop-preview-marker-triangle' }
		: { d: 'M 1 1 L 9 5 L 1 9', class: 'edge-drop-preview-marker-arrow' }));
	defs.append(marker);

	return defs;
}

function svgText(x: number, y: number, value: string, className: string): SVGTextElement {
	const text = svgElement('text', {
		x,
		y,
		class: className,
	});
	text.textContent = value;

	return text;
}

function svgElement<K extends keyof SVGElementTagNameMap>(
	name: K,
	attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const element = document.createElementNS(svgNamespace, name);
	for (const [attribute, value] of Object.entries(attributes)) {
		element.setAttribute(attribute, String(value));
	}

	return element;
}

function singleString(value: unknown): string | 'ambiguous' | undefined {
	if (!Array.isArray(value) || value.length !== 1) {
		return value === undefined ? undefined : 'ambiguous';
	}

	return typeof value[0] === 'string' && value[0].length > 0 ? value[0] : undefined;
}

function stringValue(value: unknown): string | undefined {
	return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null;
}

function isConnectionCapableOntologyItem(type: string): boolean {
	return type === 'objectProperty' || type === 'dataProperty' || type === 'subclassRelationship';
}

function roundCoordinate(value: number): number {
	return Math.max(0, Math.round(value));
}

function ontologyReferencesEqual(left: string, right: string, namespaces: Readonly<Record<string, string>>): boolean {
	if (left === right) {
		return true;
	}

	return expandedOntologyReference(left, namespaces) === expandedOntologyReference(right, namespaces);
}

function expandedOntologyReference(value: string, namespaces: Readonly<Record<string, string>>): string {
	if (value.includes('://')) {
		return value;
	}

	const separatorIndex = value.indexOf(':');
	if (separatorIndex <= 0) {
		return value;
	}

	const namespace = namespaces[value.slice(0, separatorIndex)];
	return namespace === undefined ? value : `${namespace}${value.slice(separatorIndex + 1)}`;
}
