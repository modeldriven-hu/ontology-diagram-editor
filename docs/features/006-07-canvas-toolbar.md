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
| Undo | Requests undo for the current `.odiagram` document edit. |
| Redo | Requests redo for the current `.odiagram` document edit. |
| Export SVG | Saves the diagram as an SVG export, as defined in `006-11-canvas-export.md`. |
| Export PNG | Saves the diagram as a PNG export, as defined in `006-11-canvas-export.md`. |
| Layout algorithm | Selects the algorithm used by Arrange Diagram without changing diagram content. |
| Arrange diagram | Automatically positions ontology-backed nodes with the selected algorithm and reroutes connected edges. |
| Zoom out | Decreases canvas zoom without changing persisted coordinates. |
| Zoom in | Increases canvas zoom without changing persisted coordinates. |
| Fit diagram to view | Fits all rendered content in the visible viewport. |
| Reset viewport | Resets zoom and pan to the implementation-defined default. |
| Select corresponding model-tree item | Reveals the selected ontology-backed node or edge in the model tree when a matching item exists. |
| Toggle light/dark mode | Switches the canvas rendering palette between light and dark mode without changing persisted diagram geometry. |

Toolbar buttons shall be disabled or shall show a concise user-visible problem when the
action cannot be completed. For example, exporting an empty diagram shall not create an
empty export file.

Toolbar action groups shall be visually separated where this improves scanning. In
version 1, creation, edit history, export, layout, viewport, model-tree reveal, and
theme-mode actions are separate toolbar groups.

# Arrange Diagram

The arrange diagram action shall update only diagram geometry. It shall preserve ontology
references, element identifiers, text, style overrides, images, notes, standalone labels,
and theme settings.

Arranging the diagram shall:

- Allow the user to select from the available layout algorithms.
- Provide a deterministic left-to-right directed-layers layout derived from
  ontology-backed edges, an ELK layered layout with orthogonal edge routing, and a
  deterministic grid layout.
- Preserve each node's persisted width and height.
- Reroute connected edges so endpoints remain on element boundaries.
- Update edge label positions to reasonable route midpoints.
- Persist the result as one logical `.odiagram` document edit.

The selected layout algorithm is viewport state rather than diagram content. Changing the
selection alone shall not modify the `.odiagram` document.

If the diagram has no ontology-backed nodes, the toolbar action shall be disabled or show
a concise user-visible problem without changing the `.odiagram` document.

# Theme Mode

The theme-mode action shall toggle between light and dark render modes. The canvas shall
rerender using the selected mode while preserving the selected element where practical.

Changing the mode shall persist the selected value to `metadata.theme_mode` in the
opened `.odiagram` file. The action shall not edit the referenced `.otheme` file.

# Style Editing

Version 1 does not use the canvas toolbar or local element toolbar for element-level
style customization. Element style overrides are edited in the selected element's
property panel.

# Local Element Toolbar

When a selected element has local actions, the canvas may show a small toolbar above
that element.

Version 1 local toolbar actions are:

| Selection | Actions |
|-----------|---------|
| Node | Resize to minimum; create note from ontology comment when a comment is available; show related elements to a selected relationship depth. |
| Note | Resize to compact size and connect note. |
| Image | Resize to minimum. |
| Label | Resize to minimum. |
| Edge | Optimize edge path and remove edge. |

The show-related-elements node action shall ask the user for a relationship depth. It
shall add unambiguous connection-capable object property, data property, and subclass
relationship endpoints reachable from the selected node up to that depth. Existing
nodes and edges shall not be duplicated. The expansion shall be persisted as one
logical `.odiagram` document edit.

The local toolbar shall be hidden while on-canvas note or label text editing is active.
