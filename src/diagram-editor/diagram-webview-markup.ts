import * as path from 'path';
import * as vscode from 'vscode';
import { escapeHtml } from '../shared/html';
import { diagramLayoutAlgorithms, elkLayeredDirections } from '../shared/diagram-layout';
import { modelTreeDragMimeType } from '../ui/model-tree/model-tree';
import type { CanvasViewport } from '../shared/canvas-viewport';
import type { IconGallerySet } from '../shared/icon-gallery';
import type { DiagramPayload } from '../ui/webview/ontology-diagram-types';

export function webviewHead(document: vscode.TextDocument, nonce: string, cspSource: string, styleUri: vscode.Uri): string {
	return `<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src ${cspSource}; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${escapeHtml(path.basename(document.uri.fsPath))}</title>
	<link rel="stylesheet" href="${styleUri.toString()}">
</head>`;
}

export function webviewBody(
	document: vscode.TextDocument,
	nonce: string,
	x6ScriptUri: vscode.Uri,
	scriptUri: vscode.Uri,
	payload: DiagramPayload,
	iconGallerySets: readonly IconGallerySet[],
	initialViewport?: CanvasViewport,
): string {
	return `<body>
	<div class="editor">
			<header class="header">
				<div class="title-group">
					<span class="title-mark" aria-hidden="true"></span>
					<strong>Ontology Diagram Editor</strong>
				</div>
			</header>
		<div class="canvas-shell" id="canvasShell">
			<div class="canvas-actions" id="canvasActions" role="toolbar" aria-label="Canvas tools">
				<div class="canvas-action-row">
					<button class="canvas-toolbar-drag-handle" id="canvasToolbarDragHandle" type="button" title="Move toolbar" aria-label="Move toolbar"></button>
					<button class="canvas-action" id="addOntologyItemButton" type="button" title="Add ontology item" aria-label="Add ontology item"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<button class="canvas-action" id="addNoteButton" type="button" title="Add note" aria-label="Add note"></button>
					<button class="canvas-action" id="addLabelButton" type="button" title="Add label" aria-label="Add label"></button>
					<button class="canvas-action" id="addImageButton" type="button" title="Add image" aria-label="Add image"></button>
					<button class="canvas-action" id="addMetadataButton" type="button" title="Add diagram information" aria-label="Add diagram information"></button>
					<button class="canvas-action" id="addLegendButton" type="button" title="Add ontology legend" aria-label="Add ontology legend"></button>
					<button class="canvas-action" id="addDiagramLinkButton" type="button" title="Add linked diagram" aria-label="Add linked diagram"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<button class="canvas-action" id="exportSvgButton" type="button" title="Export SVG" aria-label="Export SVG"></button>
					<button class="canvas-action" id="exportPngButton" type="button" title="Export PNG" aria-label="Export PNG"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<select class="canvas-action-select" id="diagramLayoutAlgorithmSelect" title="Diagram layout algorithm" aria-label="Diagram layout algorithm">
						${diagramLayoutAlgorithmOptions()}
					</select>
					<button class="canvas-action" id="arrangeDiagramButton" type="button" title="Arrange diagram" aria-label="Arrange diagram"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<button class="canvas-action" id="panCanvasButton" type="button" title="Pan canvas" aria-label="Pan canvas" aria-pressed="false"></button>
					<button class="canvas-action" id="zoomOutButton" type="button" title="Zoom out" aria-label="Zoom out"></button>
					<button class="canvas-action" id="zoomInButton" type="button" title="Zoom in" aria-label="Zoom in"></button>
					<button class="canvas-action" id="fitDiagramButton" type="button" title="Fit diagram to view" aria-label="Fit diagram to view"></button>
					<button class="canvas-action" id="resetViewportButton" type="button" title="Reset viewport" aria-label="Reset viewport"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<button class="canvas-action" id="revealModelTreeItemButton" type="button" title="Select corresponding model-tree item" aria-label="Select corresponding model-tree item"></button>
					<span class="canvas-action-separator" aria-hidden="true"></span>
					<button class="canvas-action" id="themeModeButton" type="button" title="Switch theme mode" aria-label="Switch theme mode" aria-pressed="false"></button>
					<button class="canvas-action canvas-toolbar-pin" id="canvasToolbarPinButton" type="button" title="Pin toolbar to top or bottom" aria-label="Pin toolbar to top or bottom" aria-pressed="false"></button>
				</div>
				<span class="canvas-layout-spacing" id="elkLayeredSpacingControls" hidden>
					<label class="canvas-layout-spacing-field">Direction<select class="canvas-layout-spacing-input canvas-layout-direction-select" id="elkLayeredDirectionSelect" aria-label="ELK Layered direction">${elkLayeredDirectionOptions()}</select></label>
					<label class="canvas-layout-spacing-field">Node gap<input class="canvas-layout-spacing-input" id="elkLayeredNodeSpacingInput" type="number" min="16" max="480" step="1" inputmode="numeric" aria-label="ELK Layered node gap"></label>
					<label class="canvas-layout-spacing-field">Layer gap<input class="canvas-layout-spacing-input" id="elkLayeredLayerSpacingInput" type="number" min="16" max="480" step="1" inputmode="numeric" aria-label="ELK Layered layer gap"></label>
				</span>
			</div>
			<div class="canvas-scroll" id="canvasScroll" tabindex="0">
				<form class="note-editor" id="noteEditor" hidden>
					<textarea class="note-editor-text" id="noteEditorText" rows="5" aria-label="Note text"></textarea>
					<div class="note-editor-actions">
						<button class="note-editor-button primary" id="saveNoteButton" type="button">Save</button>
						<button class="note-editor-button" id="cancelNoteButton" type="button">Cancel</button>
					</div>
				</form>
				<div class="local-element-toolbar" id="localElementToolbar" role="toolbar" aria-label="Selected element actions" hidden>
					<button class="local-element-drag-handle" id="localElementDragHandle" type="button" title="Move toolbar" aria-label="Move toolbar"></button>
					<button class="local-element-action" id="minimizeLocalButton" type="button" title="Resize to minimum size" aria-label="Resize to minimum size"></button>
					<button class="local-element-action" id="openDiagramLinkLocalButton" type="button" title="Open linked diagram" aria-label="Open linked diagram"></button>
					<button class="local-element-action" id="createCommentNoteLocalButton" type="button" title="Create note from ontology comment" aria-label="Create note from ontology comment"></button>
					<button class="local-element-action" id="showRelatedElementsLocalButton" type="button" title="Show related elements" aria-label="Show related elements"></button>
					<button class="local-element-action" id="showEdgesBetweenNodesLocalButton" type="button" title="Show edges between selected nodes" aria-label="Show edges between selected nodes"></button>
					<button class="local-element-action" id="alignLeftLocalButton" type="button" title="Align selected nodes left" aria-label="Align selected nodes left"></button>
					<button class="local-element-action" id="alignHorizontalCenterLocalButton" type="button" title="Align selected node horizontal centers" aria-label="Align selected node horizontal centers"></button>
					<button class="local-element-action" id="alignRightLocalButton" type="button" title="Align selected nodes right" aria-label="Align selected nodes right"></button>
					<button class="local-element-action" id="alignTopLocalButton" type="button" title="Align selected nodes top" aria-label="Align selected nodes top"></button>
					<button class="local-element-action" id="alignVerticalCenterLocalButton" type="button" title="Align selected node vertical centers" aria-label="Align selected node vertical centers"></button>
					<button class="local-element-action" id="alignBottomLocalButton" type="button" title="Align selected nodes bottom" aria-label="Align selected nodes bottom"></button>
					<span class="local-element-action-separator" id="nodeSelectionSizeSeparator" aria-hidden="true"></span>
					<button class="local-element-action" id="matchWidthLocalButton" type="button" title="Match selected node width" aria-label="Match selected node width"></button>
					<button class="local-element-action" id="matchHeightLocalButton" type="button" title="Match selected node height" aria-label="Match selected node height"></button>
					<button class="local-element-action" id="matchSizeLocalButton" type="button" title="Match selected node size" aria-label="Match selected node size"></button>
					<span class="local-element-action-separator" id="nodeSelectionDistributeSeparator" aria-hidden="true"></span>
					<button class="local-element-action" id="distributeHorizontalLocalButton" type="button" title="Distribute selected nodes horizontally" aria-label="Distribute selected nodes horizontally"></button>
					<button class="local-element-action" id="distributeVerticalLocalButton" type="button" title="Distribute selected nodes vertically" aria-label="Distribute selected nodes vertically"></button>
					<span class="local-element-action-separator" id="nodeSelectionSubclassSeparator" aria-hidden="true"></span>
					<button class="local-element-action" id="alignSubclassEndpointsLocalButton" type="button" title="Align subclass endpoints" aria-label="Align subclass endpoints"></button>
					<button class="local-element-action" id="connectNoteLocalButton" type="button" title="Connect note" aria-label="Connect note" aria-pressed="false"></button>
					<button class="local-element-action" id="alignEdgeStartPointsLocalButton" type="button" title="Align edge start positions" aria-label="Align edge start positions"></button>
					<button class="local-element-action" id="alignEdgeEndPointsLocalButton" type="button" title="Align edge end positions" aria-label="Align edge end positions"></button>
					<button class="local-element-action" id="optimizeEdgeLocalButton" type="button" title="Optimize edge path" aria-label="Optimize edge path"></button>
					<button class="local-element-action" id="straightenEdgeLocalButton" type="button" title="Straighten edge" aria-label="Straighten edge"></button>
					<select class="local-element-select" id="edgeRouteLayoutLocalSelect" title="Edge routing type" aria-label="Edge routing type">
						<option value="">Default (orthogonal)</option>
						<option value="orthogonal">Orthogonal</option>
						<option value="direct">Direct</option>
						<option value="one_side">One Side</option>
						<option value="manhattan">Manhattan</option>
						<option value="metro">Metro</option>
						<option value="entity_relation">Entity Relation</option>
					</select>
					<select class="local-element-select edge-presentation-select" id="edgePresentationLocalSelect" title="Edge presentation" aria-label="Edge presentation">
						<option value="connection">Connection</option>
						<option value="target_contains_source">Containment: target contains source</option>
						<option value="source_contains_target">Containment: source contains target</option>
					</select>
					<button class="local-element-action" id="resetEdgeLabelLocalButton" type="button" title="Reset label position" aria-label="Reset label position"></button>
					<button class="local-element-action" id="deleteEdgeLocalButton" type="button" title="Remove edge" aria-label="Remove edge"></button>
				</div>
				<div class="canvas-content" id="canvasContent"></div>
				<p class="status" id="status"></p>
			</div>
			<div class="node-comment-tooltip" id="nodeCommentTooltip" role="tooltip" hidden></div>
		</div>
	</div>
	<script nonce="${nonce}">
		window.ontologyDiagramEditorConfig = {
			payload: ${jsonForScript(payload)},
			iconGallerySets: ${jsonForScript(iconGallerySets)},
			initialViewport: ${jsonForScript(initialViewport)},
			modelTreeDragMimeType: '${modelTreeDragMimeType.toLowerCase()}'
		};
	</script>
	<script nonce="${nonce}" src="${x6ScriptUri.toString()}"></script>
	<script nonce="${nonce}" src="${scriptUri.toString()}"></script>
</body>`;
}

function diagramLayoutAlgorithmOptions(): string {
	return diagramLayoutAlgorithms
		.map((algorithm) => `<option value="${escapeHtml(algorithm.id)}">${escapeHtml(algorithm.label)}</option>`)
		.join('\n');
}

function elkLayeredDirectionOptions(): string {
	return elkLayeredDirections
		.map((direction) => `<option value="${escapeHtml(direction.id)}">${escapeHtml(direction.label)}</option>`)
		.join('\n');
}


export function jsonForScript(value: unknown): string {
	const json = JSON.stringify(value);
	return json === undefined ? 'undefined' : json.replaceAll('<', '\\u003c');
}
