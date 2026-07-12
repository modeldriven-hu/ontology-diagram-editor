import type { CanvasPoint } from '../../../shared/canvas-geometry';

const toolbarInset = 12;
const toolbarMargin = 8;

interface FixedToolbarControllerOptions {
	readonly toolbar: HTMLElement;
	readonly dragHandle: HTMLButtonElement;
	readonly container: HTMLElement;
	readonly initialOffset: CanvasPoint;
	readonly persistOffset: (offset: CanvasPoint) => void;
}

interface FixedToolbarDragState {
	readonly pointerId: number;
	readonly startClientX: number;
	readonly startClientY: number;
	readonly startOffset: CanvasPoint;
}

export interface FixedToolbarSize {
	readonly width: number;
	readonly height: number;
}

export class FixedToolbarController {
	private offset: CanvasPoint;
	private drag: FixedToolbarDragState | undefined;

	public constructor(private readonly options: FixedToolbarControllerOptions) {
		this.offset = options.initialOffset;
	}

	public register(): void {
		const { dragHandle, toolbar } = this.options;
		this.setOffset(this.offset, { persist: false });
		dragHandle.addEventListener('pointerdown', (event) => {
			if (event.button !== 0) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.drag = {
				pointerId: event.pointerId,
				startClientX: event.clientX,
				startClientY: event.clientY,
				startOffset: this.offset,
			};
			dragHandle.setPointerCapture(event.pointerId);
			toolbar.classList.add('dragging');
		});
		dragHandle.addEventListener('pointermove', (event) => {
			if (this.drag?.pointerId !== event.pointerId) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.setOffset({
				x: this.drag.startOffset.x + event.clientX - this.drag.startClientX,
				y: this.drag.startOffset.y + event.clientY - this.drag.startClientY,
			}, { persist: false });
		});
		dragHandle.addEventListener('pointerup', (event) => {
			this.completeDrag(event);
		});
		dragHandle.addEventListener('pointercancel', (event) => {
			this.completeDrag(event);
		});
		dragHandle.addEventListener('keydown', (event) => {
			if (event.key === 'Home') {
				event.preventDefault();
				event.stopPropagation();
				this.setOffset({ x: 0, y: 0 });
				return;
			}

			const delta = toolbarKeyboardDelta(event);
			if (delta === undefined) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			this.setOffset({
				x: this.offset.x + delta.x,
				y: this.offset.y + delta.y,
			});
		});
		window.addEventListener('resize', () => {
			this.setOffset(this.offset, { persist: false });
		});
	}

	public update(): void {
		this.setOffset(this.offset, { persist: false });
	}

	private completeDrag(event: PointerEvent): void {
		const { dragHandle, toolbar } = this.options;
		if (this.drag?.pointerId !== event.pointerId) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		this.drag = undefined;
		if (dragHandle.hasPointerCapture(event.pointerId)) {
			dragHandle.releasePointerCapture(event.pointerId);
		}
		toolbar.classList.remove('dragging');
		this.options.persistOffset(this.offset);
	}

	private setOffset(offset: CanvasPoint, options: { readonly persist?: boolean } = {}): void {
		this.offset = constrainFixedToolbarOffset(
			offset,
			this.toolbarSize(),
			{
				width: this.options.container.clientWidth,
				height: this.options.container.clientHeight,
			},
		);
		this.options.toolbar.style.left = `${toolbarInset + this.offset.x}px`;
		this.options.toolbar.style.top = `${toolbarInset + this.offset.y}px`;
		if (options.persist !== false) {
			this.options.persistOffset(this.offset);
		}
	}

	private toolbarSize(): FixedToolbarSize {
		const bounds = this.options.toolbar.getBoundingClientRect();
		return {
			width: bounds.width,
			height: bounds.height,
		};
	}
}

export function constrainFixedToolbarOffset(
	offset: CanvasPoint,
	toolbarSize: FixedToolbarSize,
	containerSize: FixedToolbarSize,
): CanvasPoint {
	const maximumX = Math.max(toolbarMargin, containerSize.width - toolbarSize.width - toolbarMargin);
	const maximumY = Math.max(toolbarMargin, containerSize.height - toolbarSize.height - toolbarMargin);

	return {
		x: clamp(toolbarInset + offset.x, toolbarMargin, maximumX) - toolbarInset,
		y: clamp(toolbarInset + offset.y, toolbarMargin, maximumY) - toolbarInset,
	};
}

function toolbarKeyboardDelta(event: KeyboardEvent): CanvasPoint | undefined {
	const distance = event.shiftKey ? 24 : 8;
	switch (event.key) {
		case 'ArrowLeft':
			return { x: -distance, y: 0 };
		case 'ArrowRight':
			return { x: distance, y: 0 };
		case 'ArrowUp':
			return { x: 0, y: -distance };
		case 'ArrowDown':
			return { x: 0, y: distance };
		default:
			return undefined;
	}
}

function clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}
