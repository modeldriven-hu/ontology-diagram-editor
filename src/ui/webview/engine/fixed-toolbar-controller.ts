import type { CanvasPoint } from '../../../shared/canvas-geometry';

const toolbarInset = 12;
const toolbarMargin = 8;
const dockSnapDistance = 32;

export type FixedToolbarDock = 'top' | 'bottom';

export interface FixedToolbarPosition {
	readonly offset: CanvasPoint;
	readonly dock?: FixedToolbarDock;
}

interface FixedToolbarControllerOptions {
	readonly toolbar: HTMLElement;
	readonly dragHandle: HTMLButtonElement;
	readonly pinButton: HTMLButtonElement;
	readonly container: HTMLElement;
	readonly initialPosition: FixedToolbarPosition;
	readonly persistPosition: (position: FixedToolbarPosition) => void;
}

interface FixedToolbarDragState {
	readonly pointerId: number;
	readonly startClientX: number;
	readonly startClientY: number;
	readonly startPosition: FixedToolbarPosition;
}

export interface FixedToolbarSize {
	readonly width: number;
	readonly height: number;
}

export class FixedToolbarController {
	private position: FixedToolbarPosition;
	private drag: FixedToolbarDragState | undefined;

	public constructor(private readonly options: FixedToolbarControllerOptions) {
		this.position = options.initialPosition;
	}

	public register(): void {
		const { dragHandle, toolbar } = this.options;
		this.setPosition(this.position, { persist: false });
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
				startPosition: this.positionForCurrentContainer(),
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
			this.setPosition({
				offset: {
					x: this.drag.startPosition.offset.x + event.clientX - this.drag.startClientX,
					y: this.drag.startPosition.offset.y + event.clientY - this.drag.startClientY,
				},
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
				this.setPosition({ offset: { x: 0, y: 0 }, dock: 'top' });
				return;
			}

			const delta = toolbarKeyboardDelta(event);
			if (delta === undefined) {
				return;
			}

			event.preventDefault();
			event.stopPropagation();
			const position = this.positionForCurrentContainer();
			this.setPosition({
				offset: {
					x: position.offset.x + delta.x,
					y: position.offset.y + delta.y,
				},
			});
		});
		this.options.pinButton.addEventListener('click', () => {
			this.toggleDock();
		});
		window.addEventListener('resize', () => {
			this.setPosition(this.position, { persist: false });
		});
	}

	public update(): void {
		this.setPosition(this.position, { persist: false });
	}

	private toggleDock(): void {
		const position = this.positionForCurrentContainer();
		if (position.dock !== undefined) {
			this.setPosition({ offset: position.offset });
			return;
		}

		this.setPosition(dockFixedToolbarPosition(position, this.toolbarSize(), this.containerSize()));
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
		this.setPosition(this.position, { persist: true, snap: true });
	}

	private setPosition(position: FixedToolbarPosition, options: { readonly persist?: boolean; readonly snap?: boolean } = {}): void {
		const toolbarSize = this.toolbarSize();
		const containerSize = this.containerSize();
		this.position = options.snap === true
			? snapFixedToolbarPosition(position, toolbarSize, containerSize)
			: constrainFixedToolbarPosition(position, toolbarSize, containerSize);
		this.options.toolbar.style.left = `${toolbarInset + this.position.offset.x}px`;
		this.options.toolbar.style.top = `${toolbarInset + this.position.offset.y}px`;
		this.options.toolbar.classList.toggle('docked-top', this.position.dock === 'top');
		this.options.toolbar.classList.toggle('docked-bottom', this.position.dock === 'bottom');
		this.updateCanvasDocking(toolbarSize);
		const dragLabel = this.position.dock === undefined ? 'Move toolbar' : 'Detach toolbar';
		this.options.dragHandle.title = dragLabel;
		this.options.dragHandle.setAttribute('aria-label', dragLabel);
		const pinned = this.position.dock !== undefined;
		this.options.pinButton.classList.toggle('is-pinned', pinned);
		this.options.pinButton.setAttribute('aria-pressed', String(pinned));
		const pinLabel = pinned ? 'Unpin toolbar' : 'Pin toolbar to top or bottom';
		this.options.pinButton.title = pinLabel;
		this.options.pinButton.setAttribute('aria-label', pinLabel);
		if (options.persist !== false) {
			this.options.persistPosition(this.position);
		}
	}

	private updateCanvasDocking(toolbarSize: FixedToolbarSize): void {
		const dockedTop = this.position.dock === 'top';
		const dockedBottom = this.position.dock === 'bottom';
		this.options.container.classList.toggle('toolbar-docked-top', dockedTop);
		this.options.container.classList.toggle('toolbar-docked-bottom', dockedBottom);
		const insets = dockedCanvasInsets(this.position, toolbarSize);
		this.options.container.style.setProperty('--canvas-toolbar-dock-size', `${insets.top + insets.bottom}px`);
	}

	private positionForCurrentContainer(): FixedToolbarPosition {
		return constrainFixedToolbarPosition(this.position, this.toolbarSize(), this.containerSize());
	}

	private containerSize(): FixedToolbarSize {
		return {
			width: this.options.container.clientWidth,
			height: this.options.container.clientHeight,
		};
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

export function constrainFixedToolbarPosition(
	position: FixedToolbarPosition,
	toolbarSize: FixedToolbarSize,
	containerSize: FixedToolbarSize,
): FixedToolbarPosition {
	const offset = constrainFixedToolbarOffset(position.offset, toolbarSize, containerSize);
	if (position.dock === undefined) {
		return { offset };
	}

	return {
		offset: {
			x: offset.x,
			y: dockedToolbarOffsetY(position.dock, toolbarSize, containerSize),
		},
		dock: position.dock,
	};
}

export function snapFixedToolbarPosition(
	position: FixedToolbarPosition,
	toolbarSize: FixedToolbarSize,
	containerSize: FixedToolbarSize,
): FixedToolbarPosition {
	const constrained: FixedToolbarPosition = {
		offset: constrainFixedToolbarOffset(position.offset, toolbarSize, containerSize),
	};
	const top = toolbarInset + constrained.offset.y;
	const bottom = top + toolbarSize.height;
	if (top <= toolbarMargin + dockSnapDistance) {
		return constrainFixedToolbarPosition({ ...constrained, dock: 'top' }, toolbarSize, containerSize);
	}
	if (bottom >= containerSize.height - toolbarMargin - dockSnapDistance) {
		return constrainFixedToolbarPosition({ ...constrained, dock: 'bottom' }, toolbarSize, containerSize);
	}

	return { offset: constrained.offset };
}

export function dockFixedToolbarPosition(
	position: FixedToolbarPosition,
	toolbarSize: FixedToolbarSize,
	containerSize: FixedToolbarSize,
): FixedToolbarPosition {
	const offset = constrainFixedToolbarOffset(position.offset, toolbarSize, containerSize);
	const topDistance = Math.abs((toolbarInset + offset.y) - toolbarMargin);
	const bottomDistance = Math.abs((toolbarInset + offset.y + toolbarSize.height) - (containerSize.height - toolbarMargin));
	return constrainFixedToolbarPosition({
		offset,
		dock: topDistance <= bottomDistance ? 'top' : 'bottom',
	}, toolbarSize, containerSize);
}

export function dockedCanvasInsets(position: FixedToolbarPosition, toolbarSize: FixedToolbarSize): { readonly top: number; readonly bottom: number } {
	const size = toolbarSize.height;
	return {
		top: position.dock === 'top' ? size : 0,
		bottom: position.dock === 'bottom' ? size : 0,
	};
}

function dockedToolbarOffsetY(dock: FixedToolbarDock, toolbarSize: FixedToolbarSize, containerSize: FixedToolbarSize): number {
	const top = dock === 'top'
		? toolbarMargin
		: containerSize.height - toolbarSize.height - toolbarMargin;
	return clamp(top, toolbarMargin, Math.max(toolbarMargin, containerSize.height - toolbarSize.height - toolbarMargin)) - toolbarInset;
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
