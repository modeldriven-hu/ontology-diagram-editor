# Canvas Toolbar

This specification defines the canvas-level toolbar used for global diagram actions.
Element inspection, geometry editing, image source editing, and element-level style
customization are handled by the property panel. Selected elements may also show a
small local toolbar for element-specific actions.

# Scope

This specification covers toolbar visibility, supported canvas actions, and viewport
controls. It does not define selected-element property editing or theme file editing.

# Canvas Actions

The canvas shall show a toolbar over the canvas viewport. The toolbar shall remain
visible while the user pans, scrolls, or zooms the diagram.

Version 1 toolbar actions are:

| Action | Result |
|--------|--------|
| Add note | Opens the note text entry flow and creates a note. |
| Add label | Opens the label text entry flow and creates a standalone label. |
| Add image | Opens the image picker and creates a standalone image. |
| Export SVG | Saves the diagram as an SVG export. |
| Export PNG | Saves the diagram as a PNG export. |
| Arrange diagram | Automatically positions ontology-backed nodes and reroutes connected edges. |
| Zoom out | Decreases canvas zoom without changing persisted coordinates. |
| Zoom in | Increases canvas zoom without changing persisted coordinates. |
| Fit diagram to view | Fits all rendered content in the visible viewport. |
| Reset viewport | Resets zoom and pan to the implementation-defined default. |
| Toggle light/dark mode | Switches the canvas rendering palette between light and dark mode without changing persisted diagram geometry. |

Toolbar buttons shall be disabled or shall show a concise user-visible problem when the
action cannot be completed. For example, exporting an empty diagram shall not create an
empty export file.

Toolbar action groups shall be visually separated where this improves scanning. In
version 1, creation, export, layout, viewport, model-tree reveal, and theme-mode actions
are separate toolbar groups.

# Arrange Diagram

The arrange diagram action shall update only diagram geometry. It shall preserve ontology
references, element identifiers, text, style overrides, images, notes, standalone labels,
and theme settings.

Arranging the diagram shall:

- Position ontology-backed nodes in a deterministic left-to-right layout derived from
  directed ontology-backed edges.
- Preserve each node's persisted width and height.
- Reroute connected edges so endpoints remain on element boundaries.
- Update edge label positions to reasonable route midpoints.
- Persist the result as one logical `.odiagram` document edit.

If the diagram has no ontology-backed nodes, the toolbar action shall be disabled or show
a concise user-visible problem without changing the `.odiagram` document.

# Style Editing

Version 1 does not use a floating toolbar for element-level style customization.
Element style overrides are edited in the selected element's property panel.

# Local Element Toolbar

When a selected element has local actions, the canvas may show a small toolbar above
that element.

Version 1 local toolbar actions are:

| Selection | Actions |
|-----------|---------|
| Node | Resize to minimum. |
| Note | Resize to compact size and connect note. |
| Image | Resize to minimum. |
| Label | Resize to minimum. |
| Edge | Remove edge. |
