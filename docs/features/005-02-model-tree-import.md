# Model Tree Importing

When the user adds an ontology in the model tree, the editor shall follow its explicit
`owl:imports` declarations before adding the selected ontology itself. Imported local
ontologies are added as direct `.odiagram` references in dependency-first order.

An import resolves when either:

- Its IRI is a local `file:` URI that identifies an ontology file, including a relative
  file reference resolved by the RDF parser; or
- Exactly one candidate ontology file in the workspace declares the imported IRI as an
  `owl:Ontology` subject.

The resolver follows imports transitively, handles cycles without adding a file twice,
and ignores unresolved, remote, or ambiguously matched imports. Prefix and base
declarations alone do not constitute ontology imports.
