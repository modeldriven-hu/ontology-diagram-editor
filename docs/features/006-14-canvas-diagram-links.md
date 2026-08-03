# Canvas Diagram Links

This specification defines canvas elements that navigate to another ontology diagram.

# Persistence

Linked diagrams shall be stored in the optional `diagram_links` list. Each link shall
have a unique `link_` identifier, bounds (`x`, `y`, `width`, and `height`), and a
non-empty `diagram_ref` ending in `.odiagram`. The reference shall be a path relative
to the directory containing the current diagram and shall use forward slashes when the
editor creates it. An optional embedded data-image `icon` may override the built-in
diagram icon.

# Creation And Presentation

The canvas toolbar shall provide an Add Linked Diagram action. It shall let the user
choose an `.odiagram` file and persist its relative reference. The canvas element shall
show the built-in diagram icon by default and the referenced filename without its
`.odiagram` suffix as its label. The element container shall have no visible background,
border, or shadow; selection and resize affordances may still outline its bounds.

# Navigation And Editing

Double-clicking a diagram link or activating Open Linked Diagram in its local element
toolbar shall open the resolved diagram in VS Code. A missing target shall produce an
error without changing either diagram.

The Properties view shall allow the user to edit the relative reference directly or
choose another diagram file. It shall also allow choosing an embedded custom icon and
restoring the built-in default icon.

# Geometry, Deletion, And Export

Diagram links shall support selection, movement, resizing with minimum dimensions,
keyboard nudging, multi-selection deletion, viewport fitting, and SVG/PNG export.
