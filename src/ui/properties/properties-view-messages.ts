import type { CanvasElementType } from '../../shared/canvas-editor-events';
import type { WebviewCommand } from '../../shared/webview-commands';
import type { DiagramPayload } from '../webview/ontology-diagram-types';

export interface PropertiesViewStateMessage {
	readonly type: 'setPropertiesState';
	readonly payload?: DiagramPayload;
	readonly selectedElementIdentifier?: string;
	readonly selectedElementType?: CanvasElementType;
	readonly selectedElementIdentifiers: readonly string[];
}

export interface PropertiesViewReadyMessage {
	readonly type: 'propertiesViewReady';
}

export interface PropertiesViewCommandMessage {
	readonly type: 'propertiesViewCommand';
	readonly command: WebviewCommand;
}

export interface PropertiesViewFocusCanvasMessage {
	readonly type: 'propertiesViewFocusCanvas';
}

export type PropertiesViewToExtensionMessage = PropertiesViewReadyMessage | PropertiesViewCommandMessage | PropertiesViewFocusCanvasMessage;
