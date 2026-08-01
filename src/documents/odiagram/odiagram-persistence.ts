import { z } from 'zod';
import { BorderStyle, Bounds, CommonStyle, DiagramEdge, DiagramImage, DiagramLabel, DiagramLegendElement, DiagramMetadata, DiagramMetadataElement, DiagramNode, DiagramNote, EdgeStyle, FontStyle, LabelStyle, OntologyDiagramDocument, OntologyDiagramValidationError, OntologyFileReference, Point, type JsonObject, type JsonValue } from './odiagram-model';

const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(jsonValueSchema), z.record(z.string(), jsonValueSchema)]),
);
const jsonObjectSchema = z.record(z.string(), jsonValueSchema);

const pointSchema = z.object({
	x: z.number(),
	y: z.number(),
}).passthrough();

const boundsFieldsSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number(),
	height: z.number(),
}).passthrough();

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
	corner_radius: z.number().optional(),
	shadow: z.boolean().optional(),
	image_fit: z.string().optional(),
}).passthrough();

const labelStyleSchema = z.object({
	text_color: z.string().optional(),
	font: fontStyleSchema.optional(),
}).passthrough();

const edgeStyleSchema = z.object({
	color: z.string().optional(),
	line_style: z.enum(['solid', 'dashed', 'dotted', 'none']).optional(),
	weight: z.number().optional(),
	text_color: z.string().optional(),
	font: fontStyleSchema.optional(),
}).passthrough();

const metadataSchema = z.object({
	schema_version: z.string(),
	title: z.string(),
	authors: z.array(z.string()),
	diagram_version: z.string(),
	theme_file: z.string().optional(),
	theme_mode: z.enum(['light', 'dark']).optional(),
	show_ontology_information: z.boolean().optional(),
	additional: jsonObjectSchema.optional(),
}).passthrough();

const ontologyFileReferenceSchema = z.object({
	path: z.string(),
}).passthrough();

const nodeSchema = boundsFieldsSchema.extend({
	id: z.string(),
	ontology_ref: z.string(),
	style: commonStyleSchema.optional(),
	image: z.string().optional(),
	show_data_properties: z.boolean().optional(),
	show_type: z.boolean().optional(),
	show_property_values: z.boolean().optional(),
	property_value_text_overflow: z.enum(['truncate', 'wrap']).optional(),
	label_text_overflow: z.enum(['truncate', 'wrap']).optional(),
	type_display: z.enum(['inline', 'stereotype']).optional(),
}).passthrough();

const edgeSchema = z.object({
	id: z.string(),
	source: z.string(),
	target: z.string(),
	ontology_ref: z.string(),
	label: pointSchema,
	source_cardinality_label: pointSchema.optional(),
	target_cardinality_label: pointSchema.optional(),
	points: z.array(pointSchema),
	style: edgeStyleSchema.optional(),
	route_layout: z.enum(['orthogonal', 'direct', 'one_side', 'manhattan', 'metro', 'entity_relation']).optional(),
	render_as: z.literal('containment').optional(),
	containment_direction: z.enum(['source_contains_target', 'target_contains_source']).optional(),
}).passthrough();

const noteSchema = boundsFieldsSchema.extend({
	id: z.string(),
	text: z.string(),
	style: commonStyleSchema.optional(),
	export: z.boolean().optional(),
});

const imageSchema = boundsFieldsSchema.extend({
	id: z.string(),
	source: z.string(),
	style: commonStyleSchema.optional(),
}).passthrough();

const labelSchema = boundsFieldsSchema.extend({
	id: z.string(),
	text: z.string(),
	style: labelStyleSchema.optional(),
}).passthrough();

const metadataElementSchema = boundsFieldsSchema.extend({
	id: z.string(),
	style: commonStyleSchema.optional(),
}).passthrough();

const legendElementSchema = boundsFieldsSchema.extend({
	id: z.string(),
	colors: z.record(z.string(), z.string()),
	color_mode: z.enum(['border', 'background']).optional(),
	color_by: z.enum(['ontologySource', 'elementType', 'none']).optional(),
	style: commonStyleSchema.optional(),
}).passthrough();

const documentSchema = z.object({
	metadata: metadataSchema,
	ontologies: z.array(ontologyFileReferenceSchema),
	namespaces: z.record(z.string(), z.string()),
	nodes: z.array(nodeSchema),
	edges: z.array(edgeSchema),
	notes: z.array(noteSchema).optional(),
	images: z.array(imageSchema).optional(),
	labels: z.array(labelSchema).optional(),
	metadata_elements: z.array(metadataElementSchema).optional(),
	legend_elements: z.array(legendElementSchema).optional(),
}).passthrough();

export function parseOntologyDiagramObject(value: unknown): OntologyDiagramDocument {
	const parsed = documentSchema.safeParse(value);
	if (!parsed.success) {
		throw new OntologyDiagramValidationError('Invalid .odiagram document.', parsed.error.issues.map((issue) => issue.message));
	}

	const document = parsed.data;

	return new OntologyDiagramDocument(
		parseMetadata(document.metadata),
		document.ontologies.map(parseOntologyFileReference),
		new Map(Object.entries(document.namespaces)),
		document.nodes.map(parseNode),
		document.edges.map(parseEdge),
		(document.notes ?? []).map(parseNote),
		(document.images ?? []).map(parseImage),
		(document.labels ?? []).map(parseLabel),
		getExtraFields(document, ['metadata', 'ontologies', 'namespaces', 'nodes', 'edges', 'notes', 'images', 'labels', 'metadata_elements', 'legend_elements']),
		(document.metadata_elements ?? []).map(parseMetadataElement),
		(document.legend_elements ?? []).map(parseLegendElement),
	);
}

function parseMetadata(value: z.infer<typeof metadataSchema>): DiagramMetadata {
	return new DiagramMetadata(
		value.schema_version,
		value.title,
		value.authors,
		value.diagram_version,
		value.theme_file,
		value.additional,
		getExtraFields(value, ['schema_version', 'title', 'authors', 'diagram_version', 'theme_file', 'theme_mode', 'show_ontology_information', 'additional']),
		value.theme_mode,
		value.show_ontology_information,
	);
}

function parseOntologyFileReference(value: z.infer<typeof ontologyFileReferenceSchema>): OntologyFileReference {
	return new OntologyFileReference(value.path, getExtraFields(value, ['path']));
}

function parseNode(value: z.infer<typeof nodeSchema>): DiagramNode {
	return new DiagramNode(
		value.id,
		value.ontology_ref,
		new Bounds(value.x, value.y, value.width, value.height),
		value.style ? parseCommonStyle(value.style) : undefined,
		value.image,
		getExtraFields(value, ['id', 'ontology_ref', 'x', 'y', 'width', 'height', 'style', 'image', 'show_data_properties', 'show_type', 'show_property_values', 'property_value_text_overflow', 'label_text_overflow', 'type_display']),
		value.show_data_properties,
		value.show_type,
		value.show_property_values,
		value.property_value_text_overflow,
		value.label_text_overflow,
		value.type_display,
	);
}

function parseEdge(value: z.infer<typeof edgeSchema>): DiagramEdge {
	return new DiagramEdge(
		value.id,
		value.source,
		value.target,
		value.ontology_ref,
		parsePoint(value.label),
		value.points.map(parsePoint),
		value.style ? parseEdgeStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'source', 'target', 'ontology_ref', 'label', 'points', 'style', 'route_layout', 'render_as', 'containment_direction']),
		value.route_layout,
		value.render_as,
		value.containment_direction,
	);
}

function parseNote(value: z.infer<typeof noteSchema>): DiagramNote {
	return new DiagramNote(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.text,
		value.style ? parseCommonStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'text', 'style', 'export']),
		value.export,
	);
}

function parseImage(value: z.infer<typeof imageSchema>): DiagramImage {
	return new DiagramImage(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.source,
		value.style ? parseCommonStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'source', 'style']),
	);
}

function parseLabel(value: z.infer<typeof labelSchema>): DiagramLabel {
	return new DiagramLabel(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.text,
		value.style ? parseLabelStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'text', 'style']),
	);
}

function parseMetadataElement(value: z.infer<typeof metadataElementSchema>): DiagramMetadataElement {
	return new DiagramMetadataElement(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.style ? parseCommonStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'style']),
	);
}

function parseLegendElement(value: z.infer<typeof legendElementSchema>): DiagramLegendElement {
	return new DiagramLegendElement(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		new Map(Object.entries(value.colors)),
		value.style ? parseCommonStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'colors', 'style', 'color_mode', 'color_by']),
		value.color_mode,
		value.color_by,
	);
}

function parsePoint(value: z.infer<typeof pointSchema>): Point {
	return new Point(value.x, value.y);
}

function parseFontStyle(value: z.infer<typeof fontStyleSchema>): FontStyle {
	return new FontStyle(value.family, value.bold, value.italic, value.size, getExtraFields(value, ['family', 'bold', 'italic', 'size']));
}

function parseBorderStyle(value: z.infer<typeof borderStyleSchema>): BorderStyle {
	return new BorderStyle(value.type, value.weight, value.color, getExtraFields(value, ['type', 'weight', 'color']));
}

function parseCommonStyle(value: z.infer<typeof commonStyleSchema>): CommonStyle {
	return new CommonStyle(
		value.bg_color,
		value.text_color,
		value.font ? parseFontStyle(value.font) : undefined,
		value.border ? parseBorderStyle(value.border) : undefined,
		getExtraFields(value, ['bg_color', 'text_color', 'font', 'border', 'corner_radius', 'shadow', 'image_fit']),
		value.corner_radius,
		value.shadow,
		normalizeImageFit(value.image_fit),
	);
}

function normalizeImageFit(value: string | undefined): CommonStyle['imageFit'] {
	switch (value) {
		case 'cover':
		case 'match_width':
		case 'match_height':
			return value;
		case 'stretch':
			return 'contain';
		case 'contain':
			return value;
		default:
			return undefined;
	}
}

function parseLabelStyle(value: z.infer<typeof labelStyleSchema>): LabelStyle {
	return new LabelStyle(
		value.text_color,
		value.font ? parseFontStyle(value.font) : undefined,
		getExtraFields(value, ['text_color', 'font']),
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

