import { z } from 'zod';

import {
	BorderStyle,
	CommonStyle,
	EdgeStyle,
	FontStyle,
	JsonObject,
	JsonValue,
	LabelStyle,
	OntologyDiagramValidationError,
} from '../odiagram';

export class OntologyDiagramThemeValidationError extends Error {
	public constructor(message: string, public readonly issues: readonly string[] = [message]) {
		super(message);
		this.name = 'OntologyDiagramThemeValidationError';
	}
}

export class OntologyDiagramTheme {
	public constructor(
		public readonly nodes?: CommonStyle,
		public readonly edges?: EdgeStyle,
		public readonly notes?: CommonStyle,
		public readonly labels?: LabelStyle,
		public readonly themeExtra: JsonObject = {},
		public readonly extra: JsonObject = {},
	) {
		validateThemeColors(this);
	}

	public toPersistenceObject(): JsonObject {
		return {
			...this.extra,
			theme: omitUndefined({
				...this.themeExtra,
				nodes: this.nodes?.toPersistenceObject(),
				edges: this.edges?.toPersistenceObject(),
				notes: this.notes?.toPersistenceObject(),
				labels: this.labels?.toPersistenceObject(),
			}),
		};
	}
}

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);

const fontStyleSchema = z.object({
	family: z.string().optional(),
	bold: z.boolean().optional(),
	italic: z.boolean().optional(),
	size: z.number().optional(),
}).passthrough();

const borderStyleSchema = z.object({
	type: z.enum(['solid', 'dashed', 'dotted', 'none']).optional(),
	weight: z.number().optional(),
	color: z.string().optional(),
}).passthrough();

const commonStyleSchema = z.object({
	bg_color: z.string().optional(),
	text_color: z.string().optional(),
	font: fontStyleSchema.optional(),
	border: borderStyleSchema.optional(),
}).passthrough();

const edgeStyleSchema = z.object({
	color: z.string().optional(),
	line_style: z.enum(['solid', 'dashed', 'dotted', 'none']).optional(),
	weight: z.number().optional(),
	text_color: z.string().optional(),
	font: fontStyleSchema.optional(),
}).passthrough();

const labelStyleSchema = z.object({
	text_color: z.string().optional(),
	font: fontStyleSchema.optional(),
}).passthrough();

const themeDefinitionSchema = z.object({
	nodes: commonStyleSchema.optional(),
	edges: edgeStyleSchema.optional(),
	notes: commonStyleSchema.optional(),
	labels: labelStyleSchema.optional(),
}).passthrough();

const themeDocumentSchema = z.object({
	theme: themeDefinitionSchema,
}).passthrough();

export function parseOntologyDiagramThemeObject(value: unknown): OntologyDiagramTheme {
	const parsed = themeDocumentSchema.safeParse(value);
	if (!parsed.success) {
		throw new OntologyDiagramThemeValidationError(
			'Invalid .otheme document.',
			parsed.error.issues.map((issue) => issue.message),
		);
	}

	const document = parsed.data;
	try {
		return new OntologyDiagramTheme(
			document.theme.nodes ? parseCommonStyle(document.theme.nodes) : undefined,
			document.theme.edges ? parseEdgeStyle(document.theme.edges) : undefined,
			document.theme.notes ? parseCommonStyle(document.theme.notes) : undefined,
			document.theme.labels ? parseLabelStyle(document.theme.labels) : undefined,
			getExtraFields(document.theme, ['nodes', 'edges', 'notes', 'labels']),
			getExtraFields(document, ['theme']),
		);
	} catch (error) {
		if (error instanceof OntologyDiagramValidationError) {
			throw new OntologyDiagramThemeValidationError('Invalid .otheme document.', error.issues);
		}
		throw error;
	}
}

function parseCommonStyle(value: z.infer<typeof commonStyleSchema>): CommonStyle {
	return new CommonStyle(
		value.bg_color,
		value.text_color,
		value.font ? parseFontStyle(value.font) : undefined,
		value.border ? parseBorderStyle(value.border) : undefined,
		getExtraFields(value, ['bg_color', 'text_color', 'font', 'border']),
	);
}

function parseEdgeStyle(value: z.infer<typeof edgeStyleSchema>): EdgeStyle {
	return new EdgeStyle(
		value.color,
		value.line_style,
		value.weight,
		value.text_color,
		value.font ? parseFontStyle(value.font) : undefined,
		getExtraFields(value, ['color', 'line_style', 'weight', 'text_color', 'font']),
	);
}

function parseLabelStyle(value: z.infer<typeof labelStyleSchema>): LabelStyle {
	return new LabelStyle(
		value.text_color,
		value.font ? parseFontStyle(value.font) : undefined,
		getExtraFields(value, ['text_color', 'font']),
	);
}

function parseFontStyle(value: z.infer<typeof fontStyleSchema>): FontStyle {
	return new FontStyle(value.family, value.bold, value.italic, value.size, getExtraFields(value, ['family', 'bold', 'italic', 'size']));
}

function parseBorderStyle(value: z.infer<typeof borderStyleSchema>): BorderStyle {
	return new BorderStyle(value.type, value.weight, value.color, getExtraFields(value, ['type', 'weight', 'color']));
}

function validateThemeColors(theme: OntologyDiagramTheme): void {
	const issues = [
		...validateCommonStyleColors('theme.nodes', theme.nodes),
		...validateEdgeStyleColors(theme.edges),
		...validateCommonStyleColors('theme.notes', theme.notes),
		...validateColorField('theme.labels.text_color', theme.labels?.textColor),
	];

	if (issues.length > 0) {
		throw new OntologyDiagramThemeValidationError('Invalid .otheme document.', issues);
	}
}

function validateCommonStyleColors(path: string, style: CommonStyle | undefined): string[] {
	return [
		...validateColorField(`${path}.bg_color`, style?.bgColor),
		...validateColorField(`${path}.text_color`, style?.textColor),
		...validateColorField(`${path}.border.color`, style?.border?.color),
	];
}

function validateEdgeStyleColors(style: EdgeStyle | undefined): string[] {
	return [
		...validateColorField('theme.edges.color', style?.color),
		...validateColorField('theme.edges.text_color', style?.textColor),
	];
}

function validateColorField(path: string, value: string | undefined): string[] {
	if (value === undefined || isParseableCssColor(value)) {
		return [];
	}

	return [`${path} must be a parseable CSS color string.`];
}

function isParseableCssColor(value: string): boolean {
	const normalized = value.trim().toLowerCase();
	return isHexColor(normalized) || isRgbColor(normalized) || cssColorKeywords.has(normalized);
}

function isHexColor(value: string): boolean {
	return /^#[0-9a-f]{6}([0-9a-f]{2})?$/u.test(value);
}

function isRgbColor(value: string): boolean {
	const match = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/u.exec(value);
	if (!match) {
		return false;
	}

	const channels = [Number(match[1]), Number(match[2]), Number(match[3])];
	return channels.every((channel) => channel >= 0 && channel <= 255);
}

const cssColorKeywords = new Set([
	'aliceblue',
	'antiquewhite',
	'aqua',
	'aquamarine',
	'azure',
	'beige',
	'bisque',
	'black',
	'blanchedalmond',
	'blue',
	'blueviolet',
	'brown',
	'burlywood',
	'cadetblue',
	'chartreuse',
	'chocolate',
	'coral',
	'cornflowerblue',
	'cornsilk',
	'crimson',
	'cyan',
	'darkblue',
	'darkcyan',
	'darkgoldenrod',
	'darkgray',
	'darkgreen',
	'darkgrey',
	'darkkhaki',
	'darkmagenta',
	'darkolivegreen',
	'darkorange',
	'darkorchid',
	'darkred',
	'darksalmon',
	'darkseagreen',
	'darkslateblue',
	'darkslategray',
	'darkslategrey',
	'darkturquoise',
	'darkviolet',
	'deeppink',
	'deepskyblue',
	'dimgray',
	'dimgrey',
	'dodgerblue',
	'firebrick',
	'floralwhite',
	'forestgreen',
	'fuchsia',
	'gainsboro',
	'ghostwhite',
	'gold',
	'goldenrod',
	'gray',
	'green',
	'greenyellow',
	'grey',
	'honeydew',
	'hotpink',
	'indianred',
	'indigo',
	'ivory',
	'khaki',
	'lavender',
	'lavenderblush',
	'lawngreen',
	'lemonchiffon',
	'lightblue',
	'lightcoral',
	'lightcyan',
	'lightgoldenrodyellow',
	'lightgray',
	'lightgreen',
	'lightgrey',
	'lightpink',
	'lightsalmon',
	'lightseagreen',
	'lightskyblue',
	'lightslategray',
	'lightslategrey',
	'lightsteelblue',
	'lightyellow',
	'lime',
	'limegreen',
	'linen',
	'magenta',
	'maroon',
	'mediumaquamarine',
	'mediumblue',
	'mediumorchid',
	'mediumpurple',
	'mediumseagreen',
	'mediumslateblue',
	'mediumspringgreen',
	'mediumturquoise',
	'mediumvioletred',
	'midnightblue',
	'mintcream',
	'mistyrose',
	'moccasin',
	'navajowhite',
	'navy',
	'oldlace',
	'olive',
	'olivedrab',
	'orange',
	'orangered',
	'orchid',
	'palegoldenrod',
	'palegreen',
	'paleturquoise',
	'palevioletred',
	'papayawhip',
	'peachpuff',
	'peru',
	'pink',
	'plum',
	'powderblue',
	'purple',
	'rebeccapurple',
	'red',
	'rosybrown',
	'royalblue',
	'saddlebrown',
	'salmon',
	'sandybrown',
	'seagreen',
	'seashell',
	'sienna',
	'silver',
	'skyblue',
	'slateblue',
	'slategray',
	'slategrey',
	'snow',
	'springgreen',
	'steelblue',
	'tan',
	'teal',
	'thistle',
	'tomato',
	'transparent',
	'turquoise',
	'violet',
	'wheat',
	'white',
	'whitesmoke',
	'yellow',
	'yellowgreen',
]);

function getExtraFields(value: Record<string, unknown>, knownFields: readonly string[]): JsonObject {
	const known = new Set(knownFields);
	const extra: JsonObject = {};

	for (const [key, fieldValue] of Object.entries(value)) {
		if (!known.has(key) && isJsonValue(fieldValue)) {
			extra[key] = fieldValue;
		}
	}

	return extra;
}

function isJsonValue(value: unknown): value is JsonValue {
	return jsonValueSchema.safeParse(value).success;
}

function omitUndefined(value: Record<string, JsonValue | undefined>): JsonObject {
	const result: JsonObject = {};
	for (const [key, fieldValue] of Object.entries(value)) {
		if (fieldValue !== undefined) {
			result[key] = fieldValue;
		}
	}
	return result;
}
