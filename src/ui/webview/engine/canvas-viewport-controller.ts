import { CanvasViewportChangedEvent } from '../../../shared/canvas-editor-events';
import type { CanvasPoint } from '../../../shared/canvas-geometry';
import type { CanvasViewport } from '../../../shared/canvas-viewport';
import type { DiagramPayload } from '../ontology-diagram-types';
import { diagramContentBounds, rectCenter } from './canvas-content-bounds';
import { isKeyboardInputTarget } from './canvas-dom';
import type { CanvasMessageBus } from './canvas-message-bus';
import type { DiagramCanvasEngine } from './diagram-canvas-engine';

export interface CanvasViewportState {
	readonly viewportPanX?: number;
	readonly viewportPanY?: number;
	readonly viewportZoom?: number;
	readonly canvasPanMode?: boolean;
}

interface CanvasPanDrag {
	readonly pointerId: number;
	readonly clientX: number;
	readonly clientY: number;
	readonly scrollLeft: number;
	readonly scrollTop: number;
}

interface CanvasViewportControllerOptions {
	readonly canvas: DiagramCanvasEngine;
	readonly scrollElement: HTMLElement;
	readonly panButton: HTMLButtonElement;
	readonly payload: DiagramPayload;
	readonly initialViewport?: CanvasViewport;
	readonly diagramFilePath?: string;
	readonly messageBus: CanvasMessageBus;
	readonly initialPanMode: boolean;
	readonly getState: () => CanvasViewportState | undefined;
	readonly updateState: (update: Partial<CanvasViewportState>) => void;
	readonly updateLocalToolbar: () => void;
	readonly showStatus: (message: string) => void;
}

const minimumZoom = 0.25;
const maximumZoom = 3;
const defaultCanvasWidth = 1800;
const defaultCanvasHeight = 1200;
const viewportPadding = 80;

export class CanvasViewportController {
	private panMode: boolean;
	private panDrag: CanvasPanDrag | undefined;

	public constructor(private readonly options: CanvasViewportControllerOptions) {
		this.panMode = options.initialPanMode;
	}

	public register(): void {
		this.registerViewportEventPublishing();
		this.registerCanvasPanHandlers();
	}

	public setPanMode(enabled: boolean, persist = true): void {
		this.applyPanMode(enabled, persist);
	}

	public zoomBy(factor: number): void {
		this.applyZoomBy(factor, 'zoom');
	}

	public fitDiagramToView(): void {
		this.fitToView();
	}

	public resetViewport(): void {
		this.reset();
	}

	public resizeCanvasForZoom(): void {
		this.resizeForZoom();
	}

	public restoreViewport(): void {
		this.restore();
	}

	public insertionPosition(): CanvasPoint {
		return this.topLeftInsertionPosition();
	}

	public viewportCenterInsertionPosition(): CanvasPoint {
		return this.centerInsertionPosition();
	}

private registerViewportEventPublishing(): void {
	this.options.scrollElement.addEventListener('scroll', () => {
		this.options.updateLocalToolbar();
		this.publishViewportChanged('scroll');
	});
	this.options.scrollElement.addEventListener('wheel', (event) => {
		if (!event.ctrlKey && !event.metaKey || isKeyboardInputTarget(event.target)) {
			return;
		}

		event.preventDefault();
		this.applyZoomBy(Math.exp(-event.deltaY * 0.002), 'zoom', {
			x: event.clientX,
			y: event.clientY,
		});
	}, { passive: false });
}

private registerCanvasPanHandlers(): void {
	this.options.scrollElement.addEventListener('pointerdown', (event) => {
		if (!this.panMode || !event.isPrimary || event.button !== 0 || isKeyboardInputTarget(event.target)) {
			return;
		}

		this.panDrag = {
			pointerId: event.pointerId,
			clientX: event.clientX,
			clientY: event.clientY,
			scrollLeft: this.options.scrollElement.scrollLeft,
			scrollTop: this.options.scrollElement.scrollTop,
		};
		this.options.scrollElement.setPointerCapture(event.pointerId);
		this.options.scrollElement.classList.add('panning');
		event.preventDefault();
		event.stopPropagation();
	}, true);
	this.options.scrollElement.addEventListener('pointermove', (event) => {
		const drag = this.panDrag;
		if (drag === undefined || drag.pointerId !== event.pointerId) {
			return;
		}

		this.options.scrollElement.scrollTo({
			left: drag.scrollLeft - (event.clientX - drag.clientX),
			top: drag.scrollTop - (event.clientY - drag.clientY),
		});
		event.preventDefault();
		event.stopPropagation();
	}, true);
	this.options.scrollElement.addEventListener('pointerup', (event) => this.completeCanvasPan(event), true);
	this.options.scrollElement.addEventListener('pointercancel', (event) => this.completeCanvasPan(event), true);
}

private completeCanvasPan(event: PointerEvent): void {
	if (this.panDrag?.pointerId !== event.pointerId) {
		return;
	}

	this.cancelCanvasPan();
	event.preventDefault();
	event.stopPropagation();
}

private cancelCanvasPan(): void {
	const drag = this.panDrag;
	if (drag !== undefined && this.options.scrollElement.hasPointerCapture(drag.pointerId)) {
		this.options.scrollElement.releasePointerCapture(drag.pointerId);
	}
	this.panDrag = undefined;
	this.options.scrollElement.classList.remove('panning');
}

private applyPanMode(enabled: boolean, persist = true): void {
	this.panMode = enabled;
	this.options.panButton.classList.toggle('is-active', enabled);
	this.options.panButton.setAttribute('aria-pressed', String(enabled));
	const label = enabled ? 'Disable pan canvas' : 'Pan canvas';
	this.options.panButton.title = label;
	this.options.panButton.setAttribute('aria-label', label);
	this.options.panButton.dataset.tooltip = label;
	this.options.scrollElement.classList.toggle('pan-mode', enabled);
	if (!enabled && this.panDrag !== undefined) {
		this.cancelCanvasPan();
	}
	if (persist) {
		this.options.updateState({ canvasPanMode: enabled });
	}
}

private applyZoomBy(factor: number, source: 'zoom', clientPoint?: CanvasPoint): void {
	const oldZoom = this.options.canvas.zoom();
	const newZoom = this.clampZoom(oldZoom * factor);
	if (Math.abs(newZoom - oldZoom) < 0.001) {
		return;
	}

	const focus = clientPoint ?? this.viewportCenterClientPoint();
	const focusCanvasPoint = this.viewportClientPointToCanvasPoint(focus, oldZoom);
	this.setZoom(newZoom);
	this.scrollToCanvasPoint(focusCanvasPoint, focus);
	this.publishViewportChanged(source);
}

private setZoom(zoom: number): void {
	this.options.canvas.setZoom(this.clampZoom(zoom));
	this.resizeForZoom();
	this.options.updateLocalToolbar();
}

private fitToView(): void {
	const bounds = diagramContentBounds(this.options.payload.diagram);
	if (bounds === undefined) {
		this.options.showStatus('There is no diagram content to fit.');
		return;
	}

	const viewportWidth = Math.max(1, this.options.scrollElement.clientWidth - viewportPadding);
	const viewportHeight = Math.max(1, this.options.scrollElement.clientHeight - viewportPadding);
	const zoom = this.clampZoom(Math.min(viewportWidth / bounds.width, viewportHeight / bounds.height));
	this.setZoom(zoom);
	this.scrollToCanvasPoint(rectCenter(bounds), this.viewportCenterClientPoint());
	this.publishViewportChanged('fit');
}

private reset(): void {
	this.setZoom(1);
	this.options.scrollElement.scrollTo({ left: 0, top: 0 });
	this.publishViewportChanged('reset');
}

private resizeForZoom(): void {
	const bounds = diagramContentBounds(this.options.payload.diagram);
	const zoom = this.options.canvas.zoom();
	const width = Math.max(defaultCanvasWidth, Math.ceil(((bounds?.x ?? 0) + (bounds?.width ?? defaultCanvasWidth)) * zoom + viewportPadding));
	const height = Math.max(defaultCanvasHeight, Math.ceil(((bounds?.y ?? 0) + (bounds?.height ?? defaultCanvasHeight)) * zoom + viewportPadding));
	this.options.canvas.resize(width, height);
}

private viewportCenterClientPoint(): CanvasPoint {
	const rect = this.options.scrollElement.getBoundingClientRect();

	return {
		x: rect.left + rect.width / 2,
		y: rect.top + rect.height / 2,
	};
}

private viewportClientPointToCanvasPoint(clientPoint: CanvasPoint, zoom: number): CanvasPoint {
	const rect = this.options.scrollElement.getBoundingClientRect();

	return {
		x: (this.options.scrollElement.scrollLeft + clientPoint.x - rect.left) / zoom,
		y: (this.options.scrollElement.scrollTop + clientPoint.y - rect.top) / zoom,
	};
}

private scrollToCanvasPoint(canvasPoint: CanvasPoint, clientPoint: CanvasPoint): void {
	const rect = this.options.scrollElement.getBoundingClientRect();

	this.options.scrollElement.scrollTo({
		left: Math.max(0, (canvasPoint.x * this.options.canvas.zoom()) - (clientPoint.x - rect.left)),
		top: Math.max(0, (canvasPoint.y * this.options.canvas.zoom()) - (clientPoint.y - rect.top)),
	});
}

private clampZoom(value: number): number {
	return Math.min(Math.max(value, minimumZoom), maximumZoom);
}

private clamp(value: number, minimum: number, maximum: number): number {
	return Math.min(Math.max(value, minimum), maximum);
}

private restore(): void {
	const state = this.options.getState();
	const viewportPanX = state?.viewportPanX ?? this.options.initialViewport?.panX;
	const viewportPanY = state?.viewportPanY ?? this.options.initialViewport?.panY;
	const viewportZoom = state?.viewportZoom ?? this.options.initialViewport?.zoom;
	if (viewportPanX === undefined && viewportPanY === undefined && viewportZoom === undefined) {
		return;
	}

	requestAnimationFrame(() => {
		if (viewportZoom !== undefined) {
			this.setZoom(viewportZoom);
		} else {
			this.resizeForZoom();
		}
		this.options.scrollElement.scrollTo({
			left: viewportPanX ?? this.options.scrollElement.scrollLeft,
			top: viewportPanY ?? this.options.scrollElement.scrollTop,
		});
		this.publishViewportChanged('restore');
	});
}

private publishViewportChanged(changeSource: 'scroll' | 'restore' | 'fit' | 'reset' | 'reveal' | 'zoom'): void {
	this.options.messageBus.publishEvent(new CanvasViewportChangedEvent({
		diagramFilePath: this.options.diagramFilePath,
		panX: this.options.scrollElement.scrollLeft,
		panY: this.options.scrollElement.scrollTop,
		zoom: this.options.canvas.zoom(),
		changeSource,
	}));
}

private topLeftInsertionPosition(): CanvasPoint {
	const zoom = this.options.canvas.zoom();

	return {
		x: Math.max(0, Math.round((this.options.scrollElement.scrollLeft + 80) / zoom)),
		y: Math.max(0, Math.round((this.options.scrollElement.scrollTop + 80) / zoom)),
	};
}

private centerInsertionPosition(): CanvasPoint {
	const position = this.viewportClientPointToCanvasPoint(this.viewportCenterClientPoint(), this.options.canvas.zoom());
	return {
		x: Math.max(0, Math.round(position.x)),
		y: Math.max(0, Math.round(position.y)),
	};
}
}

