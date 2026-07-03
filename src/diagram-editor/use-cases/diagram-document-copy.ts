import { OntologyDiagramDocument } from '../../documents/odiagram';

interface DiagramOverrides {
	readonly namespaces?: OntologyDiagramDocument['namespaces'];
	readonly nodes?: OntologyDiagramDocument['nodes'];
	readonly edges?: OntologyDiagramDocument['edges'];
	readonly notes?: OntologyDiagramDocument['notes'];
	readonly images?: OntologyDiagramDocument['images'];
	readonly labels?: OntologyDiagramDocument['labels'];
}

export function cloneDiagram(
	diagram: OntologyDiagramDocument,
	overrides: DiagramOverrides,
): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		diagram.metadata,
		diagram.ontologies,
		overrides.namespaces ?? diagram.namespaces,
		overrides.nodes ?? diagram.nodes,
		overrides.edges ?? diagram.edges,
		overrides.notes ?? diagram.notes,
		overrides.images ?? diagram.images,
		overrides.labels ?? diagram.labels,
		diagram.extra,
	);
}
