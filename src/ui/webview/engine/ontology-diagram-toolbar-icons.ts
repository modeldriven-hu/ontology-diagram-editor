import { AlignCenterHorizontal, AlignCenterVertical, AlignEndHorizontal, AlignEndVertical, AlignHorizontalSpaceBetween, AlignStartHorizontal, AlignStartVertical, AlignVerticalSpaceBetween, Columns2, GitBranchPlus, GitFork, GitMerge, GripVertical, Hand, LayoutTemplate, Link2, LocateFixed, Maximize2, Minimize2, Moon, Pin, RotateCcw, Route, Rows2, Search, SquareEqual, StickyNotePlus, Sun, Trash2, ZoomIn, ZoomOut, createElement as createIconElement } from 'lucide';

import type { WebviewThemeMode } from '../webview-theme';
import { setActionTooltip } from './canvas-dom';

export interface LocalElementToolbarIconElements {
	readonly localElementDragHandle: HTMLButtonElement;
	readonly minimizeLocalButton: HTMLButtonElement;
	readonly createCommentNoteLocalButton: HTMLButtonElement;
	readonly showRelatedElementsLocalButton: HTMLButtonElement;
	readonly showEdgesBetweenNodesLocalButton: HTMLButtonElement;
	readonly alignLeftLocalButton: HTMLButtonElement;
	readonly alignHorizontalCenterLocalButton: HTMLButtonElement;
	readonly alignRightLocalButton: HTMLButtonElement;
	readonly alignTopLocalButton: HTMLButtonElement;
	readonly alignVerticalCenterLocalButton: HTMLButtonElement;
	readonly alignBottomLocalButton: HTMLButtonElement;
	readonly matchWidthLocalButton: HTMLButtonElement;
	readonly matchHeightLocalButton: HTMLButtonElement;
	readonly matchSizeLocalButton: HTMLButtonElement;
	readonly distributeHorizontalLocalButton: HTMLButtonElement;
	readonly distributeVerticalLocalButton: HTMLButtonElement;
	readonly alignSubclassEndpointsLocalButton: HTMLButtonElement;
	readonly connectNoteLocalButton: HTMLButtonElement;
	readonly alignEdgeStartPointsLocalButton: HTMLButtonElement;
	readonly alignEdgeEndPointsLocalButton: HTMLButtonElement;
	readonly optimizeEdgeLocalButton: HTMLButtonElement;
	readonly straightenEdgeLocalButton: HTMLButtonElement;
	readonly resetEdgeLabelLocalButton: HTMLButtonElement;
	readonly deleteEdgeLocalButton: HTMLButtonElement;
}

export interface ViewportToolbarIconElements {
	readonly panCanvasButton: HTMLButtonElement;
	readonly zoomOutButton: HTMLButtonElement;
	readonly zoomInButton: HTMLButtonElement;
	readonly fitDiagramButton: HTMLButtonElement;
	readonly resetViewportButton: HTMLButtonElement;
	readonly revealModelTreeItemButton: HTMLButtonElement;
	readonly themeModeButton: HTMLButtonElement;
}

export function renderCanvasToolbarDragHandle(canvasToolbarDragHandle: HTMLButtonElement): void {
	canvasToolbarDragHandle.replaceChildren(createIconElement(GripVertical, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(canvasToolbarDragHandle, 'Move toolbar');
}

export function renderCanvasToolbarPinIcon(canvasToolbarPinButton: HTMLButtonElement): void {
	canvasToolbarPinButton.replaceChildren(createIconElement(Pin, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(canvasToolbarPinButton, 'Pin toolbar to top or bottom');
}

export function renderLocalElementToolbarIcons(elements: LocalElementToolbarIconElements): void {
	elements.localElementDragHandle.replaceChildren(createIconElement(GripVertical, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.localElementDragHandle, 'Move toolbar');

	elements.minimizeLocalButton.replaceChildren(createIconElement(Minimize2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.minimizeLocalButton, 'Resize to minimum size');

	elements.createCommentNoteLocalButton.replaceChildren(createIconElement(StickyNotePlus, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.createCommentNoteLocalButton, 'Create note from ontology comment');

	elements.showRelatedElementsLocalButton.replaceChildren(createIconElement(GitBranchPlus, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.showRelatedElementsLocalButton, 'Show related elements');

	elements.showEdgesBetweenNodesLocalButton.replaceChildren(createIconElement(GitFork, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.showEdgesBetweenNodesLocalButton, 'Show edges between selected nodes');

	elements.alignLeftLocalButton.replaceChildren(createIconElement(AlignStartVertical, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignLeftLocalButton, 'Align selected nodes left');

	elements.alignHorizontalCenterLocalButton.replaceChildren(createIconElement(AlignCenterVertical, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignHorizontalCenterLocalButton, 'Align selected node horizontal centers');

	elements.alignRightLocalButton.replaceChildren(createIconElement(AlignEndVertical, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignRightLocalButton, 'Align selected nodes right');

	elements.alignTopLocalButton.replaceChildren(createIconElement(AlignStartHorizontal, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignTopLocalButton, 'Align selected nodes top');

	elements.alignVerticalCenterLocalButton.replaceChildren(createIconElement(AlignCenterHorizontal, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignVerticalCenterLocalButton, 'Align selected node vertical centers');

	elements.alignBottomLocalButton.replaceChildren(createIconElement(AlignEndHorizontal, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignBottomLocalButton, 'Align selected nodes bottom');

	elements.matchWidthLocalButton.replaceChildren(createIconElement(Columns2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.matchWidthLocalButton, 'Match selected node width');

	elements.matchHeightLocalButton.replaceChildren(createIconElement(Rows2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.matchHeightLocalButton, 'Match selected node height');

	elements.matchSizeLocalButton.replaceChildren(createIconElement(SquareEqual, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.matchSizeLocalButton, 'Match selected node size');

	elements.distributeHorizontalLocalButton.replaceChildren(createIconElement(AlignHorizontalSpaceBetween, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.distributeHorizontalLocalButton, 'Distribute selected nodes horizontally');

	elements.distributeVerticalLocalButton.replaceChildren(createIconElement(AlignVerticalSpaceBetween, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.distributeVerticalLocalButton, 'Distribute selected nodes vertically');

	elements.alignSubclassEndpointsLocalButton.replaceChildren(createIconElement(GitMerge, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.alignSubclassEndpointsLocalButton, 'Align subclass endpoints');

	elements.alignEdgeStartPointsLocalButton.replaceChildren(alignEdgeEndpointIcon('start'));
	setActionTooltip(elements.alignEdgeStartPointsLocalButton, 'Align edge start positions');

	elements.alignEdgeEndPointsLocalButton.replaceChildren(alignEdgeEndpointIcon('end'));
	setActionTooltip(elements.alignEdgeEndPointsLocalButton, 'Align edge end positions');

	const badge = document.createElement('span');
	badge.className = 'local-action-note-badge';
	badge.textContent = 'N';
	elements.connectNoteLocalButton.replaceChildren(createIconElement(Link2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}), badge);
	setActionTooltip(elements.connectNoteLocalButton, 'Connect note');
	elements.connectNoteLocalButton.setAttribute('aria-pressed', 'false');

	elements.optimizeEdgeLocalButton.replaceChildren(createIconElement(Route, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.optimizeEdgeLocalButton, 'Optimize edge path');

	elements.straightenEdgeLocalButton.replaceChildren(straightenEdgeIcon());
	setActionTooltip(elements.straightenEdgeLocalButton, 'Straighten edge');

	elements.resetEdgeLabelLocalButton.replaceChildren(resetEdgeLabelIcon());
	setActionTooltip(elements.resetEdgeLabelLocalButton, 'Reset label position');

	elements.deleteEdgeLocalButton.replaceChildren(createIconElement(Trash2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.deleteEdgeLocalButton, 'Remove edge');
}

export function renderViewportToolbarIcons(elements: ViewportToolbarIconElements, themeMode: WebviewThemeMode): void {
	elements.panCanvasButton.replaceChildren(createIconElement(Hand, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	setActionTooltip(elements.panCanvasButton, 'Pan canvas');
	elements.zoomOutButton.replaceChildren(createIconElement(ZoomOut, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	elements.zoomInButton.replaceChildren(createIconElement(ZoomIn, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	elements.fitDiagramButton.replaceChildren(createIconElement(Maximize2, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	elements.resetViewportButton.replaceChildren(createIconElement(RotateCcw, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	elements.revealModelTreeItemButton.replaceChildren(createIconElement(LocateFixed, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	renderThemeModeButton(elements.themeModeButton, themeMode);
}

export function renderAddOntologyItemToolbarIcon(addOntologyItemButton: HTMLButtonElement): void {
	addOntologyItemButton.replaceChildren(createIconElement(Search, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	addOntologyItemButton.title = 'Search and add ontology item';
	addOntologyItemButton.setAttribute('aria-label', 'Search and add ontology item');
}

export function renderArrangeDiagramToolbarIcon(arrangeDiagramButton: HTMLButtonElement): void {
	arrangeDiagramButton.replaceChildren(createIconElement(LayoutTemplate, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	arrangeDiagramButton.title = 'Arrange diagram';
	arrangeDiagramButton.setAttribute('aria-label', 'Arrange diagram');
}

export function renderThemeModeButton(themeModeButton: HTMLButtonElement, themeMode: WebviewThemeMode): void {
	const nextMode = themeMode === 'dark' ? 'light' : 'dark';
	themeModeButton.replaceChildren(createIconElement(themeMode === 'dark' ? Sun : Moon, {
		'aria-hidden': 'true',
		class: 'canvas-action-icon',
	}));
	themeModeButton.title = `Switch to ${nextMode} mode`;
	themeModeButton.setAttribute('aria-label', `Switch to ${nextMode} mode`);
	themeModeButton.setAttribute('aria-pressed', String(themeMode === 'dark'));
}

function alignEdgeEndpointIcon(endpoint: 'start' | 'end'): SVGElement {
	const icon = toolbarSvgIcon();
	if (endpoint === 'start') {
		appendSvgElement(icon, 'path', {
			d: 'M6 6v12',
			opacity: '0.45',
		});
		appendSvgElement(icon, 'path', {
			d: 'M7 8h5l5-3',
		});
		appendSvgElement(icon, 'path', {
			d: 'M7 12h11',
		});
		appendSvgElement(icon, 'path', {
			d: 'M7 16h5l5 3',
		});
		appendSvgElement(icon, 'circle', {
			cx: '6',
			cy: '12',
			r: '2',
			fill: 'currentColor',
			stroke: 'none',
		});
		appendSvgElement(icon, 'path', {
			d: 'm4 4 4 4',
		});
		appendSvgElement(icon, 'path', {
			d: 'm8 16-4 4',
		});
	} else {
		appendSvgElement(icon, 'path', {
			d: 'M18 6v12',
			opacity: '0.45',
		});
		appendSvgElement(icon, 'path', {
			d: 'M17 8h-5L7 5',
		});
		appendSvgElement(icon, 'path', {
			d: 'M17 12H6',
		});
		appendSvgElement(icon, 'path', {
			d: 'M17 16h-5l-5 3',
		});
		appendSvgElement(icon, 'circle', {
			cx: '18',
			cy: '12',
			r: '2',
			fill: 'currentColor',
			stroke: 'none',
		});
		appendSvgElement(icon, 'path', {
			d: 'm20 4-4 4',
		});
		appendSvgElement(icon, 'path', {
			d: 'm16 16 4 4',
		});
	}

	return icon;
}

function straightenEdgeIcon(): SVGElement {
	const icon = toolbarSvgIcon();
	appendSvgElement(icon, 'path', {
		d: 'M5 6h6v5h8',
		opacity: '0.45',
	});
	appendSvgElement(icon, 'path', {
		d: 'M5 18h14',
	});
	appendSvgElement(icon, 'path', {
		d: 'M12 12v4',
	});
	appendSvgElement(icon, 'path', {
		d: 'm9.5 13.5 2.5 2.5 2.5-2.5',
	});
	appendSvgElement(icon, 'circle', {
		cx: '5',
		cy: '18',
		r: '1.4',
		fill: 'currentColor',
		stroke: 'none',
	});
	appendSvgElement(icon, 'circle', {
		cx: '19',
		cy: '18',
		r: '1.4',
		fill: 'currentColor',
		stroke: 'none',
	});

	return icon;
}

function resetEdgeLabelIcon(): SVGElement {
	const icon = toolbarSvgIcon();
	appendSvgElement(icon, 'path', {
		d: 'M4 16h16',
	});
	appendSvgElement(icon, 'circle', {
		cx: '12',
		cy: '16',
		r: '1.4',
		fill: 'currentColor',
		stroke: 'none',
	});
	appendSvgElement(icon, 'rect', {
		x: '14',
		y: '4',
		width: '7',
		height: '5',
		rx: '1.2',
	});
	appendSvgElement(icon, 'path', {
		d: 'M17.5 9.5c0 3.4-2.1 5.5-5.5 5.5',
	});
	appendSvgElement(icon, 'path', {
		d: 'm14.2 12.8-2.2 2.2 3 1',
	});

	return icon;
}

function toolbarSvgIcon(): SVGElement {
	const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
	icon.setAttribute('aria-hidden', 'true');
	icon.setAttribute('class', 'canvas-action-icon');
	icon.setAttribute('viewBox', '0 0 24 24');
	icon.setAttribute('fill', 'none');
	icon.setAttribute('stroke', 'currentColor');
	icon.setAttribute('stroke-width', '1.9');
	icon.setAttribute('stroke-linecap', 'round');
	icon.setAttribute('stroke-linejoin', 'round');

	return icon;
}

function appendSvgElement(parent: SVGElement, tagName: string, attributes: Record<string, string>): void {
	const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
	for (const [name, value] of Object.entries(attributes)) {
		element.setAttribute(name, value);
	}
	parent.appendChild(element);
}
