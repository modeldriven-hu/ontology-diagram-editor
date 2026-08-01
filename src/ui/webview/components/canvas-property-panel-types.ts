import type { DiagramCanvasEngine } from '../engine/diagram-canvas-engine';
import type { CanvasElementRegistry } from './canvas-element-registry';
import type { CanvasMessageBus } from '../engine/canvas-message-bus';
import type { DiagramPayload } from '../ontology-diagram-types';
import type { WebviewTheme } from '../webview-theme';

export interface CanvasPropertyPanelOptions {
	readonly canvas: Pick<DiagramCanvasEngine, 'restoreBounds' | 'updateElementContent'>;
	readonly payload: DiagramPayload;
	readonly registry: CanvasElementRegistry;
	readonly messageBus: CanvasMessageBus;
	readonly title: HTMLElement;
	readonly body: HTMLElement;
	readonly getTheme: () => WebviewTheme;
	readonly focusAfterEscape: () => void;
	readonly chooseNodeImage: (id: string) => void;
	readonly chooseStandaloneImage: (id: string) => void;
	readonly selectElements: (elementIdentifiers: readonly string[]) => void;
	readonly selectedTabByContext?: Map<string, string>;
}

export interface PropertyTab {
	readonly id: string;
	readonly label: string;
	readonly sections: readonly HTMLElement[];
}

