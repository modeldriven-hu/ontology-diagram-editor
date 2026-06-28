# Acceptance Tests: `.odiagram` File Format

## Valid Document Shape

- Given a `.odiagram` file with `metadata`, `ontologies`, `namespaces`, `nodes`, and `edges`, when it is parsed, then it is accepted as a valid root document shape.
- Given optional `notes`, `images`, or `labels` sections are omitted, when the file is parsed, then each omitted section is treated as an empty list.
- Given a required top-level section is missing, when the file is parsed, then validation reports a format error.

## Element Validation

- Given diagram elements across all sections, when validation runs, then every element `id` is unique across the whole file.
- Given an element `id` does not match the required prefix for its element type, when validation runs, then validation reports an error.
- Given a compact ontology reference uses an undefined namespace prefix, when validation runs, then validation reports an error.
- Given an edge references a missing source or target node, when validation runs, then validation reports an error.
- Given bounds contain non-positive `width` or `height`, when validation runs, then validation reports an error.
- Given an edge has fewer than two route points, when validation runs, then validation reports an error.

## Templates And References

- Given the create-new-diagram command runs, when the file is created, then it contains all required top-level sections and the default `rdfs` namespace.
- Given a relative ontology, theme, or image path, when it is resolved, then it is resolved relative to the `.odiagram` file.
- Given unknown fields are present, when the file is rewritten by a supported edit, then unknown fields are preserved whenever the writer can preserve them.
