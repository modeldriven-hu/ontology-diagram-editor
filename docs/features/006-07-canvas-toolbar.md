# Canvas Toolbar

This specification defines the canvas-level toolbar used for global diagram actions.
Element inspection, geometry editing, image source editing, and element-level style
customization are handled by the property panel.

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
| Zoom out | Decreases canvas zoom without changing persisted coordinates. |
| Zoom in | Increases canvas zoom without changing persisted coordinates. |
| Fit diagram to view | Fits all rendered content in the visible viewport. |
| Reset viewport | Resets zoom and pan to the implementation-defined default. |
| Toggle light/dark mode | Switches the canvas rendering palette between light and dark mode without changing persisted diagram geometry. |

Toolbar buttons shall be disabled or shall show a concise user-visible problem when the
action cannot be completed. For example, exporting an empty diagram shall not create an
empty export file.

# Style Editing

Version 1 does not use a floating toolbar for element-level style customization.
Element style overrides are edited in the selected element's property panel.
