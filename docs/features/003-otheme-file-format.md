# `.otheme` File Format

An `.otheme` file is a YAML document that stores reusable default visual styling for
ontology diagrams. A diagram references a theme file through `metadata.theme_file` in
the `.odiagram` file.

# Scope

This specification defines the persisted theme file format, including the root shape,
supported style fields, inheritance rules, validation requirements, and examples.

Element geometry, ontology references, diagram content, theme references, and
element-level style overrides are defined by the `.odiagram` file format specification.

# File Requirements

- The recommended file extension is `.otheme.yml`.
- `.otheme.yaml`, `.yml`, and `.yaml` are also valid when the file is explicitly
  referenced as a theme.
- The file content shall be valid YAML.
- The YAML document shall contain a single mapping at the root.
- Implementations shall preserve unknown fields when rewriting a theme whenever
  practical.
- Implementations shall treat invalid scalar types, invalid enum values, and invalid
  style value ranges as format errors.

# Top-Level Structure

An `.otheme` file shall contain a top-level `theme` mapping:

```yaml
theme:
  nodes: <node_defaults>
  edges: <edge_defaults>
  notes: <note_defaults>
  labels: <label_defaults>
```

Readers should not require every element block to be present. Omitted blocks mean that
the renderer uses its internal defaults for that element type.

# Theme Definition

A theme definition may contain the following fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `nodes` | map | No | Default style for diagram nodes. |
| `edges` | map | No | Default style for diagram edges and edge labels. |
| `notes` | map | No | Default style for free-form notes. |
| `labels` | map | No | Default style for standalone labels. |

The theme does not define default geometry, positions, ontology references, image
sources, or element identifiers.

Images do not have a theme block in version 1 because their visual appearance is defined
by the referenced image content and their persisted bounds.

# Style Resolution

The effective style for an element is resolved in this order:

1. Renderer internal defaults.
2. Active theme defaults for the element type.
3. Element-level `style` values from the `.odiagram` file.

Style maps are merged by field. If a nested `font` or `border` map is present, its
individual fields override only the matching fields from lower-precedence styles.

For example, an element style of:

```yaml
style:
  font:
    bold: true
```

shall keep the active font family, size, and italic value, while overriding only
`font.bold`.

# Common Style Fields

Nodes and notes may use these common style fields:

| Field | Type | Description |
|-------|------|-------------|
| `bg_color` | string | Fill or background color. |
| `text_color` | string | Text color. |
| `font` | map | Text font settings. |
| `border` | map | Border settings. |

The `font` map may contain:

| Field | Type | Description |
|-------|------|-------------|
| `family` | string | Font family name. |
| `bold` | boolean | Whether text is bold. |
| `italic` | boolean | Whether text is italic. |
| `size` | number | Font size in diagram display points. |

The `border` map may contain:

| Field | Type | Description |
|-------|------|-------------|
| `type` | string | Border type: `solid`, `dashed`, `dotted`, or `none`. |
| `weight` | number | Border weight in diagram canvas units. |
| `color` | string | Border color. |

If `border.type` is `none`, renderers shall not draw a border. `border.weight` and
`border.color` may still be preserved for later edits.

Standalone labels are text-only in version 1. Label theme defaults may use `text_color`
and `font`, but shall not use `bg_color` or `border`.

# Edge Style Fields

Edges may use these style fields:

| Field | Type | Description |
|-------|------|-------------|
| `color` | string | Edge line color. |
| `line_style` | string | Edge line style: `solid`, `dashed`, `dotted`, or `none`. |
| `weight` | number | Edge line weight in diagram canvas units. |
| `text_color` | string | Edge label text color. |
| `font` | map | Edge label font settings. |

If `line_style` is `none`, renderers shall not draw the edge line, but the edge label may
still be rendered unless hidden by another feature.

# Color Values

Color fields shall be strings. Implementations shall support at least:

- Hex RGB: `#RRGGBB`
- Hex RGBA: `#RRGGBBAA`
- CSS `rgb(r, g, b)`
- CSS `rgba(r, g, b, a)`
- Named colors from the CSS color keyword set

Writers should prefer uppercase hex RGB values for opaque colors, for example `#E6F7FF`.

# Value Rules

A conforming theme shall satisfy these rules:

- `font.family` shall be a non-empty string.
- `font.size` shall be greater than `0`.
- `font.bold` and `font.italic` shall be booleans.
- `border.type` shall be `solid`, `dashed`, `dotted`, or `none`.
- `border.weight` shall be greater than or equal to `0`.
- `line_style` shall be `solid`, `dashed`, `dotted`, or `none`.
- `weight` shall be greater than or equal to `0`.
- Color fields shall be parseable color strings.

Unknown fields are allowed for forward compatibility. Readers shall ignore unknown fields
they do not understand, and writers should preserve them whenever practical.

# Validation Rules

A conforming reader shall validate at least the following rules:

- The document is valid YAML and the root value is a mapping.
- A standalone theme file contains a `theme` mapping.
- The top-level `theme` value is a mapping.
- Known element blocks are mappings when present.
- Known nested style fields have the expected scalar or mapping type.
- Enum values and numeric ranges satisfy the value rules above.
- The `labels` block contains only label-supported style fields.

A reader may still open a theme with validation errors in a degraded mode, but writers
shall not knowingly persist invalid `.otheme` content.

# Example Theme

```yaml
theme:
  nodes:
    bg_color: "#E6F7FF"
    text_color: "#102A43"
    border:
      type: solid
      weight: 1.5
      color: "#1890FF"
    font:
      family: "Arial"
      bold: true
      italic: false
      size: 12

  edges:
    color: "#595959"
    line_style: solid
    weight: 1.25
    text_color: "#333333"
    font:
      family: "Arial"
      bold: false
      italic: false
      size: 10

  notes:
    bg_color: "#FFFBE6"
    text_color: "#3D2C00"
    border:
      type: dashed
      weight: 1
      color: "#FAAD14"
    font:
      family: "Tahoma"
      bold: false
      italic: true
      size: 10

  labels:
    text_color: "#000000"
    font:
      family: "Helvetica"
      bold: true
      italic: false
      size: 9
```
