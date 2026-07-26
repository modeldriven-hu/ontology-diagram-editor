# Acceptance Tests: Canvas Containment

- Given an ordinary node-to-node edge, when **Display as** is changed on the Style tab to
  **Containment** with **Target contains source**, then the target expands as needed and
  the source is laid out inside it.
- Given an ordinary node-to-node edge, when **Display as** is changed to
  **Containment** with **Source contains target**, then the source expands as needed and
  the target is laid out inside it.
- Given an ordinary node-to-node edge is selected, when either containment direction is
  chosen from the floating toolbar, then the presentation and direction are applied as
  one operation before the edge line is hidden.
- Given the selected edge connects nodes displayed as **Task** and **Project**, when the
  floating presentation selector opens, then its containment choices read **Project
  contains Task** and **Task contains Project**.
- Given nested containment relationships, when containment layout runs, then descendant
  containers are sized before their ancestors and every descendant remains inside its
  direct parent.
- Given a container is moved, when the move is persisted, then all descendants move by
  the same delta.
- Given a diagram contains one or more containment trees, when Arrange Diagram is run
  with any supported algorithm, then each top-level tree is arranged as one compound
  unit and every descendant remains inside its direct parent.
- Given an ordinary relationship crosses between containment trees, when Arrange Diagram
  runs, then the roots participate in layout according to that relationship and the
  persisted edge is rerouted against its actual descendant endpoints.
- Given a contained node is selected, when Arrange Diagram runs, then its complete
  top-level containment tree is arranged and unselected trees remain in place.
- Given a containment relationship is active, when either endpoint node's Style tab
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
