import { z } from 'zod';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

const identifierLocalPartPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const compactIriPattern = /^([^:/?#]+):(.+)$/;

export type ElementKind = 'node' | 'edge' | 'note' | 'image' | 'label' | 'metadata' | 'legend';
export type BorderType = 'solid' | 'dashed' | 'dotted' | 'none';
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type EdgeRouteLayout = 'orthogonal' | 'direct' | 'one_side' | 'manhattan' | 'metro' | 'entity_relation';
export type PropertyValueTextOverflow = 'truncate' | 'wrap';
export type OntologyColorMode = 'border' | 'background';

export class OntologyDiagramValidationError extends Error {
	public constructor(message: string, public readonly issues: readonly string[] = [message]) {
		super(message);
		this.name = 'OntologyDiagramValidationError';
	}
}

export class DiagramIdentifier {
	private constructor(public readonly value: string) {}

	public static create(value: string, kind: ElementKind): DiagramIdentifier {
		const expectedPrefix = `${kind}_`;
		if (!value.startsWith(expectedPrefix)) {
			throw new OntologyDiagramValidationError(`Expected ${kind} identifier to start with "${expectedPrefix}".`);
		}

		const localPart = value.slice(expectedPrefix.length);
		if (!identifierLocalPartPattern.test(localPart)) {
			throw new OntologyDiagramValidationError(`Invalid ${kind} identifier "${value}".`);
		}

		return new DiagramIdentifier(value);
	}

	public static createAny(value: string, kinds: readonly ElementKind[], label: string): DiagramIdentifier {
		for (const kind of kinds) {
			const expectedPrefix = `${kind}_`;
			if (value.startsWith(expectedPrefix)) {
				return DiagramIdentifier.create(value, kind);
			}
		}

		throw new OntologyDiagramValidationError(`${label} identifier must start with one of: ${kinds.map((kind) => `"${kind}_"`).join(', ')}.`);
	}

	public toString(): string {
		return this.value;
	}
}

export class OntologyReference {
	private constructor(public readonly value: string) {}

	public static create(value: string): OntologyReference {
		if (value.trim().length === 0) {
			throw new OntologyDiagramValidationError('Ontology reference must be a non-empty string.');
		}

		return new OntologyReference(value);
	}

	public getCompactPrefix(): string | undefined {
		const match = compactIriPattern.exec(this.value);
		if (!match || this.value.includes('://')) {
			return undefined;
		}

		return match[1];
	}

	public toString(): string {
		return this.value;
	}
}

export class Point {
	public constructor(public readonly x: number, public readonly y: number) {
		assertFiniteNumber(x, 'Point x');
		assertFiniteNumber(y, 'Point y');
	}

	public toPersistenceObject(): JsonObject {
		return {
			x: this.x,
			y: this.y,
		};
	}
}

export class Bounds {
	public constructor(
		public readonly x: number,
		public readonly y: number,
		public readonly width: number,
		public readonly height: number,
	) {
		assertFiniteNumber(x, 'Bounds x');
		assertFiniteNumber(y, 'Bounds y');
		assertPositiveNumber(width, 'Bounds width');
		assertPositiveNumber(height, 'Bounds height');
	}

	public toPersistenceObject(): JsonObject {
		return {
			x: this.x,
			y: this.y,
			width: this.width,
			height: this.height,
		};
	}
}

export class FontStyle {
	public constructor(
		public readonly family?: string,
		public readonly bold?: boolean,
		public readonly italic?: boolean,
		public readonly size?: number,
		public readonly extra: JsonObject = {},
	) {
		if (family !== undefined && family.trim().length === 0) {
			throw new OntologyDiagramValidationError('Font family must be a non-empty string.');
		}
		if (size !== undefined) {
			assertPositiveNumber(size, 'Font size');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			family: this.family,
			bold: this.bold,
			italic: this.italic,
			size: this.size,
		});
	}
}

export class BorderStyle {
	public constructor(
		public readonly type?: BorderType,
		public readonly weight?: number,
		public readonly color?: string,
		public readonly extra: JsonObject = {},
	) {
		if (weight !== undefined) {
			assertNonNegativeNumber(weight, 'Border weight');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			type: this.type,
			weight: this.weight,
			color: this.color,
		});
	}
}

export class CommonStyle {
	public constructor(
		public readonly bgColor?: string,
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly border?: BorderStyle,
		public readonly extra: JsonObject = {},
		public readonly cornerRadius?: number,
		public readonly shadow?: boolean,
	) {
		if (cornerRadius !== undefined) {
			assertNonNegativeNumber(cornerRadius, 'Corner radius');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			bg_color: this.bgColor,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
			border: this.border?.toPersistenceObject(),
			corner_radius: this.cornerRadius,
			shadow: this.shadow,
		});
	}
}

export class LabelStyle {
	public constructor(
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly extra: JsonObject = {},
	) {
		const unsupportedFields = Object.keys(extra).filter((field) => field !== 'text_color' && field !== 'font');
		if (unsupportedFields.length > 0) {
			throw new OntologyDiagramValidationError(`Label style contains unsupported fields: ${unsupportedFields.join(', ')}.`);
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
		});
	}
}

export class EdgeStyle {
	public constructor(
		public readonly color?: string,
		public readonly lineStyle?: EdgeLineStyle,
		public readonly weight?: number,
		public readonly textColor?: string,
		public readonly font?: FontStyle,
		public readonly extra: JsonObject = {},
	) {
		if (weight !== undefined) {
			assertNonNegativeNumber(weight, 'Edge weight');
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			color: this.color,
			line_style: this.lineStyle,
			weight: this.weight,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
		});
	}
}

export class DiagramMetadata {
	public constructor(
		public readonly schemaVersion: string,
		public readonly title: string,
		public readonly authors: readonly string[],
		public readonly diagramVersion: string,
		public readonly themeFile?: string,
		public readonly additional?: JsonObject,
		public readonly extra: JsonObject = {},
		public readonly themeMode?: 'light' | 'dark',
		public readonly showOntologyInformation?: boolean,
	) {}

	public static createEmpty(title: string): DiagramMetadata {
		return new DiagramMetadata('1.0', title, [], '0.1.0');
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			schema_version: this.schemaVersion,
			title: this.title,
			authors: [...this.authors],
			diagram_version: this.diagramVersion,
			theme_file: this.themeFile,
			theme_mode: this.themeMode,
			show_ontology_information: this.showOntologyInformation,
			additional: this.additional,
		});
	}
}

export class OntologyFileReference {
	public constructor(public readonly path: string, public readonly extra: JsonObject = {}) {
		if (path.trim().length === 0) {
			throw new OntologyDiagramValidationError('Ontology file path must be a non-empty string.');
		}
	}

	public toPersistenceObject(): JsonObject {
		return {
			...this.extra,
			path: this.path,
		};
	}
}

export class DiagramNode {
	public readonly id: DiagramIdentifier;
	public readonly ontologyRef: OntologyReference;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		ontologyRef: string,
		bounds: Bounds,
		public readonly style?: CommonStyle,
		public readonly image?: string,
		public readonly extra: JsonObject = {},
		public readonly showDataProperties?: boolean,
		public readonly showType?: boolean,
		public readonly showPropertyValues?: boolean,
		public readonly propertyValueTextOverflow?: PropertyValueTextOverflow,
	) {
		this.id = DiagramIdentifier.create(id, 'node');
		this.ontologyRef = OntologyReference.create(ontologyRef);
		this.bounds = bounds;
		if (image !== undefined) {
			assertImageSource(image);
		}
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			ontology_ref: this.ontologyRef.value,
			...this.bounds.toPersistenceObject(),
			style: this.style?.toPersistenceObject(),
			image: this.image,
			show_data_properties: this.showDataProperties === true ? true : undefined,
			show_type: this.showType,
			show_property_values: this.showPropertyValues,
			property_value_text_overflow: this.propertyValueTextOverflow === 'wrap' ? 'wrap' : undefined,
		});
	}
}

export class DiagramEdge {
	public readonly id: DiagramIdentifier;
	public readonly source: DiagramIdentifier;
	public readonly target: DiagramIdentifier;
	public readonly ontologyRef: OntologyReference;

	public constructor(
		id: string,
		source: string,
		target: string,
		ontologyRef: string,
		public readonly label: Point,
		public readonly points: readonly Point[],
		public readonly style?: EdgeStyle,
		public readonly extra: JsonObject = {},
		public readonly routeLayout?: EdgeRouteLayout,
	) {
		if (points.length < 2) {
			throw new OntologyDiagramValidationError(`Edge "${id}" must contain at least two route points.`);
		}

		this.id = DiagramIdentifier.create(id, 'edge');
		this.source = DiagramIdentifier.createAny(source, ['node', 'note', 'image'], 'Edge source');
		this.target = DiagramIdentifier.createAny(target, ['node', 'note', 'image'], 'Edge target');
		this.ontologyRef = OntologyReference.create(ontologyRef);
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			source: this.source.value,
			target: this.target.value,
			ontology_ref: this.ontologyRef.value,
			label: this.label.toPersistenceObject(),
			points: this.points.map((point) => point.toPersistenceObject()),
			style: this.style?.toPersistenceObject(),
			route_layout: this.routeLayout,
		});
	}

	public get sourceCardinalityLabel(): Point | undefined {
		return pointFromExtra(this.extra.source_cardinality_label);
	}

	public get targetCardinalityLabel(): Point | undefined {
		return pointFromExtra(this.extra.target_cardinality_label);
	}

	public withCardinalityLabelPositions(source: Point | undefined, target: Point | undefined): DiagramEdge {
		const extra: JsonObject = { ...this.extra };
		setExtraPoint(extra, 'source_cardinality_label', source);
		setExtraPoint(extra, 'target_cardinality_label', target);
		return new DiagramEdge(
			this.id.value,
			this.source.value,
			this.target.value,
			this.ontologyRef.value,
			this.label,
			this.points,
			this.style,
			extra,
			this.routeLayout,
		);
	}
}

export class DiagramNote {
	public readonly id: DiagramIdentifier;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		bounds: Bounds,
		public readonly text: string,
		public readonly style?: CommonStyle,
		public readonly extra: JsonObject = {},
		public readonly exported?: boolean,
	) {
		this.id = DiagramIdentifier.create(id, 'note');
		this.bounds = bounds;
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			text: this.text,
			style: this.style?.toPersistenceObject(),
			export: this.exported === false ? false : undefined,
		});
	}
}

export class DiagramImage {
	public readonly id: DiagramIdentifier;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		bounds: Bounds,
		public readonly source: string,
		public readonly style?: CommonStyle,
		public readonly extra: JsonObject = {},
	) {
		this.id = DiagramIdentifier.create(id, 'image');
		this.bounds = bounds;
		assertImageSource(source);
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			source: this.source,
			style: this.style?.toPersistenceObject(),
		});
	}
}

export class DiagramLabel {
	public readonly id: DiagramIdentifier;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		bounds: Bounds,
		public readonly text: string,
		public readonly style?: LabelStyle,
		public readonly extra: JsonObject = {},
	) {
		this.id = DiagramIdentifier.create(id, 'label');
		this.bounds = bounds;
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			text: this.text,
			style: this.style?.toPersistenceObject(),
		});
	}
}

/** A canvas element whose displayed values are derived from the diagram metadata. */
export class DiagramMetadataElement {
	public readonly id: DiagramIdentifier;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		bounds: Bounds,
		public readonly style?: CommonStyle,
		public readonly extra: JsonObject = {},
	) {
		this.id = DiagramIdentifier.create(id, 'metadata');
		this.bounds = bounds;
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			style: this.style?.toPersistenceObject(),
		});
	}
}

/** A canvas element that activates ontology colours and displays their file mapping. */
export class DiagramLegendElement {
	public readonly id: DiagramIdentifier;
	public readonly bounds: Bounds;

	public constructor(
		id: string,
		bounds: Bounds,
		public readonly colors: ReadonlyMap<string, string>,
		public readonly style?: CommonStyle,
		public readonly extra: JsonObject = {},
		public readonly colorMode?: OntologyColorMode,
	) {
		this.id = DiagramIdentifier.create(id, 'legend');
		this.bounds = bounds;
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			colors: Object.fromEntries(this.colors),
			style: this.style?.toPersistenceObject(),
			color_mode: this.colorMode,
		});
	}
}

export class OntologyDiagramDocument {
	public constructor(
		public readonly metadata: DiagramMetadata,
		public readonly ontologies: readonly OntologyFileReference[],
		public readonly namespaces: ReadonlyMap<string, string>,
		public readonly nodes: readonly DiagramNode[],
		public readonly edges: readonly DiagramEdge[],
		public readonly notes: readonly DiagramNote[] = [],
		public readonly images: readonly DiagramImage[] = [],
		public readonly labels: readonly DiagramLabel[] = [],
		public readonly extra: JsonObject = {},
		public readonly metadataElements: readonly DiagramMetadataElement[] = [],
		public readonly legendElements: readonly DiagramLegendElement[] = [],
	) {
		validateDocument(this);
	}

	public static createEmpty(title: string): OntologyDiagramDocument {
		return new OntologyDiagramDocument(
			DiagramMetadata.createEmpty(title),
			[],
			new Map([['rdfs', 'http://www.w3.org/2000/01/rdf-schema#']]),
			[],
			[],
		);
	}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			metadata: this.metadata.toPersistenceObject(),
			ontologies: this.ontologies.map((ontology) => ontology.toPersistenceObject()),
			namespaces: Object.fromEntries(this.namespaces),
			nodes: this.nodes.map((node) => node.toPersistenceObject()),
			edges: this.edges.map((edge) => edge.toPersistenceObject()),
			notes: optionalList(this.notes, (note) => note.toPersistenceObject()),
			images: optionalList(this.images, (image) => image.toPersistenceObject()),
			labels: optionalList(this.labels, (label) => label.toPersistenceObject()),
			metadata_elements: optionalList(this.metadataElements, (element) => element.toPersistenceObject()),
			legend_elements: optionalList(this.legendElements, (element) => element.toPersistenceObject()),
		});
	}
}

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
		getExtraFields(value, ['id', 'ontology_ref', 'x', 'y', 'width', 'height', 'style', 'image', 'show_data_properties', 'show_type', 'show_property_values', 'property_value_text_overflow']),
		value.show_data_properties,
		value.show_type,
		value.show_property_values,
		value.property_value_text_overflow,
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
		getExtraFields(value, ['id', 'source', 'target', 'ontology_ref', 'label', 'points', 'style', 'route_layout']),
		value.route_layout,
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
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'colors', 'style', 'color_mode']),
		value.color_mode,
	);
}

function parsePoint(value: z.infer<typeof pointSchema>): Point {
	return new Point(value.x, value.y);
}

function pointFromExtra(value: JsonValue | undefined): Point | undefined {
	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		return undefined;
	}

	const x = value.x;
	const y = value.y;
	return typeof x === 'number' && typeof y === 'number' ? new Point(x, y) : undefined;
}

function setExtraPoint(extra: JsonObject, key: string, point: Point | undefined): void {
	if (point === undefined) {
		delete extra[key];
		return;
	}

	extra[key] = point.toPersistenceObject();
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
		getExtraFields(value, ['bg_color', 'text_color', 'font', 'border', 'corner_radius', 'shadow']),
		value.corner_radius,
		value.shadow,
	);
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

function validateDocument(document: OntologyDiagramDocument): void {
	const issues = [
		...validateUniqueElementIds(document),
		...validateEdgeReferences(document),
		...validateOntologyReferencePrefixes(document),
		...validateUniqueOntologyPaths(document),
	];

	if (issues.length > 0) {
		throw new OntologyDiagramValidationError('Invalid .odiagram document.', issues);
	}
}

function validateUniqueElementIds(document: OntologyDiagramDocument): string[] {
	const ids = [
		...document.nodes.map((node) => node.id.value),
		...document.edges.map((edge) => edge.id.value),
		...document.notes.map((note) => note.id.value),
		...document.images.map((image) => image.id.value),
		...document.labels.map((label) => label.id.value),
		...document.metadataElements.map((element) => element.id.value),
		...document.legendElements.map((element) => element.id.value),
	];
	const seen = new Set<string>();
	const duplicates = ids.filter((id) => {
		if (seen.has(id)) {
			return true;
		}
		seen.add(id);
		return false;
	});

	return [...new Set(duplicates)].map((id) => `Duplicate element identifier "${id}".`);
}

function validateEdgeReferences(document: OntologyDiagramDocument): string[] {
	const elementIds = new Set([
		...document.nodes.map((node) => node.id.value),
		...document.notes.map((note) => note.id.value),
		...document.images.map((image) => image.id.value),
	]);
	return document.edges.flatMap((edge) => {
		const issues: string[] = [];
		if (!elementIds.has(edge.source.value)) {
			issues.push(`Edge "${edge.id.value}" references missing source element "${edge.source.value}".`);
		}
		if (!elementIds.has(edge.target.value)) {
			issues.push(`Edge "${edge.id.value}" references missing target element "${edge.target.value}".`);
		}
		return issues;
	});
}

function validateOntologyReferencePrefixes(document: OntologyDiagramDocument): string[] {
	const references = [
		...document.nodes.map((node) => ({ id: node.id.value, reference: node.ontologyRef })),
		...document.edges.map((edge) => ({ id: edge.id.value, reference: edge.ontologyRef })),
	];

	return references.flatMap(({ id, reference }) => {
		const compactPrefix = reference.getCompactPrefix();
		if (compactPrefix !== undefined && !document.namespaces.has(compactPrefix)) {
			return [`Element "${id}" uses unknown ontology namespace prefix "${compactPrefix}".`];
		}
		return [];
	});
}

function validateUniqueOntologyPaths(document: OntologyDiagramDocument): string[] {
	const normalizedPaths = document.ontologies.map((ontology) => ontology.path.replaceAll('\\', '/'));
	const seen = new Set<string>();
	const duplicates = normalizedPaths.filter((path) => {
		if (seen.has(path)) {
			return true;
		}
		seen.add(path);
		return false;
	});

	return [...new Set(duplicates)].map((path) => `Duplicate ontology path "${path}".`);
}

function assertImageSource(source: string): void {
	if (source.trim().length === 0) {
		throw new OntologyDiagramValidationError('Image source must be a non-empty string.');
	}
	if (!source.startsWith('data:image/')) {
		throw new OntologyDiagramValidationError('Image source must be an embedded data image URI.');
	}
}

function assertFiniteNumber(value: number, fieldName: string): void {
	if (!Number.isFinite(value)) {
		throw new OntologyDiagramValidationError(`${fieldName} must be a finite number.`);
	}
}

function assertPositiveNumber(value: number, fieldName: string): void {
	assertFiniteNumber(value, fieldName);
	if (value <= 0) {
		throw new OntologyDiagramValidationError(`${fieldName} must be greater than 0.`);
	}
}

function assertNonNegativeNumber(value: number, fieldName: string): void {
	assertFiniteNumber(value, fieldName);
	if (value < 0) {
		throw new OntologyDiagramValidationError(`${fieldName} must be greater than or equal to 0.`);
	}
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

function omitUndefined(value: Record<string, JsonValue | undefined>): JsonObject {
	const result: JsonObject = {};
	for (const [key, fieldValue] of Object.entries(value)) {
		if (fieldValue !== undefined) {
			result[key] = fieldValue;
		}
	}
	return result;
}

function optionalList<T>(values: readonly T[], toJson: (value: T) => JsonValue): JsonValue[] | undefined {
	return values.length > 0 ? values.map(toJson) : undefined;
}
