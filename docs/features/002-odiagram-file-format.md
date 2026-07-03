# `.odiagram` File Format

An `.odiagram` file is a YAML document that stores one ontology diagram. It contains
diagram metadata, references to ontology files, namespace shortcuts, positioned diagram
elements, and optional element-level visual overrides.

# Scope

This specification defines the persisted `.odiagram` file format, including required
sections, field names, data types, reference rules, coordinate rules, and validation
requirements.

Rendering behavior, editor interaction, and model tree behavior are defined in separate
feature specifications.

# File Requirements

- The file extension shall be `.odiagram`.
- The file content shall be valid YAML.
- The YAML document shall contain a single mapping at the root.
- Relative file paths in the document shall be resolved relative to the `.odiagram` file.
- Implementations shall preserve unknown fields when rewriting a file whenever practical.
- Implementations shall treat missing required fields, invalid references, and invalid
  scalar types as format errors.

# Top-Level Structure

An `.odiagram` file shall contain the following top-level sections:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `metadata` | map | Yes | Human-readable and versioning metadata. |
| `ontologies` | list | Yes | Ontology files referenced by the diagram. |
| `namespaces` | map | Yes | Namespace shortcuts used by ontology references. |
| `nodes` | list | Yes | Diagram nodes that represent ontology items. |
| `edges` | list | Yes | Diagram edges between nodes. |
| `notes` | list | No | Free-form notes. |
| `images` | list | No | Standalone images. |
| `labels` | list | No | Standalone text labels. |

Optional list sections that are omitted shall be interpreted as empty lists. Required
list sections may be empty.

# Common Types

## Identifier

Every persisted diagram element shall have a unique `id` within the entire `.odiagram`
file.

Identifiers shall use the following prefixes:

| Element type | Identifier format |
|--------------|-------------------|
| Node | `node_<local_id>` |
| Edge | `edge_<local_id>` |
| Note | `note_<local_id>` |
| Image | `image_<local_id>` |
| Label | `label_<local_id>` |

The `<local_id>` portion shall match this regular expression:

```text
^[A-Za-z][A-Za-z0-9_-]*$
```

Examples of valid identifiers are `node_person`, `edge_memberOf`, `note_modelingRemark`,
`image_logo`, and `label_coreModel`.

Implementations should generate stable, readable identifiers where possible. If a
generated identifier would collide with an existing identifier, the implementation should
append a numeric suffix, for example `node_person2`.

## Ontology Reference

An ontology reference is a string that identifies an ontology item, including a named
entity such as a class, property, individual, or datatype, or a supported relationship
predicate such as `rdfs:subClassOf`. It may be written as either:

- A compact IRI using a namespace shortcut, for example `ex:Person`.
- An absolute IRI or URI, for example `https://example.com/ontology#Person`.

If a compact IRI is used, the prefix before `:` shall exist in the `namespaces` section.

## Point

A point is a mapping with numeric `x` and `y` fields:

```yaml
{ x: 120.0, y: 80.0 }
```

Coordinates use diagram canvas units. Coordinate values may be integers or floating-point
numbers.

## Bounds

Positioned elements shall store their location and size using these numeric fields:

| Field | Type | Description |
|-------|------|-------------|
| `x` | number | Left position on the diagram canvas. |
| `y` | number | Top position on the diagram canvas. |
| `width` | number | Element width. |
| `height` | number | Element height. |

`width` and `height` shall be greater than `0`.

## Style Override

Nodes, notes, and labels may define a `style` map. Edges may define an edge-specific
`style` map.

Supported common style fields are:

| Field | Type | Description |
|-------|------|-------------|
| `bg_color` | string | Background color. |
| `text_color` | string | Text color. |
| `font` | map | Text font settings. |
| `border` | map | Border settings. |
| `corner_radius` | number | Rounded corner radius in diagram canvas units. |
| `shadow` | boolean | Whether the element draws a drop shadow. |

Nodes and notes may use all common style fields. In version 1, standalone labels may use
only `text_color` and `font`; labels shall not draw a background or border.

The `font` map may contain:

| Field | Type | Description |
|-------|------|-------------|
| `family` | string | Font family name. |
| `bold` | boolean | Whether text is bold. |
| `italic` | boolean | Whether text is italic. |
| `size` | number | Font size. |

The `border` map may contain:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Border type, such as `solid`, `dashed`, or `dotted`. |
| `weight` | number | Border weight. |
| `color` | string | Border color. |

Style properties override the active theme for that element only. If a style property is
omitted, the renderer shall use the active theme or its internal default. Numeric style
values such as border weight, font size, and corner radius shall be non-negative.

## Image Source

An image source is a string that shall be either:

- A relative file path resolved relative to the `.odiagram` file.
- A data URI.

Remote URL image sources are not supported in version 1.

# Metadata

The `metadata` section shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schema_version` | string | Yes | `.odiagram` schema version used by the file. |
| `title` | string | Yes | Diagram title. |
| `authors` | list of strings | Yes | Diagram authors. |
| `diagram_version` | string | Yes | User-defined diagram version. |
| `theme_file` | string | No | Relative path to a standalone theme file. |
| `additional` | map | No | Extra metadata key-value pairs. |

The `additional` map may contain arbitrary scalar, list, or map values.

Themes are referenced only through `metadata.theme_file`. The `.odiagram` format does not
support embedded theme definitions.

# Empty Diagram Template

The create new diagram command shall create a valid `.odiagram` file with all required
top-level sections present.

The new file shall use implementation-defined default metadata values and empty element
lists. At minimum, the created file shall have this shape:

```yaml
metadata:
  schema_version: "1.0"
  title: "<diagram title>"
  authors: []
  diagram_version: "0.1.0"
ontologies: []
namespaces:
  rdfs: "http://www.w3.org/2000/01/rdf-schema#"
nodes: []
edges: []
```

The `rdfs` namespace is included by default so subclass relationship edges can use the
compact `rdfs:subClassOf` reference when they are created.

Optional `notes`, `images`, and `labels` sections may be omitted from a newly created
empty diagram because omitted optional list sections are interpreted as empty lists.

# Ontologies

The `ontologies` section shall be a list of ontology file references.

Each item shall be a mapping with:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `path` | string | Yes | Relative path to an ontology file. |

Ontology paths shall be unique within the file after path normalization.

Example:

```yaml
ontologies:
  - path: ontologies/example.ttl
  - path: ontologies/shared.owl
```

# Namespaces

The `namespaces` section shall be a mapping from namespace shortcut to full namespace IRI
or URI.

Example:

```yaml
namespaces:
  ex: https://example.com/ontology#
  xsd: http://www.w3.org/2001/XMLSchema#
```

Namespace keys shall be unique YAML mapping keys and should use short alphanumeric names.

# Nodes

The `nodes` section shall be a list of node mappings.

Each node shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | identifier | Yes | Unique node identifier. |
| `ontology_ref` | ontology reference | Yes | Referenced ontology item. |
| `x` | number | Yes | Left position. |
| `y` | number | Yes | Top position. |
| `width` | number | Yes | Node width. |
| `height` | number | Yes | Node height. |
| `style` | map | No | Node style override. |
| `image` | image source | No | Optional image displayed on the node. |

The referenced ontology item is the ontology item represented by the node. Canvas
behavior specifications define which ontology item types can be created or rendered as
nodes in a given version.

# Edges

The `edges` section shall be a list of edge mappings.

Each edge shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | identifier | Yes | Unique edge identifier. |
| `source` | identifier | Yes | Source node identifier. |
| `target` | identifier | Yes | Target node identifier. |
| `ontology_ref` | ontology reference | Yes | Referenced edge-capable ontology item. |
| `label` | point | Yes | Label position. |
| `points` | list of points | Yes | Edge route coordinates. |
| `style` | map | No | Edge style override. |

`source` and `target` shall reference existing nodes.

Version 1 supports object properties and data properties, plus explicit subclass
relationships, as edge ontology references when the connection satisfies the canvas edge
rules.

Subclass relationship edges shall use `rdfs:subClassOf` as `ontology_ref`; the concrete
subclass and superclass are identified by the edge `source` and `target` nodes. When the
compact `rdfs:subClassOf` reference is used, the `namespaces` section shall define the
`rdfs` prefix.

The `points` list shall contain at least two points:

- The first point represents the source anchor position.
- The last point represents the target anchor position.
- Any intermediate points represent route bends.

The edge style map may contain:

| Field | Type | Description |
|-------|------|-------------|
| `color` | string | Edge line color. |
| `line_style` | string | Line style, such as `solid`, `dashed`, or `dotted`. |
| `weight` | number | Edge line weight. |
| `text_color` | string | Edge label text color. |
| `font` | map | Edge label font settings. |

# Notes

The `notes` section shall be a list of note mappings.

Each note shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | identifier | Yes | Unique note identifier. |
| `x` | number | Yes | Left position. |
| `y` | number | Yes | Top position. |
| `width` | number | Yes | Note width. |
| `height` | number | Yes | Note height. |
| `text` | string | Yes | Note content. |
| `style` | map | No | Note style override. |

Version 1 notes are standalone annotations.

# Images

The `images` section shall be a list of image mappings.

Each image shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | identifier | Yes | Unique image identifier. |
| `x` | number | Yes | Left position. |
| `y` | number | Yes | Top position. |
| `width` | number | Yes | Image width. |
| `height` | number | Yes | Image height. |
| `source` | image source | Yes | Image file path or data URI. |

# Labels

The `labels` section shall be a list of label mappings.

Each label shall contain:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `id` | identifier | Yes | Unique label identifier. |
| `x` | number | Yes | Left position. |
| `y` | number | Yes | Top position. |
| `width` | number | Yes | Label width. |
| `height` | number | Yes | Label height. |
| `text` | string | Yes | Label text. |
| `style` | map | No | Label style override limited to `text_color` and `font` in version 1. |

# Validation Rules

A conforming reader shall validate at least the following rules:

- The document is valid YAML and the root value is a mapping.
- Required top-level sections are present.
- Required fields are present on every element.
- Every element `id` is unique across nodes, edges, notes, images, and labels.
- Every `id` uses the required prefix for its element type.
- Every compact ontology reference uses a namespace prefix defined in `namespaces`.
- Every node and edge ontology reference resolves to an ontology item from a referenced
  ontology file when those ontology files can be loaded, unless the reference is a
  supported built-in ontology predicate allowed by this format.
- In version 1, `rdfs:subClassOf` is a supported built-in edge predicate when the edge
  `source` and `target` nodes resolve to ontology items that can participate in a
  subclass relationship.
- Every edge `source` and edge `target` reference points to an existing node.
- Every bounds object has positive `width` and `height`.
- Every edge has at least two route points.
- Every label `style` map, when present, contains only label-supported style fields.
- Every ontology path and relative image path resolves relative to the `.odiagram` file.

A reader may still open a file with validation errors in a degraded mode, but writers
shall not knowingly persist invalid `.odiagram` content.

# Example

```yaml
metadata:
  schema_version: "1.0"
  title: "Example ontology diagram"
  authors:
    - "Ada Lovelace"
  diagram_version: "0.1.0"
  theme_file: "themes/default.otheme.yml"
  additional:
    project: "Ontology Editor"

ontologies:
  - path: "ontologies/example.ttl"

namespaces:
  ex: "https://example.com/ontology#"
  xsd: "http://www.w3.org/2001/XMLSchema#"

nodes:
  - id: "node_1"
    ontology_ref: "ex:Person"
    x: 80
    y: 120
    width: 160
    height: 80
    style:
      bg_color: "#E6F7FF"

  - id: "node_2"
    ontology_ref: "ex:Organization"
    x: 360
    y: 120
    width: 180
    height: 80

edges:
  - id: "edge_1"
    source: "node_1"
    target: "node_2"
    ontology_ref: "ex:memberOf"
    label:
      x: 250
      y: 100
    points:
      - { x: 240, y: 160 }
      - { x: 360, y: 160 }

notes:
  - id: "note_1"
    x: 80
    y: 250
    width: 220
    height: 80
    text: "Membership is modeled as an object property."

images:
  - id: "image_1"
    x: 360
    y: 250
    width: 120
    height: 90
    source: "images/example-logo.png"

labels:
  - id: "label_1"
    x: 80
    y: 40
    width: 220
    height: 40
    text: "Core model"
```
