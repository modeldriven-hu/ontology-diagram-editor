# Rendering of the Diagram

Rendering turns a validated `.odiagram` document, the ontology metadata loaded from its
referenced ontology files, and an optional `.otheme` file into a visual diagram.

# Scope

This specification defines how diagram content is converted into a rendered scene,
including input loading, style resolution, layout interpretation, draw order, text
generation, image handling, and error behavior.

The persisted `.odiagram` and `.otheme` formats are defined in separate feature
specifications. Rendering shall not introduce additional persisted fields. Editor
interaction, selection, dragging, command handling, and model tree behavior are defined
in separate feature specifications.

# Rendering Environment

The renderer shall run in the Visual Studio Code webview and produce an interactive
diagram view for the opened `.odiagram` file.

# Rendering Inputs

The renderer receives:

- The absolute path of the `.odiagram` file.
- The parsed `.odiagram` document.
- Loaded ontology metadata for ontology files referenced by the `.odiagram` file.
- The active theme, if `metadata.theme_file` is present and can be loaded.
- The selected theme mode from `metadata.theme_mode`, if present; otherwise an
  implementation-defined light or dark preference.
- Renderer internal defaults.
- The webview drawing surface.

Relative paths in the `.odiagram` file and in the referenced theme shall be resolved
relative to the `.odiagram` file unless the referenced feature specification defines a
more specific rule.

# Scene Construction

The renderer shall construct an in-memory scene from the diagram document before drawing.
The scene shall contain renderable items for:

- Nodes.
- Edges.
- Notes.
- Images.
- Standalone labels.
- Edge labels.

The scene shall preserve the persisted element identifiers so that editor features can
map rendered items back to `.odiagram` elements.

If the `.odiagram` file contains validation errors, the renderer may still construct a
partial scene when the invalid content can be isolated. It shall not silently reinterpret
invalid references, invalid geometry, or invalid scalar types.

# Coordinate System

Diagram coordinates use a two-dimensional canvas coordinate system:

- The origin `(0, 0)` is at the top-left of the diagram canvas.
- The positive `x` axis extends to the right.
- The positive `y` axis extends downward.
- One diagram canvas unit corresponds to one CSS pixel at 100% zoom in the Visual Studio
  Code webview.

# Canvas Bounds

The renderer shall compute the diagram bounds from all visible renderable geometry:

- Node bounds.
- Note bounds.
- Image bounds.
- Label bounds.
- Edge route points and edge label bounds.

If the diagram contains no renderable elements, the renderer shall use an empty canvas
with an implementation-defined minimum size.

The Visual Studio Code webview may allow panning beyond the computed bounds, but the
diagram content itself shall remain positioned according to the persisted coordinates.

# Style Resolution

The effective style for each renderable element shall be resolved in this order:

1. Renderer internal defaults.
2. Built-in defaults for the selected light or dark mode.
3. Active theme base defaults for the element type.
4. Active theme defaults for the selected light or dark mode.
5. Element-level `style` values from the `.odiagram` file.

Style maps shall be merged by field. Nested `font` and `border` maps shall be merged by
their individual fields, as defined by the `.otheme` format specification. Common style
fields such as `corner_radius` and `shadow` shall inherit from the active theme unless
an element-level style overrides them.

The canvas background shall use the active theme's `canvas.bg_color` value for the
selected light or dark mode when present.

The selected light or dark mode shall affect built-in defaults and mode-specific theme
overrides. Switching modes shall not change element coordinates or dimensions.

If no theme file is referenced, if the referenced theme file is missing, or if the theme
cannot be parsed, the renderer shall use internal defaults and any element-level style
overrides.

The renderer shall expose theme loading errors to the user in the Visual Studio Code
webview. A theme loading error shall not prevent rendering.

# Internal Defaults

The renderer shall define internal defaults for every style value required to draw a
complete diagram. Defaults should be visually neutral and readable on a light background.

At minimum, internal defaults shall define:

| Element type | Required defaults |
|--------------|-------------------|
| Nodes | Background color, text color, border, font. |
| Edges | Line color, line style, line weight, label text color, label font. |
| Notes | Background color, text color, border, font. |
| Labels | Text color and font. |
# Text Resolution

The renderer shall display human-readable labels for ontology-backed elements.

For nodes, the display text shall be resolved in this order:

1. A preferred human label from the loaded ontology metadata, when available.
2. A compact qualified name using `.odiagram` namespace shortcuts, when possible.
3. The local name extracted from the ontology IRI or URI, when possible.
4. The original `ontology_ref` string.

For edges, the label text shall be resolved using the same order, based on the edge
`ontology_ref`.

For notes and standalone labels, the renderer shall use the persisted `text` field.
Note text may be rendered as basic rich text, as defined in the Notes section.

If ontology metadata cannot be loaded, ontology-backed nodes and edges shall still render
using namespace shortcuts, local names, or the original ontology reference.

# Text Layout

Text shall be rendered using the effective `font` and `text_color` fields for the
element.

Node and note text shall be placed within the element bounds with internal padding.
Implementations should use a default padding of `8` diagram canvas units unless a later
style specification defines padding explicitly.

Text inside nodes and notes shall wrap when it exceeds the available width. Explicit
newline characters in note text shall create line breaks. If the text does not fit
vertically after wrapping, the renderer shall clip or elide the overflow in a
deterministic way. It shall not resize persisted element bounds during rendering.

Standalone labels shall render text within their persisted bounds and follow the same
wrapping and clipping expectations as other bounded text elements. Edge labels do not
have persisted width or height; their rendered bounds shall be calculated from their
text, font, and implementation-defined padding.

# Nodes

Each item in the `.odiagram` `nodes` section shall render as a rectangular node at its
persisted `x`, `y`, `width`, and `height`.

The node fill shall use `bg_color`. The node border shall use the effective `border`
style. If `border.type` is `none` or `border.weight` is `0`, no visible border shall be
drawn.

If the node has an `image` field, the image shall be rendered inside the node bounds. The
node text shall remain visible unless a later specification defines image-only nodes.
Implementations may reserve part of the node interior for the image or render the image
as a background with suitable opacity. The chosen behavior shall be consistent within a
renderer.

If the node has `show_data_properties: true`, the renderer shall display available data
properties whose domain matches the node ontology reference. The renderer shall keep the
primary node label visible and render matching data properties in a separate attribute
area. If the attribute area cannot show every data property, it shall show a
deterministic overflow indicator rather than resizing the node during rendering.

# Edges

Each item in the `.odiagram` `edges` section shall render as a routed line following the
persisted `points` list.

The renderer shall draw straight line segments between consecutive points. The first
point represents the source anchor, and the last point represents the target anchor.
Intermediate points represent route bends.

The edge line shall use the effective `color`, `line_style`, and `weight` values. If
`line_style` is `none` or `weight` is `0`, no visible line shall be drawn, but the edge
label may still be rendered.

The renderer should draw a directional marker at the target end of an edge by default,
because `.odiagram` edges represent directed relationships from `source` to `target`.
The marker shall use the effective edge line color. A later style specification may make
marker shape and visibility configurable.

The edge label shall render at the persisted `label` point. The label point represents
the top-left position of the label text box. The label shall use the edge label font and
`text_color`.

Note connection edges shall render without ontology relationship arrowheads and without
an edge label by default.

# Notes

Each item in the `.odiagram` `notes` section shall render as a rectangular annotation at
its persisted `x`, `y`, `width`, and `height`.

The note fill shall use `bg_color`. The note border shall use the effective `border`
style. The note text shall use the note font and `text_color`.

If a note has `export: false`, the interactive canvas shall still render the note and
should show a non-intrusive indicator that the note is excluded from exports.

Note text shall support plain text with preserved newlines. The following newline
sequences shall be treated as line breaks:

- Line feed: `\n`
- Carriage return: `\r`
- Carriage return followed by line feed: `\r\n`

Note text may contain a basic HTML fragment. Renderers shall support at least these HTML
elements in notes:

| Element | Rendering behavior |
|---------|--------------------|
| `br` | Line break. |
| `p` | Paragraph block with separation from adjacent paragraphs. |
| `div` | Block with a line break before and after when needed. |
| `b`, `strong` | Bold text. |
| `i`, `em` | Italic text. |
| `u` | Underlined text. |
| `code` | Inline monospace text. |
| `ul`, `ol`, `li` | Basic unordered and ordered lists. |

HTML entities in note text shall be decoded before rendering. Text outside HTML tags
shall be preserved, including explicit newlines.

The renderer shall treat note HTML as a sanitized fragment, not as an arbitrary web
document. It shall not execute scripts, load remote resources from note HTML, apply
inline event handlers, or allow note HTML to affect content outside the note bounds.
Unsupported HTML elements shall be ignored while their text content is preserved where
practical.

Style attributes in note HTML should be ignored in version 1. The note's effective theme
and element-level style remain the base visual style. Supported formatting tags may
adjust font weight, font style, underline, list indentation, paragraph spacing, and
inline monospace presentation within the note.

# Images

Each item in the `.odiagram` `images` section shall render the referenced image at its
persisted `x`, `y`, `width`, and `height`.

Image sources shall be loaded from either a data URI or a path resolved relative to the
`.odiagram` file.

Images shall preserve their aspect ratio by default and fit within the persisted bounds.
If the image aspect ratio differs from the bounds, the renderer should center the image
within the bounds and leave transparent or background-colored space. The renderer shall
not change the persisted bounds.

If an image cannot be loaded, the renderer shall draw a placeholder within the image
bounds and expose the load error to the user.

# Standalone Labels

Each item in the `.odiagram` `labels` section shall render the persisted `text` at the
persisted `x` and `y` position.

The label position represents the top-left position of the label text box. Labels shall
use the effective label font and `text_color`. Labels do not draw a background or border
unless a later style specification adds those fields.

# Draw Order

The renderer shall use a deterministic draw order. In version 1, elements shall be drawn
in the following order:

1. Images.
2. Edges.
3. Nodes.
4. Notes.
5. Standalone labels.
6. Edge labels.

Within each element category, items shall be drawn in the order in which they appear in
the `.odiagram` file.

This ordering keeps relationship lines behind primary diagram boxes while keeping labels
and annotation text readable.

# Ontology Reference Handling

The renderer shall resolve compact ontology references using the `.odiagram`
`namespaces` section. Resolved references shall be matched against the loaded ontology
metadata when available.

If an ontology reference cannot be resolved to a loaded ontology item, the element
shall render in degraded mode using the best available text fallback. The renderer should
mark the element with a non-intrusive warning state in the Visual Studio Code webview.

The webview shall report unresolved ontology references as warnings.

# Validation and Degraded Rendering

The renderer shall distinguish between errors that prevent rendering and errors that
allow degraded rendering.

Rendering shall fail when:

- The `.odiagram` file cannot be parsed as YAML.
- The root document is not a mapping.
- Required sections needed for scene construction have invalid types.
- Element geometry contains non-numeric positions or non-positive sizes.
- Edge route points contain invalid coordinates.

Rendering may continue in degraded mode when:

- A referenced ontology file cannot be loaded.
- A referenced theme file cannot be loaded.
- An image cannot be loaded.
- An ontology reference is syntactically valid but missing from loaded ontology metadata.
- Note HTML contains unsupported or invalid markup that can be sanitized.

In degraded mode, valid independent elements shall still render where possible.

# Webview Rendering Behavior

In the Visual Studio Code webview, rendering shall update when:

- The `.odiagram` file is opened in the diagram view.
- The `.odiagram` document changes.
- The active theme file changes.
- A referenced ontology file changes and ontology metadata is reloaded.
- A referenced image file changes.

The webview renderer shall preserve the user's viewport state, such as zoom and pan,
when rerendering the same diagram where practical.

The webview may render editor-only affordances such as selection outlines, hover states,
resize handles, route handles, drag previews, and validation badges.

# Accessibility

The Visual Studio Code webview should expose useful accessible names for rendered
diagram elements.

Accessible names should use:

- Node display text for nodes.
- Edge display text plus source and target display text for edges.
- Note text for notes.
- Label text for standalone labels.
- Image source or alternative metadata when available for images.

The webview should expose validation warnings and load errors in a way that is available
to keyboard and screen reader users.

# Performance

The renderer should avoid reparsing unchanged inputs. In the Visual Studio Code
environment, it should reuse parsed `.odiagram`, `.otheme`, ontology metadata, and image
assets when their source files have not changed.

The renderer should support diagrams with hundreds of nodes and edges without blocking
the extension host for long-running work. Expensive parsing, rasterization, and image
loading should be asynchronous where the platform allows.

# Non-Goals for Version 1

Version 1 rendering does not define:

- Automatic layout of nodes or edges.
- Collision avoidance.
- Theme-defined geometry, padding, markers, or z-index values.
- Embedded theme definitions in `.odiagram` files.
- Ontology import resolution beyond directly referenced ontology files.
- Animated rendering.
- Semantic styling based on ontology item type beyond the active theme and explicit
  element style overrides.
