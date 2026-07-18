import { CanvasSelectionChangedEvent } from '../../../shared/canvas-editor-events';
import { CanvasElementRegistry } from '../../webview/components/canvas-element-registry';
import { CanvasPropertyPanel } from '../../webview/components/canvas-property-panel';
import { CanvasMessageBus } from '../../webview/engine/canvas-message-bus';
import { readTheme } from '../../webview/webview-theme';
import type { PropertiesViewCommandMessage, PropertiesViewStateMessage } from '../properties-view-messages';

interface VsCodeApi {
	postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const vscode = acquireVsCodeApi();
const root = requiredElement('propertiesRoot');
const selectedTabByContext = new Map<string, string>();

window.addEventListener('message', (event: MessageEvent<PropertiesViewStateMessage>) => {
	if (event.data.type === 'setPropertiesState') {
		render(event.data);
	}
});

vscode.postMessage({ type: 'propertiesViewReady' });

function render(state: PropertiesViewStateMessage): void {
	root.textContent = '';
	const payload = state.payload;
	if (payload === undefined) {
		root.appendChild(placeholder('Open an ontology diagram to inspect its properties.'));
		return;
	}
	if (payload.error !== undefined) {
		root.appendChild(placeholder(payload.error));
		return;
	}

	const panel = document.createElement('section');
	panel.className = 'properties-panel';
	const title = document.createElement('div');
	title.className = 'properties-context-title';
	const body = document.createElement('div');
	body.className = 'property-panel-body';
	panel.append(title, body);
	root.appendChild(panel);

	const messageBus = new CanvasMessageBus();
	messageBus.subscribe((message) => {
		if (message.kind !== 'command') {
			return;
		}
		const hostMessage: PropertiesViewCommandMessage = {
			type: 'propertiesViewCommand',
			command: message.payload,
		};
		vscode.postMessage(hostMessage);
	});

	const registry = new CanvasElementRegistry(payload);
	new CanvasPropertyPanel({
		canvas: {
			restoreBounds: () => {},
			updateElementContent: () => {},
		},
		payload,
		registry,
		messageBus,
		title,
		body,
		getTheme: () => readTheme(payload.diagram?.metadata?.theme_mode, payload.theme),
		focusAfterEscape: () => vscode.postMessage({ type: 'propertiesViewFocusCanvas' }),
		selectedTabByContext,
	}).register();

	messageBus.publishEvent(new CanvasSelectionChangedEvent({
		diagramFilePath: payload.file?.fsPath,
		selectedElementIdentifier: state.selectedElementIdentifier,
		selectedElementType: state.selectedElementType,
		selectedElementIdentifiers: state.selectedElementIdentifiers,
	}));
}

function placeholder(message: string): HTMLElement {
	const element = document.createElement('p');
	element.className = 'properties-placeholder';
	element.textContent = message;

	return element;
}

function requiredElement(id: string): HTMLElement {
	const element = document.getElementById(id);
	if (element === null) {
		throw new Error(`Missing required properties view element: ${id}`);
	}

	return element;
}
