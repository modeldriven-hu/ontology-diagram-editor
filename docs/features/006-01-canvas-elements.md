# Canvas Elements

This specification defines shared canvas behavior for non-edge diagram elements and
links to element-specific specifications.

# Scope

This specification covers shared display, selection, deletion, keyboard behavior, and
general error handling for nodes, notes, images, and labels.

Element-specific creation, movement, resizing, and editing behavior is defined in:

| Specification | Scope |
|---------------|-------|
| `006-02-canvas-nodes.md` | Creating ontology-backed nodes from the model tree, moving nodes, resizing nodes, and maintaining connected edge endpoints. |
| `006-04-canvas-notes.md` | Adding notes, editing note text, and moving and resizing notes. |
| `006-05-canvas-labels.md` | Adding, editing, moving, resizing, and deleting standalone labels. |
| `006-06-canvas-images.md` | Adding, moving, resizing, and sourcing standalone images. |

Edge-specific behavior is defined in `006-03-canvas-edges.md`. Canvas and local toolbar behavior
is defined in `006-07-canvas-toolbar.md`. Side property panel behavior is defined in
`006-10-canvas-property-panel.md`. Persistence behavior is defined in
`006-09-canvas-persistence.md`.

# Functions

## Display diagram

When a `.odiagram` file is opened in the canvas view, the canvas shall render the current
diagram using the rendering specification.

The canvas shall keep a mapping from each rendered item to its persisted diagram element
identifier. This mapping is used for selection, movement, deletion, toolbar
customization, and persistence.

If the diagram contains validation errors that still allow degraded rendering, the
canvas shall show the valid renderable elements and expose the errors to the user.

If the diagram has no renderable elements, the canvas shall show an empty-canvas state.
The empty state shall make the canvas a valid drop target for ontology items and shall
not require any persisted `.odiagram` fields.

## Select elements

The user can select a diagram element by clicking it on the canvas.

The selected element shall show a visible selection outline. Elements with persisted
bounds, such as nodes, notes, images, and standalone labels, shall show move and resize
affordances. Edges shall show edge label movement affordances.

The user can add or remove nodes, notes, images, and standalone labels from the current
selection by using platform selection modifiers. The user can also select multiple
elements with a marquee selection gesture: dragging the left mouse button across a blank
canvas area displays a selection rectangle and selects every eligible element fully
enclosed by the rectangle.

When multiple bounded elements are selected, keyboard movement shall move those elements
as a single unit. Mouse drag movement for multi-selection is disabled for version 1.
Keyboard movement shall preserve each element's relative position within the selection
and persist as one logical diagram movement. Edges whose source and target elements both
move by the same group offset shall move with the selected elements: their persisted
route points and label point shall be translated by the same offset instead of being
rerouted. Version 1 multi-selection does not provide bulk property editing.

Selecting an element shall emit a `Canvas selection changed` event.

The canvas shall preserve the current selection across rerenders when the selected
element still exists in the opened `.odiagram` file.

## Edit text on canvas

The user shall be able to edit note and standalone label text directly on the canvas.

On-canvas text editing shall start when the user double-clicks a selected note or label,
or presses `Enter` while a note or label is selected and canvas focus is active.

While on-canvas text editing is active:

- Keyboard input shall edit the text field and shall not trigger canvas deletion,
  movement, edge creation, toolbar commands, or other canvas shortcuts.
- Canvas and local toolbar controls shall not intercept text editing shortcuts.
- In-progress text changes shall not rewrite the `.odiagram` file on every keystroke.

For standalone labels, pressing `Enter` shall commit the edit. For notes, pressing
`Enter` shall insert a newline; note text edits shall commit on blur or explicit
confirmation. Pressing `Escape` shall cancel the in-progress edit and restore the last
committed text value.

Committing a text edit shall update the persisted `text` field, emit `Canvas text
edited`, `Diagram document updated`, and `Diagram save requested` events, and persist the
change as one logical edit.

## Navigate viewport

The user can pan and zoom the canvas viewport without changing persisted diagram
coordinates.

The canvas shall provide actions for:

- Zoom in.
- Zoom out.
- Fit diagram to view.
- Reset viewport.

The canvas shall expose these actions through visible canvas controls.

Panning and zooming shall emit `Canvas viewport changed` events. Fitting and resetting
shall also update the viewport and emit the same event.

Viewport changes shall not request persistence and shall not affect undo or redo for
the `.odiagram` document.

## Delete elements

The user can delete the selected element by pressing `Delete`.

Deleting a node shall:

- Remove the node from the `.odiagram` `nodes` section.
- Remove all edges whose `source` or `target` references the removed node.

Deleting an edge shall remove it from the `.odiagram` `edges` section.

Deleting a note, image, or label shall remove it from its corresponding `.odiagram`
section.

Deletion shall emit a `Canvas elements deleted` event and persist the updated
`.odiagram` file.

# Keyboard Behavior

The canvas shall support keyboard deletion of the selected element with `Delete`.

When a node, note, image, standalone label, or edge is selected, the canvas shall support
keyboard movement with the arrow keys. For edges, arrow keys shall move the edge label.
For nodes, notes, images, and standalone labels, arrow keys shall move the selected
element. When multiple movable elements are selected, arrow keys shall move the selected
elements as a group. Holding `Shift` shall use a larger movement step.

The canvas shall support standard undo and redo keyboard shortcuts when focus is in the
canvas and no text field or text editor is actively handling the shortcut. Undo and redo
behavior is defined by the canvas persistence specification.

Keyboard shortcuts shall not interfere with text editing inside notes or labels. When
the user is editing note or label text, `Delete` and `Backspace` shall edit text rather
than delete the selected diagram element.

# Error Handling

The canvas shall tolerate invalid or missing ontology, theme, and image resources using
the degraded rendering behavior defined by the rendering specification.

If a user action would create an invalid `.odiagram` state, the canvas shall reject the
action and leave the document unchanged. Examples include creating an edge without a
source or target node, deleting only one endpoint of an edge route, or resizing an
element to a non-positive size.

If a dragged ontology item cannot be represented on the canvas in version 1, the drop
shall be rejected and no `.odiagram` change shall be written.
