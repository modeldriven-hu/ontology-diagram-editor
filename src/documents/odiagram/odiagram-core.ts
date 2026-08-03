export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonObject | JsonValue[];
export type JsonObject = { [key: string]: JsonValue };

const identifierLocalPartPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const compactIriPattern = /^([^:/?#]+):(.+)$/;

export type ElementKind = 'node' | 'edge' | 'note' | 'image' | 'label' | 'metadata' | 'legend' | 'link';
export type BorderType = 'solid' | 'dashed' | 'dotted' | 'none';
export type EdgeLineStyle = 'solid' | 'dashed' | 'dotted' | 'none';
export type EdgeRouteLayout = 'orthogonal' | 'direct' | 'one_side' | 'manhattan' | 'metro' | 'entity_relation';
export type EdgeRenderAs = 'containment';
export type ContainmentDirection = 'source_contains_target' | 'target_contains_source';
export type PropertyValueTextOverflow = 'truncate' | 'wrap';
export type NodeLabelTextOverflow = 'truncate' | 'wrap';
export type IndividualTypeDisplay = 'inline' | 'stereotype';
export type OntologyColorMode = 'border' | 'background';
export type OntologyColorBy = 'ontologySource' | 'elementType' | 'none';
export type DiagramCanvasBackground = 'theme' | 'white' | 'transparent';

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


export function assertFiniteNumber(value: number, fieldName: string): void {
	if (!Number.isFinite(value)) {
		throw new OntologyDiagramValidationError(`${fieldName} must be a finite number.`);
	}
}

export function assertPositiveNumber(value: number, fieldName: string): void {
	assertFiniteNumber(value, fieldName);
	if (value <= 0) {
		throw new OntologyDiagramValidationError(`${fieldName} must be greater than 0.`);
	}
}

export function assertNonNegativeNumber(value: number, fieldName: string): void {
	assertFiniteNumber(value, fieldName);
	if (value < 0) {
		throw new OntologyDiagramValidationError(`${fieldName} must be greater than or equal to 0.`);
	}
}



export function omitUndefined(value: Record<string, JsonValue | undefined>): JsonObject {
	const result: JsonObject = {};
	for (const [key, fieldValue] of Object.entries(value)) {
		if (fieldValue !== undefined) {
			result[key] = fieldValue;
		}
	}
	return result;
}

export function optionalList<T>(values: readonly T[], toJson: (value: T) => JsonValue): JsonValue[] | undefined {
	return values.length > 0 ? values.map(toJson) : undefined;
}
