import type { DiagramNode, DiagramPayload } from '../ontology-diagram-types';
import { ontologyCommentsForReference } from './ontology-comments';

export interface NodeCommentTooltipPoint {
	readonly clientX: number;
	readonly clientY: number;
}

interface NodeCommentTooltipOptions {
	readonly tooltip: HTMLElement;
	readonly container: HTMLElement;
	readonly hoverSurface: HTMLElement;
	readonly commentTextForNodeId: (nodeId: string) => string;
}

interface TooltipBounds {
	readonly left: number;
	readonly top: number;
	readonly width: number;
	readonly height: number;
}

export class NodeCommentTooltipController {
	public constructor(private readonly options: NodeCommentTooltipOptions) {}

	public register(): void {
		this.options.hoverSurface.addEventListener('pointerover', this.handlePointerEvent, { capture: true });
		this.options.hoverSurface.addEventListener('pointermove', this.handlePointerEvent, { capture: true });
		this.options.hoverSurface.addEventListener('pointerdown', this.hideTooltip, { capture: true });
		this.options.hoverSurface.addEventListener('pointerleave', this.hideTooltip);
	}

	public show(text: string, point: NodeCommentTooltipPoint): void {
		if (text.trim().length === 0) {
			this.hide();
			return;
		}

		this.options.tooltip.textContent = text;
		this.options.tooltip.hidden = false;
		const position = nodeCommentTooltipPosition(
			point,
			this.options.container.getBoundingClientRect(),
			this.options.tooltip.getBoundingClientRect(),
		);
		this.options.tooltip.style.left = `${position.x}px`;
		this.options.tooltip.style.top = `${position.y}px`;
	}

	public hide(): void {
		this.options.tooltip.hidden = true;
	}

	private readonly handlePointerEvent = (event: PointerEvent): void => {
		if (event.buttons !== 0) {
			this.hide();
			return;
		}

		const nodeId = nodeIdForPointerTarget(event.target);
		if (nodeId === undefined) {
			this.hide();
			return;
		}

		this.show(this.options.commentTextForNodeId(nodeId), event);
	};

	private readonly hideTooltip = (): void => {
		this.hide();
	};
}

export function nodeCommentTooltipText(node: DiagramNode, payload: DiagramPayload): string {
	return ontologyCommentsForReference(node.ontology_ref, payload).join('\n\n');
}

export function nodeCommentTooltipPosition(
	point: NodeCommentTooltipPoint,
	container: TooltipBounds,
	tooltip: Pick<TooltipBounds, 'width' | 'height'>,
): { readonly x: number; readonly y: number } {
	const gap = 12;
	const margin = 8;
	const localX = point.clientX - container.left;
	const localY = point.clientY - container.top;
	const preferredX = localX + gap + tooltip.width <= container.width - margin
		? localX + gap
		: localX - gap - tooltip.width;
	const preferredY = localY + gap + tooltip.height <= container.height - margin
		? localY + gap
		: localY - gap - tooltip.height;

	return {
		x: clampedTooltipCoordinate(preferredX, tooltip.width, container.width, margin),
		y: clampedTooltipCoordinate(preferredY, tooltip.height, container.height, margin),
	};
}

export function nodeIdForPointerTarget(target: unknown): string | undefined {
	if (typeof target !== 'object'
		|| target === null
		|| !('closest' in target)
		|| typeof target.closest !== 'function') {
		return undefined;
	}

	const node = target.closest('.x6-node[data-cell-id]') as unknown;
	if (typeof node !== 'object'
		|| node === null
		|| !('getAttribute' in node)
		|| typeof node.getAttribute !== 'function') {
		return undefined;
	}

	const id = node.getAttribute('data-cell-id') as unknown;
	return typeof id === 'string' && id.length > 0 ? id : undefined;
}

function clampedTooltipCoordinate(value: number, tooltipSize: number, containerSize: number, margin: number): number {
	return Math.min(
		Math.max(margin, value),
		Math.max(margin, containerSize - tooltipSize - margin),
	);
}
