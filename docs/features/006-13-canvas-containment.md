# Canvas Containment

An ontology relationship may be presented as spatial containment instead of a visible
connection line. This supports `partOf`, `hasPart`, and equivalent vocabulary-specific
relationships without inferring semantics from the relationship name.

# Choosing Containment

The selected edge's Properties view Style tab shall provide a **Display as** field with
**Connection** and **Containment** choices. Containment shall also require a
**Container** direction:

| Direction | Result |
|-----------|--------|
| `target_contains_source` | The target node is the outer box and the source node is placed inside it. |
| `source_contains_target` | The source node is the outer box and the target node is placed inside it. |

Changing an edge to containment shall persist `render_as: containment` and
`containment_direction`. Changing it back to a connection shall remove both fields.

The selected edge's floating toolbar shall expose the same choice as one atomic
presentation selector. Its containment options shall use the displayed endpoint names,
for example **Project contains Task** and **Task contains Project**, rather than the
structural terms source and target. Combining presentation and direction lets the user
choose the complete containment behavior before the connection line is hidden.

# Layout And Rendering

Containment layout shall be recursive. The editor shall calculate descendant sizes
before ancestor sizes, reserve a header for each container label, place direct children
in a deterministic grid, and expand containers to enclose their direct children with
consistent padding and gaps.

The containment edge line and edge label shall not render. Container nodes shall render
behind their descendants. Moving a container shall move all of its descendants and
persist their resulting absolute coordinates as one bounds update where supported by
the canvas engine.

# Arrange Diagram

Every Arrange Diagram algorithm shall support diagrams containing containment. Before
the selected algorithm runs, the editor shall size nested subtrees from the inside out.
Each top-level containment root, together with all of its descendants, shall then act as
one compound layout unit.

Ordinary relationships that cross compound-unit boundaries shall be projected between
their top-level roots for layout purposes. After layout, each root's position delta shall
be applied to every descendant, internal and external ordinary edges shall be rerouted
against their actual endpoints, and containment edge routes shall remain unchanged.

When a contained node is selected for arrangement, its top-level containment root and
the complete subtree shall be arranged as one unit. Other unselected compound units
shall remain in place.

Because the original edge is hidden, the Style tab of either endpoint node shall list
the containment relationship and provide an action that restores it to an ordinary
connection.

# Validation

Containment is supported only between ontology nodes. Each node may have at most one
distinct container. Self-containment, containment cycles, and a second distinct parent
shall be rejected without modifying the document.

# Export

SVG and PNG exports shall draw containers before descendants and shall omit containment
edge lines, labels, markers, and stale route bounds.
