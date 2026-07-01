import { OntologyDiagramDocument } from '../../odiagram';

interface DiagramOverrides {
	readonly nodes?: OntologyDiagramDocument['nodes'];
	readonly edges?: OntologyDiagramDocument['edges'];
	readonly notes?: OntologyDiagramDocument['notes'];
	readonly images?: OntologyDiagramDocument['images'];
}

export function cloneDiagram(
	diagram: OntologyDiagramDocument,
	overrides: DiagramOverrides,
): OntologyDiagramDocument {
	return new OntologyDiagramDocument(
		diagram.metadata,
		diagram.ontologies,
		diagram.namespaces,
		overrides.nodes ?? diagram.nodes,
		overrides.edges ?? diagram.edges,
		overrides.notes ?? diagram.notes,
		overrides.images ?? diagram.images,
		diagram.labels,
		diagram.extra,
	);
}
