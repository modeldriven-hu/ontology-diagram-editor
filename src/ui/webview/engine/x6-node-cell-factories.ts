import { nodeImageInset, nodeImageReservedHeight } from '../../../shared/canvas-geometry';
import { containmentHeaderHeight } from '../../../shared/diagram-containment';
import { nodeAttributeTextLines, nodeAttributeTextOverflow, nodeCompartmentAttributes, nodeDataPropertyLayout, nodeTitleDisplayText, visibleNodeAttributeTextLines } from '../components/node-data-properties';
import { nodeOntologyLabel, ontologyBackgroundColor, ontologyColor, ontologyColorMode, ontologyLegendEntries, readableTextColor } from '../components/ontology-legend';
import type { DiagramLegendElement, DiagramMetadataElement, DiagramNode, DiagramPayload } from '../ontology-diagram-types';
import { containmentColorAtDepth, type WebviewTheme } from '../webview-theme';
import { borderAttrs, cornerRadius, shadowFilter } from './x6-element-appearance';
import { imagePreserveAspectRatio } from '../components/presentation/diagram-presentation';

export function x6OntologyNode(
	node: DiagramNode,
	payload: DiagramPayload,
	theme: WebviewTheme,
	containment: {
		readonly parentNodeId?: string;
		readonly childNodeIds: readonly string[];
		readonly depth: number;
		readonly isContainer: boolean;
	},
): Record<string, unknown> {
	const radius = cornerRadius(node.style, theme.nodeCornerRadius);
	const containmentDepth = containment.isContainer || containment.parentNodeId !== undefined ? containment.depth : undefined;
	const presentation = x6OntologyNodePresentation(node, payload, theme, containment.isContainer, containmentDepth);

	return {
		id: node.id,
		...(containment.parentNodeId === undefined ? {} : { parent: containment.parentNodeId }),
		...(containment.childNodeIds.length === 0 ? {} : { children: [...containment.childNodeIds] }),
		x: node.x,
		y: node.y,
		width: node.width,
		height: node.height,
		markup: x6OntologyNodeMarkup(presentation.markup),
		attrs: {
			body: x6OntologyNodeBodyAttrs(node, payload, theme, radius, containmentDepth),
			nodeImage: containment.isContainer
				? { opacity: 0, pointerEvents: 'none' }
				: x6OntologyNodeImageAttrs(node, presentation.hasAttributes),
			...presentation.attrs,
		},
		zIndex: 20 + containment.depth,
	};
}

export function hasNodeImage(node: DiagramNode): boolean {
	return node.image !== undefined && node.image.trim() !== '';
}

export function x6OntologyNodeBodyAttrs(
	node: DiagramNode,
	payload: DiagramPayload,
	theme: WebviewTheme,
	radius: number,
	containmentDepth?: number,
): Record<string, unknown> {
	if (containmentDepth === undefined && hasNodeImage(node)) {
		return {
			refWidth: '100%',
			refHeight: '100%',
			rx: radius,
			ry: radius,
			fill: 'transparent',
			stroke: 'none',
			strokeWidth: 0,
			filter: 'none',
		};
	}

	const ontologyColorValue = ontologyColor(node.ontology_ref, payload, node.ontology_item_type);
	const colorMode = ontologyColorMode(payload);
	const backgroundFallback = containmentDepth === undefined
		? theme.nodeBackground
		: containmentColorAtDepth(theme.containmentBackgrounds, containmentDepth, theme.nodeBackground);
	const borderFallback = containmentDepth === undefined
		? theme.nodeBorder
		: containmentColorAtDepth(theme.containmentBorders, containmentDepth, theme.nodeBorder);
	return {
		refWidth: '100%',
		refHeight: '100%',
		rx: radius,
		ry: radius,
		fill: ontologyBackgroundColor(node.ontology_ref, payload, node.style?.bg_color ?? backgroundFallback, node.ontology_item_type),
		...borderAttrs(node.style?.border, colorMode === 'border' ? ontologyColorValue ?? borderFallback : borderFallback, 1),
		filter: shadowFilter(node.style, theme.elementShadow, theme),
	};
}

export function x6OntologyNodeImageAttrs(node: DiagramNode, hasAttributes: boolean): Record<string, unknown> {
	const hasImage = hasNodeImage(node);
	if (hasImage) {
		return {
			x: nodeImageInset,
			y: nodeImageInset,
			width: Math.max(0, node.width - (nodeImageInset * 2)),
			height: Math.max(0, node.height - nodeImageReservedHeight),
			'xlink:href': node.image,
			preserveAspectRatio: imagePreserveAspectRatio(node),
			pointerEvents: 'none',
			opacity: 1,
		};
	}

	return hasAttributes
		? {
			width: 18,
			height: 18,
			refX: 8,
			refY: 6,
			'xlink:href': node.image ?? '',
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: 0,
		}
		: {
			width: 28,
			height: 28,
			refX: '50%',
			refX2: -14,
			refY: 10,
			'xlink:href': node.image ?? '',
			preserveAspectRatio: 'xMidYMid meet',
			pointerEvents: 'none',
			opacity: 0,
		};
}

export function x6MetadataElement(element: DiagramMetadataElement, payload: DiagramPayload, theme: WebviewTheme): Record<string, unknown> {
	const style = element.style;
	const fontSize = style?.font?.size ?? theme.fontSize;
	const fontFamily = style?.font?.family ?? theme.fontFamily;
	const textColor = style?.text_color ?? theme.editorForeground;
	const rowHeight = element.height / 3;
	const keyWidth = Math.min(92, Math.max(68, element.width * 0.34));
	const textAttrs = {
		fill: textColor,
		fontFamily,
		fontSize,
		fontWeight: style?.font?.bold === true ? 700 : 400,
		fontStyle: style?.font?.italic === true ? 'italic' : 'normal',
		textAnchor: 'start',
		textVerticalAnchor: 'middle',
		pointerEvents: 'none',
	};
	const metadata = payload.diagram?.metadata;
	const rows = [
		['Title', metadata?.title ?? ''],
		['Author', (metadata?.authors ?? []).join(', ')],
		['Version', metadata?.diagram_version ?? ''],
	] as const;
	const markup: Record<string, string>[] = [{ tagName: 'rect', selector: 'body' }, { tagName: 'path', selector: 'grid' }];
	for (let index = 0; index < rows.length; index += 1) {
		markup.push({ tagName: 'text', selector: `key${index}` }, { tagName: 'text', selector: `value${index}` });
	}
	return {
		id: element.id,
		x: element.x,
		y: element.y,
		width: element.width,
		height: element.height,
		markup,
		attrs: {
			body: {
				refWidth: '100%', refHeight: '100%', rx: cornerRadius(style, theme.nodeCornerRadius), ry: cornerRadius(style, theme.nodeCornerRadius),
				fill: style?.bg_color ?? theme.nodeBackground,
				...borderAttrs(style?.border, theme.nodeBorder, 1),
				filter: shadowFilter(style, theme.elementShadow, theme),
			},
			grid: {
				d: `M ${keyWidth} 0 V ${element.height} M 0 ${rowHeight} H ${element.width} M 0 ${rowHeight * 2} H ${element.width}`,
				...borderAttrs(style?.border, theme.nodeBorder, 1),
				fill: 'none',
				pointerEvents: 'none',
			},
			...Object.fromEntries(rows.flatMap((row, index) => [
				[`key${index}`, { ...textAttrs, text: row[0], refX: 9, refY: rowHeight * (index + 0.5), fontWeight: 600 }],
				[`value${index}`, { ...textAttrs, text: row[1], refX: keyWidth + 9, refY: rowHeight * (index + 0.5) }],
			])),
		},
		zIndex: 20,
	};
}

export function x6LegendElement(element: DiagramLegendElement, payload: DiagramPayload, theme: WebviewTheme): Record<string, unknown> {
	const style = element.style;
	const rows = ontologyLegendEntries(payload);
	const rowHeight = Math.max(22, (element.height - 28) / Math.max(1, rows.length));
	const markup: Record<string, string>[] = [{ tagName: 'rect', selector: 'body' }, { tagName: 'text', selector: 'title' }];
	for (let index = 0; index < rows.length; index += 1) {markup.push({ tagName: 'rect', selector: `swatch${index}` }, { tagName: 'text', selector: `label${index}` });}
	return {
		id: element.id, x: element.x, y: element.y, width: element.width, height: element.height, markup,
		attrs: {
			body: { refWidth: '100%', refHeight: '100%', rx: cornerRadius(style, theme.nodeCornerRadius), ry: cornerRadius(style, theme.nodeCornerRadius), fill: style?.bg_color ?? theme.nodeBackground, ...borderAttrs(style?.border, theme.nodeBorder, 1), filter: shadowFilter(style, theme.elementShadow, theme) },
			title: { text: 'Color legend', refX: 10, refY: 16, fill: style?.text_color ?? theme.editorForeground, fontFamily: style?.font?.family ?? theme.fontFamily, fontSize: style?.font?.size ?? theme.fontSize, fontWeight: 700, textAnchor: 'start', textVerticalAnchor: 'middle', pointerEvents: 'none' },
			...Object.fromEntries(rows.flatMap((entry, index) => {
				const y = 28 + rowHeight * index;
				return [[`swatch${index}`, { x: 10, y: y + 4, width: 14, height: 14, rx: 2, ry: 2, fill: element.colors[entry.key] ?? theme.nodeBorder, pointerEvents: 'none' }], [`label${index}`, { text: entry.label, refX: 32, refY: y + 11, fill: style?.text_color ?? theme.editorForeground, fontFamily: style?.font?.family ?? theme.fontFamily, fontSize: style?.font?.size ?? theme.fontSize, textAnchor: 'start', textVerticalAnchor: 'middle', pointerEvents: 'none' }]];
			})),
		}, zIndex: 20,
	};
}

export function x6OntologyNodePresentation(
	node: DiagramNode,
	payload: DiagramPayload,
	theme: WebviewTheme,
	isContainer = false,
	containmentDepth?: number,
): {
	readonly hasAttributes: boolean;
	readonly markup: readonly Record<string, string>[];
	readonly attrs: Record<string, unknown>;
} {
	const hasImage = hasNodeImage(node);
	const fontFamily = node.style?.font?.family ?? theme.nodeFontFamily;
	const fontSize = node.style?.font?.size ?? theme.nodeFontSize;
	const fontBold = node.style?.font?.bold ?? theme.nodeFontBold;
	const fontItalic = node.style?.font?.italic ?? theme.nodeFontItalic;
	const backgroundColor = ontologyBackgroundColor(
		node.ontology_ref,
		payload,
		node.style?.bg_color ?? (containmentDepth === undefined
			? theme.nodeBackground
			: containmentColorAtDepth(theme.containmentBackgrounds, containmentDepth, theme.nodeBackground)),
		node.ontology_item_type,
	);
	const textColor = node.style?.text_color ?? readableTextColor(backgroundColor, theme.editorForeground);
	if (isContainer) {
		return {
			hasAttributes: false,
			markup: [{ tagName: 'rect', selector: 'containmentSeparator' }],
			attrs: {
				label: {
					text: nodeTitleDisplayText({ node, payload, width: Math.max(0, node.width - 20), height: Math.max(1, containmentHeaderHeight - 8), fontSize, fontFamily, bold: fontBold, italic: fontItalic }),
					fill: textColor,
					fontFamily,
					fontSize,
					fontWeight: fontBold === true ? 700 : 400,
					fontStyle: fontItalic === true ? 'italic' : 'normal',
					textAnchor: 'middle',
					textVerticalAnchor: 'middle',
					refX: '50%',
					refY: containmentHeaderHeight / 2,
					pointerEvents: 'none',
				},
				containmentSeparator: {
					refWidth: '100%',
					height: 1,
					refY: containmentHeaderHeight,
					fill: node.style?.border?.color ?? theme.nodeBorder,
					pointerEvents: 'none',
				},
			},
		};
	}
	if (hasImage) {
		return {
			hasAttributes: false,
			markup: [],
			attrs: {
				label: {
					text: nodeTitleDisplayText({ node, payload, width: Math.max(0, node.width - 20), height: Math.max(1, Math.min(32, node.height) - 8), fontSize, fontFamily, bold: fontBold, italic: fontItalic }),
					fill: textColor,
					fontFamily,
					fontSize,
					fontWeight: fontBold === true ? 700 : 400,
					fontStyle: fontItalic === true ? 'italic' : 'normal',
					textAnchor: 'middle',
					textVerticalAnchor: 'middle',
					refX: '50%',
					refY: Math.max(0, node.height - 24),
				},
			},
		};
	}
	const attributes = nodeCompartmentAttributes(node, payload);
	const hasAttributes = attributes.length > 0;
	const ontologyLabel = nodeOntologyLabel(node.ontology_ref, payload);
	const showsOntologyLabel = ontologyLabel !== undefined;
	const layout = nodeDataPropertyLayout({
		nodeHeight: node.height,
		fontSize,
		attributeCount: 0,
	});
	const allAttributeTexts = nodeAttributeTextLines({
		attributes,
		width: node.width - 20,
		fontSize: layout.attributeFontSize,
		fontFamily,
		italic: fontItalic,
		textOverflow: nodeAttributeTextOverflow(node),
	});
	const attributeLayout = nodeDataPropertyLayout({
		nodeHeight: node.height,
		fontSize,
		attributeCount: allAttributeTexts.length,
	});
	const displayAttributeTexts = visibleNodeAttributeTextLines(allAttributeTexts, attributeLayout.maximumAttributeLines);
	const titleWidth = Math.max(0, node.width - (hasImage && hasAttributes ? 56 : 20));
	const title = nodeTitleDisplayText({
		node,
		payload,
		width: titleWidth,
		height: Math.max(1, (hasAttributes ? layout.headerHeight : node.height) - (showsOntologyLabel ? 12 : 0) - 8),
		fontSize,
		fontFamily,
		bold: fontBold,
		italic: fontItalic,
	});
	const attributeLineCount = hasAttributes ? displayAttributeTexts.length : 0;
	const attributeAttrs = Object.fromEntries([...Array(attributeLineCount).keys()].map((index) => [
		`attribute${index}`,
		{
			text: displayAttributeTexts[index] ?? '',
			opacity: displayAttributeTexts[index] === undefined ? 0 : 1,
			fill: textColor,
			fontFamily,
			fontSize: attributeLayout.attributeFontSize,
			fontWeight: 400,
			fontStyle: fontItalic === true ? 'italic' : 'normal',
			textAnchor: 'start',
			textVerticalAnchor: 'middle',
			refX: 10,
			refY: attributeLayout.headerHeight + 12 + (index * attributeLayout.attributeLineHeight),
		},
	]));

	return {
		hasAttributes,
		markup: [
			...(showsOntologyLabel ? [{ tagName: 'text', selector: 'ontologyLabel' }] : []),
			...(hasAttributes ? [{ tagName: 'rect', selector: 'separator' }] : []),
			...[...Array(attributeLineCount).keys()].map((index) => ({ tagName: 'text', selector: `attribute${index}` })),
		],
		attrs: {
			...(showsOntologyLabel ? {
				ontologyLabel: {
					text: ontologyLabel,
					fill: textColor,
					opacity: 0.78,
					fontFamily,
					fontSize: Math.max(8, fontSize - 3),
					textAnchor: 'middle',
					textVerticalAnchor: 'middle',
					refX: '50%',
					refY: 10,
					pointerEvents: 'none',
				},
			} : {}),
			label: {
				text: title,
				fill: textColor,
				fontFamily,
				fontSize,
				fontWeight: fontBold === true ? 700 : 400,
				fontStyle: fontItalic === true ? 'italic' : 'normal',
				textAnchor: 'middle',
				textVerticalAnchor: 'middle',
				refX: '50%',
				refY: showsOntologyLabel ? (hasAttributes ? Math.max(21, layout.headerHeight - 10) : '62%') : hasAttributes ? layout.headerHeight / 2 : hasImage ? '68%' : '50%',
			},
			...(hasAttributes ? {
				separator: {
					refWidth: '100%',
					height: 1,
					refY: layout.headerHeight,
				fill: node.style?.border?.color ?? (ontologyColorMode(payload) === 'border' ? ontologyColor(node.ontology_ref, payload, node.ontology_item_type) ?? theme.nodeBorder : theme.nodeBorder),
					pointerEvents: 'none',
				},
			} : {}),
			...attributeAttrs,
		},
	};
}

export function x6OntologyNodeMarkup(presentationMarkup: readonly Record<string, string>[]): readonly Record<string, string>[] {
	return [
		{ tagName: 'rect', selector: 'body' },
		{ tagName: 'image', selector: 'nodeImage' },
		{ tagName: 'text', selector: 'label' },
		...presentationMarkup,
	];
}

