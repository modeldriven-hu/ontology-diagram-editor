# Canvas Labels

This specification defines canvas behavior for standalone labels.

# Scope

This specification covers adding labels, editing label text, and moving labels.

# Add Labels

The canvas shall provide a command for adding a standalone label.

When the user adds a label, the canvas shall create an item in the `.odiagram` `labels`
section. The new label shall:

- Use a generated unique `id` using the `label_` prefix.
- Store the insertion position as `x` and `y`.
- Store the user-entered text as `text`.
- Omit `style` unless the user customizes the label.

# Edit Label Text

The user shall be able to edit the label text after creation. Editing label text shall
update the persisted `text` field.

On-canvas label text editing shall follow the shared text editing behavior defined in
`006-01-canvas-elements.md`.

# Move Labels

The user can move a label by dragging the selected label.

Moving a label shall update its persisted `x` and `y` fields.

Version 1 labels do not have persisted width or height and therefore are not resized
directly. Their rendered bounds are derived from text and font.
