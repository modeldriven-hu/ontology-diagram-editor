# Canvas Containment

An ontology relationship may be presented as spatial containment instead of a visible
connection line. This supports `partOf`, `hasPart`, and equivalent vocabulary-specific
relationships without inferring semantics from the relationship name.

# Choosing Containment

The selected edge's Properties view shall provide a **Display as** field with
**Connection** and **Containment** choices. Containment shall also require a
**Container** direction:

| Direction | Result |
|-----------|--------|
| `target_contains_source` | The target node is the outer box and the source node is placed inside it. |
| `source_contains_target` | The source node is the outer box and the target node is placed inside it. |

Changing an edge to containment shall persist `render_as: containment` and
`containment_direction`. Changing it back to a connection shall remove both fields.

# Layout And Rendering

Containment layout shall be recursive. The editor shall calculate descendant sizes
before ancestor sizes, reserve a header for each container label, place direct children
in a deterministic grid, and expand containers to enclose their direct children with
consistent padding and gaps.

The containment edge line and edge label shall not render. Container nodes shall render
behind their descendants. Moving a container shall move all of its descendants and
persist their resulting absolute coordinates as one bounds update where supported by
the canvas engine.

Because the original edge is hidden, the Ontology tab of either endpoint node shall list
the containment relationship and provide an action that restores it to an ordinary
connection.

# Validation

Containment is supported only between ontology nodes. Each node may have at most one
distinct container. Self-containment, containment cycles, and a second distinct parent
shall be rejected without modifying the document.

# Export

SVG and PNG exports shall draw containers before descendants and shall omit containment
edge lines, labels, markers, and stale route bounds.
