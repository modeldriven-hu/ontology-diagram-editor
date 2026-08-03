import { SaveDiagramExportCommand } from '../../../shared/webview-commands';
import { escapeHtml } from '../../../shared/html';
import type { DiagramEdge, DiagramElementStyle, DiagramImage, DiagramLabel, DiagramLegendElement, DiagramLink, DiagramMetadataElement, DiagramNode, DiagramNote, DiagramPayload } from '../ontology-diagram-types';
import { defaultDiagramLinkIcon, diagramLinkName } from './ontology-diagram-links';
import { diagramPresentationTheme } from './diagram-canvas-presentation';
import { containmentHeaderHeight, createDiagramContainmentIndex } from '../../../shared/diagram-containment';
import { nodeOntologyLabel, ontologyBackgroundColor, ontologyColor, ontologyColorMode, ontologyLegendEntries, readableTextColor } from './ontology-legend';
import { defaultSourceCardinalityLabel, defaultTargetCardinalityLabel, edgeCardinalityLabels } from './edge-cardinality-labels';
import { edgeDisplayName } from './ontology-diagram-edges';
import { measuredTextWidth, nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeDataPropertyLayout, nodeTitleDisplayText, visibleNodeAttributeTextLines } from './node-data-properties';
import { noteFoldBackground } from './note-colors';
import { noteHtmlResetStyle, noteHtmlStyle, sanitizedNoteHtml } from './note-html';
import { containmentColorAtDepth, type WebviewTheme } from '../webview-theme';
import { elementCornerRadius, isNoteConnection, nodeImagePresentation, nodeImageViewport, plainPresentationText } from './presentation/diagram-presentation';
import { svgToPngBase64 } from './svg-to-png';
import type { DiagramExport, ExportBounds, TextBlockOptions } from './canvas-export-types';
import { explicitLines, wrapLines } from './canvas-export-text-layout';
import { centeredTextBounds, diagramContentBounds, edgeExportBounds, edgeLabelAppearance, edgeRoutePoints, elementBounds, standaloneLabelExportBounds } from './canvas-export-bounds';

export function renderDiagramExportToolbarIcons(exportSvgButton: HTMLButtonElement, exportPngButton: HTMLButtonElement): void {
	exportSvgButton.replaceChildren(exportTextIcon('SVG'));
	exportPngButton.replaceChildren(exportTextIcon('PNG'));
}

function exportTextIcon(label: string): HTMLSpanElement {
	const icon = document.createElement('span');
	icon.className = 'canvas-action-text-icon';
	icon.setAttribute('aria-hidden', 'true');
	icon.textContent = label;

	return icon;
}

export function createSvgExportCommand(payload: DiagramPayload, theme: WebviewTheme): SaveDiagramExportCommand | undefined {
	const diagramExport = createSvgExport(payload, diagramPresentationTheme(theme, payload));
	if (diagramExport === undefined) {
		return undefined;
	}

	return new SaveDiagramExportCommand({
		format: 'svg',
		defaultFileName: diagramExport.defaultFileName,
		content: diagramExport.svg,
		encoding: 'utf8',
	});
}

export async function createPngExportCommand(payload: DiagramPayload, theme: WebviewTheme): Promise<SaveDiagramExportCommand | undefined> {
	const diagramExport = createSvgExport(payload, diagramPresentationTheme(theme, payload));
	if (diagramExport === undefined) {
		return undefined;
	}

	const content = await svgToPngBase64(diagramExport.svg, diagramExport.width, diagramExport.height);

	return new SaveDiagramExportCommand({
		format: 'png',
		defaultFileName: diagramExport.defaultFileName.replace(/\.svg$/u, '.png'),
		content,
		encoding: 'base64',
	});
}

function createSvgExport(payload: DiagramPayload, theme: WebviewTheme): DiagramExport | undefined {
	const diagram = payload.diagram;
	if (diagram === undefined) {
		return undefined;
	}

	const nodes = diagram.nodes ?? [];
	const containment = createDiagramContainmentIndex(nodes.map((node) => node.id), diagram.edges ?? []);
	const edges = (diagram.edges ?? []).filter((edge) => !containment.containmentEdgeIds.has(edge.id));
	const orderedNodes = nodes
		.map((node, index) => ({ node, index }))
		.sort((left, right) =>
			(containment.depthByNodeId.get(left.node.id) ?? 0)
			- (containment.depthByNodeId.get(right.node.id) ?? 0)
			|| left.index - right.index)
		.map(({ node }) => node);
	const containerNodes = orderedNodes.filter((node) => containment.containerNodeIds.has(node.id));
	const leafNodes = orderedNodes.filter((node) => !containment.containerNodeIds.has(node.id));
	const notes = (diagram.notes ?? []).filter((note) => note.export !== false);
	const images = diagram.images ?? [];
	const labels = diagram.labels ?? [];
	const metadataElements = diagram.metadata_elements ?? [];
	const legendElements = diagram.legend_elements ?? [];
	const diagramLinks = diagram.diagram_links ?? [];
	const contentBounds = diagramContentBounds([
		...nodes,
		...edges.flatMap((edge) => edgeExportBounds(edge, payload, theme)),
		...notes,
		...images,
		...labels.map((label) => standaloneLabelExportBounds(label, theme)),
		...metadataElements,
		...legendElements,
		...diagramLinks,
	]);
	if (contentBounds === undefined) {
		return undefined;
	}

	const margin = 24;
	const viewBox = {
		x: contentBounds.x - margin,
		y: contentBounds.y - margin,
		width: contentBounds.width + (margin * 2),
		height: contentBounds.height + (margin * 2),
	};
	const width = Math.ceil(viewBox.width);
	const height = Math.ceil(viewBox.height);
	const svg = [
		'<?xml version="1.0" encoding="UTF-8"?>',
		`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${numberValue(viewBox.x)} ${numberValue(viewBox.y)} ${numberValue(viewBox.width)} ${numberValue(viewBox.height)}">`,
		'<defs>',
		'<filter id="shadow" x="-30%" y="-30%" width="160%" height="170%">',
		'<feDropShadow dx="0" dy="5" stdDeviation="4" flood-color="#0F172A" flood-opacity="0.12"/>',
		'</filter>',
		...edges.flatMap((edge) => renderEdgeMarkerDefinitions(edge, payload, theme)),
		'</defs>',
		`<style>${noteHtmlResetStyle()}</style>`,
		`<rect x="${numberValue(viewBox.x)}" y="${numberValue(viewBox.y)}" width="${numberValue(viewBox.width)}" height="${numberValue(viewBox.height)}" fill="${escapeAttribute(theme.canvasBackground)}"/>`,
		...images.map((image) => renderImage(image, theme)),
		...containerNodes.map((node) => renderNode(
			node,
			payload,
			theme,
			true,
			containment.depthByNodeId.get(node.id) ?? 0,
		)),
		...edges.map((edge) => renderEdge(edge, payload, theme)),
		...leafNodes.map((node) => renderNode(
			node,
			payload,
			theme,
			false,
			containment.parentByNodeId.has(node.id)
				? containment.depthByNodeId.get(node.id) ?? 0
				: undefined,
		)),
		...notes.map((note) => renderNote(note, theme)),
		...labels.map((label) => renderLabel(label, theme)),
		...metadataElements.map((element) => renderMetadataElement(element, payload, theme)),
		...legendElements.map((element) => renderLegendElement(element, payload, theme)),
		...diagramLinks.map((link) => renderDiagramLink(link, theme)),
		'</svg>',
	].join('\n');

	return {
		svg,
		width,
		height,
		defaultFileName: `${diagramBaseName(payload)}.svg`,
	};
}

function renderDiagramLink(link: DiagramLink, theme: WebviewTheme): string {
	const iconSize = Math.min(52, Math.max(24, link.height - 52), Math.max(24, link.width - 24));
	const iconX = link.x + ((link.width - iconSize) / 2);
	const iconY = link.y + 12;
	const labelBounds = {
		x: link.x + 8,
		y: link.y + link.height - 38,
		width: Math.max(1, link.width - 16),
		height: 28,
	};
	return [
		`<image href="${escapeAttribute(link.icon ?? defaultDiagramLinkIcon)}" x="${numberValue(iconX)}" y="${numberValue(iconY)}" width="${numberValue(iconSize)}" height="${numberValue(iconSize)}" preserveAspectRatio="xMidYMid meet"/>`,
		renderTextBlock({
			id: link.id,
			text: diagramLinkName(link.diagram_ref),
			bounds: labelBounds,
			color: theme.editorForeground,
			fontFamily: theme.fontFamily,
			fontSize: theme.fontSize,
			bold: true,
			align: 'center',
			verticalAlign: 'middle',
			padding: 2,
			wrap: false,
			clip: true,
			limitLines: true,
		}),
	].join('\n');
}

function renderEdge(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): string {
	const points = edgeRoutePoints(edge);
	if (points.length < 2) {
		return '';
	}

	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	const lineStyle = edge.style?.line_style;
	const stroke = edgeStroke(edge, payload, theme);
	const dashArray = lineStyle === 'dotted'
		? ` stroke-dasharray="${numberValue(strokeWidth)} ${numberValue(strokeWidth * 3)}"`
		: lineStyle === 'dashed'
			? ` stroke-dasharray="${numberValue(strokeWidth * 4)} ${numberValue(strokeWidth * 3)}"`
			: '';
	const marker = lineStyle === 'none' || strokeWidth === 0
		? ''
		: isNoteConnection(edge)
			? ''
		: edge.ontology_item_type === 'subclassRelationship'
			? ` marker-end="url(#${edgeMarkerId(edge, 'hollow-triangle')})"`
			: ` marker-end="url(#${edgeMarkerId(edge, 'open-arrow')})"`;
	const label = isNoteConnection(edge) ? '' : edgeDisplayName(edge.ontology_ref, payload);
	const cardinalities = edgeCardinalityLabels(edge, payload);

	return [
		`<polyline points="${points.map((point) => `${numberValue(point.x)},${numberValue(point.y)}`).join(' ')}" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"${dashArray}${marker}/>`,
		label.length === 0 ? '' : renderEdgeLabel(edge, edge.id, label, edge.label, false, theme),
		renderEdgeCardinalityLabel(edge, 'source', cardinalities.source, edge.source_cardinality_label ?? defaultSourceCardinalityLabel(points), theme),
		renderEdgeCardinalityLabel(edge, 'target', cardinalities.target, edge.target_cardinality_label ?? defaultTargetCardinalityLabel(points), theme),
	].join('\n');
}

function renderEdgeLabel(
	edge: DiagramEdge,
	id: string,
	text: string,
	position: { readonly x: number; readonly y: number },
	cardinality: boolean,
	theme: WebviewTheme,
): string {
	const appearance = edgeLabelAppearance(edge, cardinality, theme);
	const bounds = centeredTextBounds({
		center: position,
		text,
		...appearance,
		minimumWidth: cardinality ? 28 : 80,
		minimumHeight: cardinality ? 20 : 24,
		padding: 2,
	});

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="3" fill="${escapeAttribute(theme.canvasBackground)}" fill-opacity="0.85"/>`,
		renderTextBlock({
			id,
			text,
			bounds,
			color: edge.style?.text_color ?? theme.edgeTextColor,
			...appearance,
			align: 'center',
			verticalAlign: 'middle',
			padding: 2,
			wrap: false,
			clip: false,
			limitLines: false,
		}),
	].join('\n');
}

function renderEdgeCardinalityLabel(
	edge: DiagramEdge,
	endpoint: 'source' | 'target',
	text: string | undefined,
	position: { readonly x: number; readonly y: number } | undefined,
	theme: WebviewTheme,
): string {
	if (text === undefined || position === undefined) {
		return '';
	}

	return renderEdgeLabel(edge, `${edge.id}_${endpoint}_cardinality`, text, position, true, theme);
}

function renderEdgeMarkerDefinitions(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): readonly string[] {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	if (edge.style?.line_style === 'none' || strokeWidth === 0) {
		return [];
	}
	if (isNoteConnection(edge)) {
		return [];
	}

	const stroke = edgeStroke(edge, payload, theme);
	if (edge.ontology_item_type === 'subclassRelationship') {
		return [
			`<marker id="${edgeMarkerId(edge, 'hollow-triangle')}" viewBox="0 0 12 10" refX="11" refY="5" markerWidth="10" markerHeight="10" orient="auto"><path d="M 1 1 L 11 5 L 1 9 Z" fill="${escapeAttribute(theme.canvasBackground)}" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
		];
	}

	return [
		`<marker id="${edgeMarkerId(edge, 'open-arrow')}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 1 1 L 9 5 L 1 9" fill="none" stroke="${escapeAttribute(stroke)}" stroke-width="${numberValue(strokeWidth)}"/></marker>`,
	];
}

function edgeStroke(edge: DiagramEdge, payload: DiagramPayload, theme: WebviewTheme): string {
	const strokeWidth = edge.style?.weight ?? theme.edgeWeight;
	return edge.style?.line_style === 'none' || strokeWidth === 0 ? 'none' : edge.style?.color ?? ontologyColor(edge.ontology_ref, payload, edge.ontology_item_type) ?? theme.edgeColor;
}

function edgeMarkerId(edge: DiagramEdge, marker: 'hollow-triangle' | 'open-arrow'): string {
	return `${marker}_${safeIdentifier(edge.id)}`;
}

function renderNode(node: DiagramNode, payload: DiagramPayload, theme: WebviewTheme, isContainer = false, containmentDepth?: number): string {
	const backgroundFallback = containmentDepth !== undefined
		? containmentColorAtDepth(theme.containmentBackgrounds, containmentDepth, theme.nodeBackground)
		: theme.nodeBackground;
	const borderFallback = containmentDepth !== undefined
		? containmentColorAtDepth(theme.containmentBorders, containmentDepth, theme.nodeBorder)
		: theme.nodeBorder;
	const border = borderStyle(
		node.style,
		ontologyColorMode(payload) === 'border'
			? ontologyColor(node.ontology_ref, payload, node.ontology_item_type) ?? borderFallback
			: borderFallback,
		1,
	);
	const backgroundColor = ontologyBackgroundColor(
		node.ontology_ref,
		payload,
		node.style?.bg_color ?? backgroundFallback,
		node.ontology_item_type,
	);
	const textColor = node.style?.text_color ?? readableTextColor(backgroundColor, theme.editorForeground);
	const ontologyLabel = nodeOntologyLabel(node.ontology_ref, payload);
	const fontFamily = node.style?.font?.family ?? theme.nodeFontFamily;
	const fontSize = node.style?.font?.size ?? theme.nodeFontSize;
	const fontBold = node.style?.font?.bold ?? theme.nodeFontBold;
	const fontItalic = node.style?.font?.italic ?? theme.nodeFontItalic;
	const bounds = elementBounds(node);
	if (isContainer) {
		const titleBounds = { x: bounds.x, y: bounds.y, width: bounds.width, height: containmentHeaderHeight };
		return [
			`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(node.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(backgroundColor)}" ${borderAttributes(border)}${shadowAttribute(node.style, theme.elementShadow)}/>`,
			renderTextBlock({
				id: node.id,
				text: nodeTitleDisplayText({ node, payload, width: Math.max(1, titleBounds.width - 20), height: Math.max(1, titleBounds.height - 8), fontSize, fontFamily, bold: fontBold, italic: fontItalic }),
				bounds: titleBounds,
				color: textColor,
				fontFamily,
				fontSize,
				bold: fontBold,
				italic: fontItalic,
				align: 'center',
				verticalAlign: 'middle',
				padding: 4,
				wrap: false,
				limitLines: false,
			}),
			`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y + containmentHeaderHeight)}" width="${numberValue(bounds.width)}" height="1" fill="${escapeAttribute(border.color)}"/>`,
		].join('\n');
	}
	if (hasNodeImage(node)) {
		const localImageBounds = nodeImageViewport(node);
		const imageBounds = { ...localImageBounds, x: bounds.x + localImageBounds.x, y: bounds.y + localImageBounds.y };
		const imagePresentation = nodeImagePresentation(node, { x: 0, y: 0, width: imageBounds.width, height: imageBounds.height });
		const titleBounds = { x: bounds.x, y: bounds.y + Math.max(0, bounds.height - 40), width: bounds.width, height: Math.min(32, bounds.height) };
		return [
			...(containmentDepth === undefined ? [] : [
				`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(node.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(backgroundColor)}" ${borderAttributes(border)}${shadowAttribute(node.style, theme.elementShadow)}/>`,
			]),
			`<svg x="${numberValue(imageBounds.x)}" y="${numberValue(imageBounds.y)}" width="${numberValue(imageBounds.width)}" height="${numberValue(imageBounds.height)}" overflow="hidden"><image href="${escapeAttribute(node.image)}" x="${numberValue(imagePresentation.bounds.x)}" y="${numberValue(imagePresentation.bounds.y)}" width="${numberValue(imagePresentation.bounds.width)}" height="${numberValue(imagePresentation.bounds.height)}" preserveAspectRatio="${imagePresentation.preserveAspectRatio}"/></svg>`,
			renderTextBlock({
				id: node.id,
				text: nodeTitleDisplayText({ node, payload, width: Math.max(1, titleBounds.width - 20), height: Math.max(1, titleBounds.height - 8), fontSize, fontFamily, bold: fontBold, italic: fontItalic }),
				bounds: titleBounds,
				color: textColor,
				fontFamily,
				fontSize,
				bold: fontBold,
				italic: fontItalic,
				align: 'center',
				verticalAlign: 'middle',
				padding: 4,
				wrap: false,
				limitLines: false,
			}),
		].join('\n');
	}
	const attributes = nodeCompartmentAttributes(node, payload);
	const hasAttributes = attributes.length > 0;
	const layout = nodeDataPropertyLayout({
		nodeHeight: bounds.height,
		fontSize,
		attributeCount: 0,
	});
	const allAttributeTexts = nodeAttributeTextLines({
		attributes,
		width: bounds.width - 20,
		fontSize: layout.attributeFontSize,
		fontFamily,
		italic: fontItalic,
		textOverflow: nodeAttributeTextOverflow(node),
	});
	const attributeLayout = nodeDataPropertyLayout({
		nodeHeight: bounds.height,
		fontSize,
		attributeCount: allAttributeTexts.length,
	});
	const displayAttributeTexts = visibleNodeAttributeTextLines(allAttributeTexts, attributeLayout.maximumAttributeLines);

	const ontologyLabelPart = ontologyLabel === undefined ? [] : [renderTextBlock({
		id: `${node.id}_ontology`,
		text: ontologyLabel,
		bounds: { x: bounds.x, y: bounds.y + 2, width: bounds.width, height: 16 },
		color: textColor,
		fontFamily,
		fontSize: Math.max(8, fontSize - 3),
		bold: false,
		italic: fontItalic,
		align: 'center',
		verticalAlign: 'middle',
		padding: 4,
	})];
	const titleBounds = ontologyLabel === undefined
		? hasAttributes ? { ...bounds, height: layout.headerHeight } : bounds
		: hasAttributes ? { ...bounds, y: bounds.y + 12, height: Math.max(1, layout.headerHeight - 12) } : { ...bounds, y: bounds.y + 12, height: Math.max(1, bounds.height - 12) };
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(node.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(backgroundColor)}" ${borderAttributes(border)}${shadowAttribute(node.style, theme.elementShadow)}/>`,
		...ontologyLabelPart,
		renderTextBlock({
			id: hasAttributes ? `${node.id}_title` : node.id,
			text: nodeTitleDisplayText({ node, payload, width: Math.max(1, titleBounds.width - 20), height: Math.max(1, titleBounds.height - 8), fontSize, fontFamily, bold: fontBold, italic: fontItalic }),
			bounds: titleBounds,
			color: textColor,
			fontFamily,
			fontSize,
			bold: fontBold,
			italic: fontItalic,
			align: 'center',
			verticalAlign: 'middle',
			padding: 4,
			wrap: false,
			limitLines: false,
		}),
	];

	if (hasAttributes) {
		parts.push(
			`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y + layout.headerHeight)}" width="${numberValue(bounds.width)}" height="1" fill="${escapeAttribute(border.color)}"/>`,
			renderTextBlock({
				id: `${node.id}_attributes`,
				text: displayAttributeTexts.join('\n'),
				bounds: {
					x: bounds.x,
					y: bounds.y + layout.headerHeight + 1,
					width: bounds.width,
					height: Math.max(1, bounds.height - layout.headerHeight - 1),
				},
				color: textColor,
				fontFamily,
				fontSize: attributeLayout.attributeFontSize,
				bold: false,
				italic: fontItalic,
				align: 'left',
				verticalAlign: 'top',
				padding: 10,
				lineHeight: attributeLayout.attributeLineHeight,
				wrap: false,
			}),
		);
	}

	return parts.join('\n');
}

function hasNodeImage(node: DiagramNode): node is DiagramNode & { readonly image: string } {
	return node.image !== undefined && node.image.trim() !== '';
}

function renderNote(note: DiagramNote, theme: WebviewTheme): string {
	const border = borderStyle(note.style, theme.noteBorder, 1);
	const bounds = elementBounds(note);
	const noteBackground = note.style?.bg_color ?? theme.noteBackground;

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(note.style, theme.noteCornerRadius))}" fill="${escapeAttribute(noteBackground)}" ${borderAttributes(border)}${shadowAttribute(note.style, theme.elementShadow)}/>`,
		renderNoteFold(bounds, border, noteBackground, theme),
		renderNoteHtmlBlock(note, bounds, theme),
	].join('\n');
}

function renderNoteHtmlBlock(note: DiagramNote, bounds: ExportBounds, theme: WebviewTheme): string {
	const padding = 12;
	const x = bounds.x + padding;
	const y = bounds.y + padding;
	const width = Math.max(1, bounds.width - (padding * 2));
	const height = Math.max(1, bounds.height - (padding * 2));
	const style = noteHtmlStyle({
		color: note.style?.text_color ?? theme.noteForeground,
		fontFamily: note.style?.font?.family ?? theme.fontFamily,
		fontSize: note.style?.font?.size ?? theme.fontSize,
		bold: note.style?.font?.bold,
		italic: note.style?.font?.italic,
	});

	return [
		`<foreignObject x="${numberValue(x)}" y="${numberValue(y)}" width="${numberValue(width)}" height="${numberValue(height)}">`,
		`<div xmlns="http://www.w3.org/1999/xhtml" class="note-html" style="${escapeAttribute(style)}">${sanitizedNoteHtml(note.text)}</div>`,
		'</foreignObject>',
	].join('\n');
}

function renderNoteFold(bounds: ExportBounds, border: { readonly color: string; readonly weight: number; readonly type: string | undefined }, noteBackground: string, theme: WebviewTheme): string {
	const size = Math.min(14, bounds.width, bounds.height);
	if (size <= 0) {
		return '';
	}

	const x = bounds.x + bounds.width;
	const y = bounds.y;
	const stroke = border.type === 'none' || border.weight === 0
		? 'none'
		: escapeAttribute(border.color);
	const strokeWidth = border.type === 'none' ? 0 : border.weight;

	return `<path d="M ${numberValue(x - size)} ${numberValue(y)} L ${numberValue(x)} ${numberValue(y)} L ${numberValue(x)} ${numberValue(y + size)} Z" fill="${escapeAttribute(noteFoldBackground(noteBackground, theme))}" stroke="${stroke}" stroke-width="${numberValue(strokeWidth)}"/>`;
}

function renderLabel(label: DiagramLabel, theme: WebviewTheme): string {
	return renderTextBlock({
		id: label.id,
		text: label.text,
		bounds: standaloneLabelExportBounds(label, theme),
		color: label.style?.text_color ?? theme.editorForeground,
		fontFamily: label.style?.font?.family ?? theme.fontFamily,
		fontSize: label.style?.font?.size ?? theme.fontSize,
		bold: label.style?.font?.bold,
		italic: label.style?.font?.italic,
		align: 'center',
		verticalAlign: 'middle',
		padding: 4,
		wrap: false,
		clip: false,
		limitLines: false,
	});
}

function renderMetadataElement(element: DiagramMetadataElement, payload: DiagramPayload, theme: WebviewTheme): string {
	const bounds = elementBounds(element);
	const border = borderStyle(element.style, theme.nodeBorder, 1);
	const rowHeight = bounds.height / 3;
	const keyWidth = Math.min(92, Math.max(68, bounds.width * 0.34));
	const fontFamily = element.style?.font?.family ?? theme.fontFamily;
	const fontSize = element.style?.font?.size ?? theme.fontSize;
	const metadata = payload.diagram?.metadata;
	const rows = [
		['Title', metadata?.title ?? ''],
		['Author', (metadata?.authors ?? []).join(', ')],
		['Version', metadata?.diagram_version ?? ''],
	] as const;
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(element.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(element.style?.bg_color ?? theme.nodeBackground)}" ${borderAttributes(border)}${shadowAttribute(element.style, theme.elementShadow)}/>`,
		`<path d="M ${numberValue(bounds.x + keyWidth)} ${numberValue(bounds.y)} V ${numberValue(bounds.y + bounds.height)} M ${numberValue(bounds.x)} ${numberValue(bounds.y + rowHeight)} H ${numberValue(bounds.x + bounds.width)} M ${numberValue(bounds.x)} ${numberValue(bounds.y + rowHeight * 2)} H ${numberValue(bounds.x + bounds.width)}" fill="none" ${borderAttributes(border)}/>`
	];
	rows.forEach((row, index) => {
		const y = bounds.y + rowHeight * index;
		parts.push(renderTextBlock({ id: `${element.id}_key${index}`, text: row[0], bounds: { x: bounds.x, y, width: keyWidth, height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: true, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 9 }));
		parts.push(renderTextBlock({ id: `${element.id}_value${index}`, text: row[1], bounds: { x: bounds.x + keyWidth, y, width: bounds.width - keyWidth, height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: element.style?.font?.bold, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 9 }));
	});
	return parts.join('\n');
}

function renderLegendElement(element: DiagramLegendElement, payload: DiagramPayload, theme: WebviewTheme): string {
	const bounds = elementBounds(element);
	const border = borderStyle(element.style, theme.nodeBorder, 1);
	const fontFamily = element.style?.font?.family ?? theme.fontFamily;
	const fontSize = element.style?.font?.size ?? theme.fontSize;
	const entries = ontologyLegendEntries(payload);
	const rowHeight = Math.max(22, (bounds.height - 28) / Math.max(1, entries.length));
	const parts = [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" rx="${numberValue(cornerRadius(element.style, theme.nodeCornerRadius))}" fill="${escapeAttribute(element.style?.bg_color ?? theme.nodeBackground)}" ${borderAttributes(border)}${shadowAttribute(element.style, theme.elementShadow)}/>`,
		renderTextBlock({ id: `${element.id}_title`, text: 'Color legend', bounds: { x: bounds.x, y: bounds.y, width: bounds.width, height: 28 }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: true, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 10 }),
	];
	entries.forEach((entry, index) => {
		const y = bounds.y + 28 + rowHeight * index;
		parts.push(`<rect x="${numberValue(bounds.x + 10)}" y="${numberValue(y + 4)}" width="14" height="14" rx="2" fill="${escapeAttribute(element.colors[entry.key] ?? theme.nodeBorder)}"/>`);
		parts.push(renderTextBlock({ id: `${element.id}_${index}`, text: entry.label, bounds: { x: bounds.x + 28, y, width: Math.max(1, bounds.width - 36), height: rowHeight }, color: element.style?.text_color ?? theme.editorForeground, fontFamily, fontSize, bold: element.style?.font?.bold, italic: element.style?.font?.italic, align: 'left', verticalAlign: 'middle', padding: 4 }));
	});
	return parts.join('\n');
}

function renderImage(image: DiagramImage, theme: WebviewTheme): string {
	const bounds = elementBounds(image);
	const border = borderStyle(image.style, theme.nodeBorder, 0);

	return [
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" fill="${escapeAttribute(theme.canvasBackground)}"${shadowAttribute(image.style, false)}/>`,
		`<image href="${escapeAttribute(image.source)}" x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" preserveAspectRatio="xMidYMid meet"/>`,
		`<rect x="${numberValue(bounds.x)}" y="${numberValue(bounds.y)}" width="${numberValue(bounds.width)}" height="${numberValue(bounds.height)}" fill="none" ${borderAttributes(border)}/>`,
	].join('\n');
}

function renderTextBlock(options: TextBlockOptions): string {
	const contentWidth = Math.max(1, options.bounds.width - (options.padding * 2));
	const contentHeight = Math.max(1, options.bounds.height - (options.padding * 2));
	const lineHeight = options.lineHeight ?? options.fontSize * 1.25;
	const lines = options.wrap === false ? explicitLines(options.text) : wrapLines(options.text, contentWidth, options.fontSize);
	const maxLines = Math.max(1, Math.floor(contentHeight / lineHeight));
	const visibleLines = options.limitLines === false ? lines : lines.slice(0, maxLines);
	const textX = options.align === 'center' ? options.bounds.x + (options.bounds.width / 2) : options.bounds.x + options.padding;
	const textAnchor = options.align === 'center' ? 'middle' : 'start';
	const textY = options.verticalAlign === 'middle'
		? options.bounds.y + ((options.bounds.height - ((visibleLines.length - 1) * lineHeight)) / 2)
		: options.bounds.y + options.padding + options.fontSize;
	const clipId = `clip_${safeIdentifier(options.id)}`;
	const clipDefinition = options.clip === false ? [] : [
		'<defs>',
		`<clipPath id="${clipId}"><rect x="${numberValue(options.bounds.x)}" y="${numberValue(options.bounds.y)}" width="${numberValue(options.bounds.width)}" height="${numberValue(options.bounds.height)}"/></clipPath>`,
		'</defs>',
	];
	const clipAttribute = options.clip === false ? '' : ` clip-path="url(#${clipId})"`;
	const verticalAnchorAttribute = options.verticalAlign === 'middle' ? ' dominant-baseline="central"' : '';

	return [
		...clipDefinition,
		`<text${clipAttribute} x="${numberValue(textX)}" y="${numberValue(textY)}" fill="${escapeAttribute(options.color)}" font-family="${escapeAttribute(options.fontFamily)}" font-size="${numberValue(options.fontSize)}" font-weight="${options.bold === true ? '700' : '400'}" font-style="${options.italic === true ? 'italic' : 'normal'}" text-anchor="${textAnchor}"${verticalAnchorAttribute}>`,
		...visibleLines.map((line, index) => {
			const dy = index === 0 ? 0 : lineHeight;
			return `<tspan x="${numberValue(textX)}" dy="${numberValue(dy)}">${escapeHtml(line)}</tspan>`;
		}),
		'</text>',
	].join('\n');
}

function borderStyle(style: DiagramElementStyle | undefined, fallbackColor: string, fallbackWeight: number): {
	readonly color: string;
	readonly weight: number;
	readonly type: string | undefined;
} {
	return {
		color: style?.border?.color ?? fallbackColor,
		weight: style?.border?.weight ?? fallbackWeight,
		type: style?.border?.type,
	};
}

function borderAttributes(border: { readonly color: string; readonly weight: number; readonly type: string | undefined }): string {
	if (border.type === 'none' || border.weight === 0) {
		return 'stroke="none" stroke-width="0"';
	}

	const dashArray = border.type === 'dotted'
		? ` stroke-dasharray="${numberValue(border.weight)} ${numberValue(border.weight * 3)}"`
		: border.type === 'dashed'
			? ` stroke-dasharray="${numberValue(border.weight * 4)} ${numberValue(border.weight * 3)}"`
			: '';

	return `stroke="${escapeAttribute(border.color)}" stroke-width="${numberValue(border.weight)}"${dashArray}`;
}

function cornerRadius(style: DiagramElementStyle | undefined, fallback: number): number {
	return elementCornerRadius(style, fallback);
}

function shadowAttribute(style: DiagramElementStyle | undefined, fallback: boolean): string {
	return (style?.shadow ?? fallback) ? ' filter="url(#shadow)"' : '';
}

function plainText(value: string): string {
	return plainPresentationText(value);
}

function diagramBaseName(payload: DiagramPayload): string {
	const filePath = payload.file?.fsPath;
	const fileName = filePath?.split(/[\\/]/u).pop() ?? payload.diagram?.metadata?.title ?? 'ontology-diagram';
	const withoutExtension = fileName.replace(/\.odiagram$/iu, '');
	const safeName = withoutExtension.replace(/[^A-Za-z0-9._-]+/gu, '-').replace(/^-+|-+$/gu, '');

	return safeName.length > 0 ? safeName : 'ontology-diagram';
}

function safeIdentifier(value: string): string {
	return value.replace(/[^A-Za-z0-9_-]/gu, '_');
}

function numberValue(value: number): string {
	return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/\.?0+$/u, '');
}

function escapeAttribute(value: string): string {
	return escapeHtml(value).replaceAll('"', '&quot;');
}
