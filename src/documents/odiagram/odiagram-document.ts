import { z } from 'zod';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

const identifierLocalPartPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const compactIriPattern = /^([^:/?#]+):(.+)$/;
const uriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export type ElementKind = 'node' | 'edge' | 'note' | 'image' | 'label';
export type BorderType = 'solid' | 'dashed' | 'dotted' | 'none';
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'none';

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
	) {}

	public toPersistenceObject(): JsonObject {
		return omitUndefined({
			...this.extra,
			bg_color: this.bgColor,
			text_color: this.textColor,
			font: this.font?.toPersistenceObject(),
			border: this.border?.toPersistenceObject(),
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
	) {
		if (points.length < 2) {
			throw new OntologyDiagramValidationError(`Edge "${id}" must contain at least two route points.`);
		}

		this.id = DiagramIdentifier.create(id, 'edge');
		this.source = DiagramIdentifier.create(source, 'node');
		this.target = DiagramIdentifier.create(target, 'node');
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
		});
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
		public readonly extra: JsonObject = {},
	) {
		this.id = DiagramIdentifier.create(id, 'image');
		this.bounds = bounds;
		assertImageSource(source);
	}

	public toPersistenceObject(): JsonObject {
		return {
			...this.extra,
			id: this.id.value,
			...this.bounds.toPersistenceObject(),
			source: this.source,
		};
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
}).passthrough();

const edgeSchema = z.object({
	id: z.string(),
	source: z.string(),
	target: z.string(),
	ontology_ref: z.string(),
	label: pointSchema,
	points: z.array(pointSchema),
	style: edgeStyleSchema.optional(),
}).passthrough();

const noteSchema = boundsFieldsSchema.extend({
	id: z.string(),
	text: z.string(),
	style: commonStyleSchema.optional(),
});

const imageSchema = boundsFieldsSchema.extend({
	id: z.string(),
	source: z.string(),
});

const labelSchema = boundsFieldsSchema.extend({
	id: z.string(),
	text: z.string(),
	style: labelStyleSchema.optional(),
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
		getExtraFields(document, ['metadata', 'ontologies', 'namespaces', 'nodes', 'edges', 'notes', 'images', 'labels']),
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
		getExtraFields(value, ['schema_version', 'title', 'authors', 'diagram_version', 'theme_file', 'additional']),
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
		getExtraFields(value, ['id', 'ontology_ref', 'x', 'y', 'width', 'height', 'style', 'image']),
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
		getExtraFields(value, ['id', 'source', 'target', 'ontology_ref', 'label', 'points', 'style']),
	);
}

function parseNote(value: z.infer<typeof noteSchema>): DiagramNote {
	return new DiagramNote(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.text,
		value.style ? parseCommonStyle(value.style) : undefined,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'text', 'style']),
	);
}

function parseImage(value: z.infer<typeof imageSchema>): DiagramImage {
	return new DiagramImage(
		value.id,
		new Bounds(value.x, value.y, value.width, value.height),
		value.source,
		getExtraFields(value, ['id', 'x', 'y', 'width', 'height', 'source']),
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
		getExtraFields(value, ['bg_color', 'text_color', 'font', 'border']),
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
	const nodeIds = new Set(document.nodes.map((node) => node.id.value));
	return document.edges.flatMap((edge) => {
		const issues: string[] = [];
		if (!nodeIds.has(edge.source.value)) {
			issues.push(`Edge "${edge.id.value}" references missing source node "${edge.source.value}".`);
		}
		if (!nodeIds.has(edge.target.value)) {
			issues.push(`Edge "${edge.id.value}" references missing target node "${edge.target.value}".`);
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
	if (source.startsWith('data:image/')) {
		return;
	}
	if (source.startsWith('/') || /^[A-Za-z]:[\\/]/.test(source) || uriSchemePattern.test(source)) {
		throw new OntologyDiagramValidationError('Image source must be a relative file path or data image URI.');
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
