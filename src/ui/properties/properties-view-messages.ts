import type { CanvasElementType } from '../../shared/canvas-editor-events';
import type { WebviewCommand } from '../../shared/webview-commands';
import type { DiagramPayload } from '../webview/ontology-diagram-types';
import type { ImageGalleryTargetType } from '../../shared/icon-gallery';

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

export interface PropertiesViewOpenImageGalleryMessage {
	readonly type: 'propertiesViewOpenImageGallery';
	readonly targetType: ImageGalleryTargetType;
	readonly targetId: string;
}

export type PropertiesViewToExtensionMessage = PropertiesViewReadyMessage | PropertiesViewCommandMessage | PropertiesViewFocusCanvasMessage | PropertiesViewOpenImageGalleryMessage;
