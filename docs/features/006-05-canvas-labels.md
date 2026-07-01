# Canvas Labels

This specification defines canvas behavior for standalone labels.

# Scope

This specification covers adding labels, editing label text, moving labels, resizing
labels, and deleting labels.

# Add Labels

The canvas shall provide a command for adding a standalone label.

When the user adds a label, the canvas shall create an item in the `.odiagram` `labels`
section. The new label shall:

- Use a generated unique `id` using the `label_` prefix.
- Store the insertion position as `x` and `y`.
- Store default width and height selected by the implementation.
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

# Resize Labels

The user can resize a label by dragging resize handles.

Resizing a label shall update its persisted `width` and `height` fields. If the resize
handle changes the top or left edge, the persisted `x` or `y` field shall also be
updated.

The canvas shall enforce a positive width and height and minimum dimensions that keep
label text and handles usable.

# Delete Labels

The user can delete a selected label from the canvas.

When the user requests label deletion, the editor shall ask for confirmation before
modifying the `.odiagram` document. If the user confirms, the label shall be removed
from the `labels` section. If the user cancels, the document shall remain unchanged.
