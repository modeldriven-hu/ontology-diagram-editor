import { validateDocument } from './odiagram-validation';
import { DiagramIdentifier, OntologyDiagramValidationError, OntologyReference, omitUndefined, optionalList, type ContainmentDirection, type EdgeRenderAs, type EdgeRouteLayout, type ElementKind, type IndividualTypeDisplay, type JsonObject, type JsonValue, type NodeLabelTextOverflow, type OntologyColorBy, type OntologyColorMode, type PropertyValueTextOverflow } from './odiagram-core';
import { Bounds, Point } from './odiagram-geometry';
import { CommonStyle, EdgeStyle, LabelStyle } from './odiagram-styles';

export * from './odiagram-core';
export * from './odiagram-geometry';
export * from './odiagram-styles';

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
		public readonly labelTextOverflow?: NodeLabelTextOverflow,
		public readonly typeDisplay?: IndividualTypeDisplay,
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
			label_text_overflow: this.labelTextOverflow === 'wrap' ? 'wrap' : undefined,
			type_display: this.typeDisplay === 'stereotype' ? 'stereotype' : undefined,
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
		public readonly renderAs?: EdgeRenderAs,
		public readonly containmentDirection?: ContainmentDirection,
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
			render_as: this.renderAs,
			containment_direction: this.containmentDirection,
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
			this.renderAs,
			this.containmentDirection,
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
		public readonly colorBy?: OntologyColorBy,
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
			color_by: this.colorBy,
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

function assertImageSource(source: string): void {
	if (source.trim().length === 0) {
		throw new OntologyDiagramValidationError('Image source must be a non-empty string.');
	}
	if (!source.startsWith('data:image/')) {
		throw new OntologyDiagramValidationError('Image source must be an embedded data image URI.');
	}
}


