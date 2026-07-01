# Canvas Notes

This specification defines canvas behavior for free-form notes.

# Scope

This specification covers adding notes, editing note text, moving notes, resizing
notes, and deleting notes.

# Add Notes

The canvas shall provide a command for adding a note.

When the user adds a note, the canvas shall create an item in the `.odiagram` `notes`
section. The new note shall:

- Use a generated unique `id` using the `note_` prefix.
- Store the insertion position as `x` and `y`.
- Store default width and height selected by the implementation.
- Store the user-entered note content as `text`.
- Omit `style` unless the user customizes the note.

# Edit Note Text

The user shall be able to edit the note text after creation.

Note text can include newlines and the basic note HTML supported by the rendering
specification. Editing note text shall update the persisted `text` field.

In version 1, note HTML shall be edited as raw text. The canvas shall
not provide rich-text formatting controls for authoring note HTML.

On-canvas note text editing shall follow the shared text editing behavior defined in
`006-01-canvas-elements.md`.

# Move Notes

The user can move a note by dragging the selected note.

Moving a note shall update its persisted `x` and `y` fields. The canvas shall keep the
note dimensions unchanged.

In version 1, notes are standalone annotations and do not have editable
connections to other elements.

# Resize Notes

The user can resize a note by dragging resize handles.

Resizing a note shall update its persisted `width` and `height` fields. If the resize
handle changes the top or left edge, the persisted `x` or `y` field shall also be
updated.

The canvas shall enforce a positive width and height and minimum dimensions that keep
note text and handles usable.

# Delete Notes

The user can delete a selected note from the canvas.

When the user requests note deletion, the editor shall ask for confirmation before
modifying the `.odiagram` document. If the user confirms, the note shall be removed
from the `notes` section. If the user cancels, the document shall remain unchanged.
