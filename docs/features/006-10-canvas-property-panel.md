# Canvas Property Panel

This specification defines the property panel used to inspect and edit the selected
canvas element.

# Scope

This specification covers property panel visibility, selection behavior, supported
fields, element-level style overrides, validation, and persistence. It does not define
theme file editing, ontology source editing, or canvas toolbar behavior.

# Property Panel

The canvas shall provide a property panel docked to the side of the canvas view.

The panel shall be collapsible. When expanded, it shall use a stable docked layout and
shall not cover the selected element without allowing the user to pan or scroll the
canvas to keep working.

The user shall be able to resize the panel width within minimum and maximum limits set
by the implementation. The panel collapsed or expanded state and width are
editor-only state and shall not be persisted to the `.odiagram` file.

# Selection Behavior

The property panel shall update when the selected canvas element changes.

When no element is selected, the panel shall show diagram-level read-only context, such
as the diagram title, file path, referenced ontologies, and active theme file. Version 1
does not require editing diagram metadata from the property panel.

When one element is selected, the panel shall show the element type, identifier, and
supported properties for that element type. The identifier shall be read-only in
version 1.

Version 1 shall support single-selection properties.

# Displayed And Editable Properties

The property panel shall expose useful element context and a minimal set of persisted
fields that benefit from precise inspection or typed editing.

The panel shall display these read-only fields in version 1:

| Element type | Read-only fields |
|--------------|------------------|
| Node | `id`, `ontology_ref`, effective label or display name. |
| Edge | `id`, `ontology_ref`, `source`, `target`, effective label or display name. |
| Note | `id`. |
| Label | `id`. |
| Image | `id`. |

The panel shall expose these non-style editable fields in version 1:

| Element type | Editable fields |
|--------------|-----------------|
| Node | `x`, `y`, `width`, `height`, `image`. |
| Edge | None. |
| Note | `text`, `x`, `y`, `width`, `height`. |
| Label | `text`, `x`, `y`, `width`, `height`. |
| Image | `source`, `x`, `y`, `width`, `height`. |

Edge properties are inspection-only. Edge endpoints, route `points`, and label position
shall not be edited through property panel fields. Edge label position shall be edited
through canvas gestures.

Node `image` fields and standalone image `source` fields shall use the same image
source rules. The property panel shall provide a file picker for choosing a local image
file for either field and persist the selected image as an embedded data URI. The panel
shall allow direct text entry for data URI or relative file-path image sources. Remote
URL image sources are not supported in version 1.

The panel shall display effective read-only values when a field is derived from the
ontology, renderer, or active theme rather than stored directly on the element.

The panel shall not expose direct editing for element identifiers, ontology references,
edge endpoints, or edge route `points` and edge label position in
version 1. Those values are structural and shall be edited through canvas gestures or
model tree actions. Note connection fields are not part of the version 1 `.odiagram`
file format.

The panel shall also expose element-level style override fields for styled elements:

| Element type | Editable style fields |
|--------------|-----------------------|
| Node | Background color, text color, font family, font size, bold, italic, border type, border weight, border color, corner radius, drop shadow. |
| Edge | Line color, line style, line weight, label text color, font family, font size, bold, italic. |
| Note | Background color, text color, font family, font size, bold, italic, border type, border weight, border color, corner radius, drop shadow. |
| Label | Text color, font family, font size, bold, italic. |
| Image | None. |

Style edits shall update only the selected element's `style` map in the `.odiagram`
file. The property panel shall not modify the active `.otheme` file.

The property panel shall provide a way to clear all style overrides for the selected
element. If a style field is cleared, the renderer shall fall back to the active theme or
internal defaults for that field.

The panel shall group fields into sections for identity, ontology, geometry, text,
image, and style. Section grouping is presentation behavior and shall not affect
persistence.

# Validation

The property panel shall validate edits before writing them to the `.odiagram` document.

The panel shall reject edits that would create an invalid diagram state. Examples
include non-positive dimensions, invalid image sources, unsupported style enum values,
negative line or border weights, non-positive font sizes, and text values that exceed
configured text length limits.

When an edit is rejected, the panel shall leave the persisted document unchanged and
show the validation problem near the edited field.

# Persistence

Completed property panel edits shall update the opened `.odiagram` document and follow
the canvas persistence specification.

Each committed field edit shall be persisted as one logical document change where the
Visual Studio Code document model allows it. Text fields shall commit on blur or Enter.
Picker fields shall commit when the user confirms a selection. Incomplete text entry
shall not rewrite the `.odiagram` file on every keystroke.

Property panel edits shall emit `Canvas property edited`, `Diagram document updated`, and
`Diagram save requested` events. When the edited field is also covered by a more specific
canvas event, such as `Canvas text edited`, the implementation shall emit the more
specific event as well.

# Keyboard Behavior

Keyboard input focused inside the property panel shall edit panel fields and shall not
trigger canvas deletion, movement, edge creation, or other canvas shortcuts.

Pressing `Escape` while a property field is being edited shall cancel the in-progress
field edit and restore the last committed value. Pressing `Escape` outside an active
field edit shall return focus to the canvas.

# Error Handling

If the selected element is removed by another canvas action or file update while the
panel is open, the panel shall clear the stale selection and show the no-selection
state.

If the `.odiagram` file changes externally, the panel shall refresh displayed values
from the latest document and avoid overwriting newer values with stale field contents.

If persistence fails, the panel shall keep the user-visible value consistent with the
current text document state and clearly mark the save failure, following the canvas
persistence specification.
