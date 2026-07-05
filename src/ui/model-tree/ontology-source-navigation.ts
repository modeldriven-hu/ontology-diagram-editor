import type { OntologyItem } from './ontology-model';

export interface OntologySourceRange {
	readonly startOffset: number;
	readonly endOffset: number;
}

interface SourceCandidate {
	readonly value: string;
	readonly requiresBoundary: boolean;
}

const compactIriPattern = /^([^:/?#]+):(.+)$/;
const uriSchemePattern = /^[A-Za-z][A-Za-z0-9+.-]*:/;
const localNameCharacterPattern = /[A-Za-z0-9_-]/;

export function findOntologySourceRange(text: string, item: OntologyItem): OntologySourceRange | undefined {
	for (const candidate of sourceCandidatesForItem(item)) {
		const startOffset = findCandidateOffset(text, candidate);
		if (startOffset >= 0) {
			return {
				startOffset,
				endOffset: startOffset + candidate.value.length,
			};
		}
	}

	return undefined;
}

function sourceCandidatesForItem(item: OntologyItem): readonly SourceCandidate[] {
	const builder = new SourceCandidateBuilder();

	if (item.type === 'subclassRelationship') {
		builder.addReference(item.metadata.subclassReference);
		builder.addReference(item.metadata.superclassReference);
		builder.addReference(item.metadata.relationshipReference);
		builder.addReference(item.reference);
		return builder.toCandidates();
	}

	builder.addReference(item.reference);
	builder.addReference(item.metadata.iri);

	return builder.toCandidates();
}

class SourceCandidateBuilder {
	private readonly exactCandidates: SourceCandidate[] = [];
	private readonly fallbackCandidates: SourceCandidate[] = [];
	private readonly seen = new Set<string>();

	public addReference(value: string | undefined): void {
		if (value === undefined || value.trim().length === 0) {
			return;
		}

		this.add(value, false);

		if (isAbsoluteIri(value)) {
			this.add(`<${value}>`, false);
			this.add(localName(value), true);
			return;
		}

		const localPart = compactLocalPart(value);
		if (localPart !== undefined) {
			this.add(localPart, true);
		}
	}

	public toCandidates(): readonly SourceCandidate[] {
		return [...this.exactCandidates, ...this.fallbackCandidates];
	}

	private add(value: string, requiresBoundary: boolean): void {
		if (value.length === 0 || this.seen.has(value)) {
			return;
		}

		this.seen.add(value);
		const candidates = requiresBoundary ? this.fallbackCandidates : this.exactCandidates;
		candidates.push({ value, requiresBoundary });
	}
}

function findCandidateOffset(text: string, candidate: SourceCandidate): number {
	if (!candidate.requiresBoundary) {
		return text.indexOf(candidate.value);
	}

	let searchStart = 0;
	while (searchStart < text.length) {
		const offset = text.indexOf(candidate.value, searchStart);
		if (offset < 0) {
			return -1;
		}

		if (hasLocalNameBoundaries(text, offset, candidate.value.length)) {
			return offset;
		}

		searchStart = offset + candidate.value.length;
	}

	return -1;
}

function hasLocalNameBoundaries(text: string, startOffset: number, length: number): boolean {
	const previous = startOffset > 0 ? text[startOffset - 1] : undefined;
	const next = startOffset + length < text.length ? text[startOffset + length] : undefined;

	return !isLocalNameCharacter(previous) && !isLocalNameCharacter(next);
}

function isLocalNameCharacter(value: string | undefined): boolean {
	return value !== undefined && localNameCharacterPattern.test(value);
}

function compactLocalPart(value: string): string | undefined {
	const match = compactIriPattern.exec(value);
	if (match === null || value.includes('://')) {
		return undefined;
	}

	return match[2];
}

function isAbsoluteIri(value: string): boolean {
	return uriSchemePattern.test(value) && (value.includes('://') || value.startsWith('urn:'));
}

function localName(value: string): string {
	const hashIndex = value.lastIndexOf('#');
	const slashIndex = value.lastIndexOf('/');
	const separatorIndex = Math.max(hashIndex, slashIndex);

	return separatorIndex >= 0 ? value.slice(separatorIndex + 1) : value;
}
