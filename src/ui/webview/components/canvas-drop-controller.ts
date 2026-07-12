import { minimumNodeHeight, minimumNodeWidth, type CanvasPoint } from '../../../shared/canvas-geometry';
import { CreateNodeCommand, type ModelTreeItemDropPayload } from '../../../shared/webview-commands';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import { nodeCompartmentAttributes, nodeTitleText, requiredNodeHeightForDataProperties, requiredNodeWidthForDataProperties } from './node-data-properties';
import { edgeDisplayName } from './ontology-diagram-edges';
import type { DiagramNode, DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';

interface CanvasDropControllerOptions {
	readonly scrollElement: HTMLElement;
	readonly contentElement: HTMLElement;
	readonly payload: DiagramPayload;
	readonly modelTreeDragMimeType: string;
	readonly messageBus: CanvasMessageBus;
	readonly getTheme: () => WebviewTheme;
	readonly getZoom: () => number;
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
	readonly requiresEndpointSelection?: boolean;
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
			this.options.scrollElement.classList.toggle('drop-rejected', preview?.valid === false && !preview.requiresEndpointSelection);
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
			if (preview?.valid === false && !preview.requiresEndpointSelection) {
				this.options.showStatus(preview.message);
				return;
			}

			this.options.messageBus.publishCommand(new CreateNodeCommand({
				payload: dragPayload,
				position: this.dropPosition(event),
				size: dragPayload === undefined ? undefined : nodeSizeForDragPayload(this.options.payload, dragPayload, this.options.getTheme()),
			}));
		});
	}

	private renderPreview(preview: EdgePreview): void {
		const svg = this.previewSvg();
		const zoom = normalizedZoom(this.options.getZoom());
		svg.replaceChildren();
		svg.classList.toggle('invalid', !preview.valid);
		this.resizePreview(svg);

		if (!preview.valid) {
			const position = scaledPoint(preview.position, zoom);
			svg.append(
				svgElement('circle', {
					cx: position.x,
					cy: position.y,
					r: 14,
					class: 'edge-drop-preview-invalid-marker',
				}),
				svgText(position.x + 22, position.y + 5, preview.message, 'edge-drop-preview-status'),
			);
			return;
		}

		const markerId = `edge-drop-preview-marker-${preview.edgeKind}`;
		const points = preview.points.map((point) => scaledPoint(point, zoom));
		svg.append(svgDefinitions(markerId, preview.edgeKind));
		svg.append(svgElement('polyline', {
			points: points.map((point) => `${point.x},${point.y}`).join(' '),
			class: 'edge-drop-preview-route',
			'marker-end': `url(#${markerId})`,
		}));
		for (const node of preview.createdNodes) {
			const bounds = scaledBounds(node, zoom);
			svg.append(
				svgElement('rect', {
					x: bounds.x,
					y: bounds.y,
					width: bounds.width,
					height: bounds.height,
					rx: 8,
					ry: 8,
					class: 'edge-drop-preview-node',
				}),
				svgText(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2 + 4, edgeDisplayName(node.ontologyRef), 'edge-drop-preview-node-label'),
			);
		}
		const label = scaledPoint(preview.label, zoom);
		svg.append(svgText(
			label.x,
			label.y - 8,
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
		const zoom = normalizedZoom(this.options.getZoom());

		return {
			x: Math.max(0, (event.clientX - rect.left) / zoom),
			y: Math.max(0, (event.clientY - rect.top) / zoom),
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
		const requiresEndpointSelection = hasSelectableEndpointChoices(dragPayload);
		return {
			valid: false,
			position,
			message: requiresEndpointSelection
				? 'Drop to select the relationship source and target.'
				: 'Edge creation needs at least one source and one target ontology item.',
			requiresEndpointSelection,
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

function nodeSizeForDragPayload(payload: DiagramPayload, dragPayload: ModelTreeItemDropPayload, theme: WebviewTheme): { readonly width: number; readonly height: number } | undefined {
	if (isConnectionCapableOntologyItem(dragPayload.ontologyItemType)) {
		return undefined;
	}

	const previewNode: DiagramNode = {
		id: 'preview_node',
		ontology_ref: dragPayload.ontologyItemReference,
		x: 0,
		y: 0,
		width: minimumNodeWidth,
		height: minimumNodeHeight,
		ontology_item_type: dragPayload.ontologyItemType,
		show_type: dragPayload.ontologyItemType === 'individual' ? true : undefined,
		show_property_values: dragPayload.ontologyItemType === 'individual' ? true : undefined,
	};
	const attributes = nodeCompartmentAttributes(previewNode, payload);
	const fontSize = theme.nodeFontSize;

	return {
		width: requiredNodeWidthForDataProperties({
			title: nodeTitleText(previewNode, payload),
			attributes,
			fontSize,
			fontFamily: theme.nodeFontFamily,
			titleBold: theme.nodeFontBold,
			attributeItalic: theme.nodeFontItalic,
			minimumWidth: minimumNodeWidth,
		}),
		height: requiredNodeHeightForDataProperties({
			attributeCount: attributes.length,
			fontSize,
			minimumHeight: minimumNodeHeight,
		}),
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

	if (payload.ontologyItemType === 'objectPropertyAssertion') {
		return resolvedPropertyPreview(
			stringValue(metadata.edgeOntologyRef) ?? payload.ontologyItemReference,
			stringValue(metadata.sourceOntologyRef),
			stringValue(metadata.targetOntologyRef),
			'association',
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

function hasSelectableEndpointChoices(payload: ModelTreeItemDropPayload): boolean {
	if (payload.ontologyItemType !== 'objectProperty' && payload.ontologyItemType !== 'dataProperty') {
		return false;
	}

	if (!isObject(payload.ontologyItemMetadata)) {
		return false;
	}

	const source = referenceValues(payload.ontologyItemMetadata.domainReferences);
	const target = referenceValues(payload.ontologyItemMetadata.rangeReferences);
	return source.length > 0 && target.length > 0 && (source.length > 1 || target.length > 1);
}

function referenceValues(value: unknown): readonly string[] {
	return Array.isArray(value)
		? [...new Set(value.filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0))]
		: [];
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
	return type === 'objectProperty'
		|| type === 'dataProperty'
		|| type === 'subclassRelationship'
		|| type === 'objectPropertyAssertion';
}

function roundCoordinate(value: number): number {
	return Math.max(0, Math.round(value));
}

function normalizedZoom(value: number): number {
	return Number.isFinite(value) && value > 0 ? value : 1;
}

function scaledPoint(point: CanvasPoint, zoom: number): CanvasPoint {
	return {
		x: point.x * zoom,
		y: point.y * zoom,
	};
}

function scaledBounds(bounds: BoundsPreview, zoom: number): BoundsPreview {
	return {
		...bounds,
		x: bounds.x * zoom,
		y: bounds.y * zoom,
		width: bounds.width * zoom,
		height: bounds.height * zoom,
	};
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
