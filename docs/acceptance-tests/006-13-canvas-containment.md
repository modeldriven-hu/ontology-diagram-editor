# Acceptance Tests: Canvas Containment

- Given an ordinary node-to-node edge, when **Display as** is changed to
  **Containment** with **Target contains source**, then the target expands as needed and
  the source is laid out inside it.
- Given an ordinary node-to-node edge, when **Display as** is changed to
  **Containment** with **Source contains target**, then the source expands as needed and
  the target is laid out inside it.
- Given nested containment relationships, when containment layout runs, then descendant
  containers are sized before their ancestors and every descendant remains inside its
  direct parent.
- Given a container is moved, when the move is persisted, then all descendants move by
  the same delta.
- Given a containment relationship is active, when either endpoint node's Ontology tab
  is opened, then the relationship and an action to restore it as a connection are
  available.
- Given a relationship would assign a child to a second distinct parent, when
  containment is requested, then the document is unchanged and a concise validation
  message is shown.
- Given a relationship would create self-containment or a containment cycle, when
  containment is requested, then the document is unchanged and a concise validation
  message is shown.
- Given a diagram contains containment edges, when SVG or PNG is exported, then
  containers render behind descendants and containment lines, labels, markers, and
  stale route bounds are absent.
