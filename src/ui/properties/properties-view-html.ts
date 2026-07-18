import * as vscode from 'vscode';

export function buildPropertiesViewHtml(webview: vscode.Webview): string {
	const nonce = createNonce();
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(vscode.Uri.file(__dirname), 'webview', 'properties-view.js'),
	);

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${webview.cspSource} data:; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Properties</title>
	<style>${propertiesViewStyles()}</style>
</head>
<body>
	<main id="propertiesRoot" class="properties-root" tabindex="-1">
		<p class="properties-placeholder">Open an ontology diagram to inspect its properties.</p>
	</main>
	<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>
</html>`;
}

function propertiesViewStyles(): string {
	return `
	* { box-sizing: border-box; }
	body {
		margin: 0;
		color: var(--vscode-sideBar-foreground, var(--vscode-foreground));
		background: var(--vscode-sideBar-background);
		font-family: var(--vscode-font-family);
		font-size: var(--vscode-font-size);
		line-height: 1.4;
	}
	button, input, select, textarea { font: inherit; }
	.properties-root { min-width: 0; padding: 7px 10px 12px; }
	.properties-context-title {
		display: flex;
		align-items: center;
		gap: 9px;
		min-width: 0;
		margin: 0 0 9px;
		padding: 3px 3px 9px;
		border-bottom: 1px solid var(--vscode-panel-border);
		color: var(--vscode-sideBarTitle-foreground, var(--vscode-foreground));
	}
	.properties-context-icon {
		flex: 0 0 auto;
		width: 20px;
		height: 20px;
		color: var(--vscode-symbolIcon-classForeground, var(--vscode-icon-foreground));
	}
	.properties-context-text { display: flex; flex-direction: column; min-width: 0; line-height: 1.25; }
	.properties-context-kind { overflow: hidden; font-size: 13px; font-weight: 600; text-overflow: ellipsis; white-space: nowrap; }
	.properties-context-id {
		overflow: hidden;
		color: var(--vscode-descriptionForeground);
		font-family: var(--vscode-editor-font-family, monospace);
		font-size: 11px;
		font-weight: 400;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.properties-placeholder {
		margin: 4px 2px;
		color: var(--vscode-descriptionForeground);
	}
	.property-empty-message { margin: 4px 3px; color: var(--vscode-descriptionForeground); font-size: 12px; }
	.property-panel-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
	.property-tabs { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; gap: 10px; }
	.property-tab-list {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 2px;
		min-width: 0;
		border-bottom: 1px solid var(--vscode-panel-border);
	}
	.property-tab {
		position: relative;
		flex: 0 0 auto;
		min-width: 0;
		padding: 5px 8px 6px;
		border: 0;
		border-radius: 4px 4px 0 0;
		background: transparent;
		color: var(--vscode-descriptionForeground);
		font-size: 12px;
		cursor: pointer;
	}
	.property-tab:hover, .property-tab:focus-visible {
		background: color-mix(in srgb, var(--vscode-focusBorder) 12%, transparent);
		color: var(--vscode-foreground);
		outline: none;
	}
	.property-tab[aria-selected="true"] {
		color: var(--vscode-foreground);
		background: color-mix(in srgb, var(--vscode-sideBar-background) 88%, var(--vscode-editor-background));
	}
	.property-tab[aria-selected="true"]::after {
		content: "";
		position: absolute;
		right: 6px;
		bottom: -1px;
		left: 6px;
		height: 2px;
		border-radius: 1px;
		background: var(--vscode-focusBorder);
	}
	.property-tab-panes, .property-tab-pane { min-width: 0; }
	.property-tab-pane { display: grid; grid-template-columns: minmax(0, 1fr); gap: 12px; }
	.property-tab-pane[hidden] { display: none; }
	.property-section { min-width: 0; }
	.property-section-title {
		margin: 0 0 6px;
		padding-bottom: 4px;
		border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent);
		color: var(--vscode-sideBarSectionHeader-foreground, var(--vscode-foreground));
		font-size: 11px;
		font-weight: 600;
		letter-spacing: .04em;
		text-transform: uppercase;
	}
	.property-field {
		display: grid;
		grid-template-columns: minmax(82px, 104px) minmax(0, 1fr);
		align-items: center;
		gap: 7px;
		min-height: 30px;
		padding: 2px 0;
	}
	.property-label { min-width: 0; color: var(--vscode-descriptionForeground); font-size: 12px; }
	.property-value { min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; font-size: 12px; }
	.property-input, .property-textarea {
		min-width: 0;
		width: 100%;
		border: 1px solid var(--vscode-input-border, transparent);
		border-radius: 2px;
		background: var(--vscode-input-background);
		color: var(--vscode-input-foreground);
		outline: none;
	}
	.property-input { height: 26px; padding: 2px 6px; }
	.property-textarea { min-height: 74px; padding: 5px 6px; resize: vertical; }
	.property-input:focus, .property-textarea:focus { border-color: var(--vscode-focusBorder); }
	.property-checkbox { justify-self: start; width: 16px; height: 16px; margin: 0; accent-color: var(--vscode-focusBorder); }
	.property-inline { display: flex; align-items: center; gap: 4px; min-width: 0; width: 100%; }
	.property-inline .property-input { flex: 1 1 auto; }
	.property-combo-field { display: block; min-width: 0; width: 100%; }
	.property-color-field { align-items: stretch; }
	.property-color-input {
		flex: 0 0 auto;
		width: 30px;
		height: 26px;
		padding: 2px;
		border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
		border-radius: 2px;
		background: var(--vscode-input-background);
		cursor: pointer;
	}
	.property-color-input:focus { border-color: var(--vscode-focusBorder); outline: none; }
	.property-button {
		flex: 0 0 auto;
		min-height: 26px;
		padding: 2px 8px;
		border: 1px solid var(--vscode-button-border, transparent);
		border-radius: 2px;
		background: var(--vscode-button-secondaryBackground);
		color: var(--vscode-button-secondaryForeground);
		cursor: pointer;
	}
	.property-button:hover { background: var(--vscode-button-secondaryHoverBackground); }
	.property-button-danger {
		background: var(--vscode-inputValidation-errorBackground, var(--vscode-button-secondaryBackground));
		border-color: var(--vscode-inputValidation-errorBorder, var(--vscode-button-border, transparent));
		color: var(--vscode-inputValidation-errorForeground, var(--vscode-button-secondaryForeground));
	}
	@media (max-width: 245px) {
		.property-field { grid-template-columns: minmax(0, 1fr); gap: 2px; padding-bottom: 5px; }
	}
	`;
}

function createNonce(): string {
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	let text = '';
	for (let index = 0; index < 32; index += 1) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}

	return text;
}
