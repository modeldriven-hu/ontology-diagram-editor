# Acceptance Tests: Rendering

## Scene Construction

- Given a valid `.odiagram` file, loaded ontology metadata, and an active theme, when rendering starts, then the renderer constructs a scene containing nodes, edges, notes, images, standalone labels, and edge labels.
- Given rendered scene items, when the user interacts with them in the webview, then each rendered item can be mapped back to its persisted `.odiagram` element identifier.
- Given validation errors that can be isolated, when rendering runs, then valid independent elements still render in degraded mode.

## Visual Output

- Given nodes, notes, images, labels, and edges, when the scene is rendered, then each element uses persisted coordinates and dimensions without modifying the source document.
- Given text exceeds node or note bounds, when rendering runs, then text wraps and overflow is clipped or elided deterministically.
- Given an edge with route points, when rendering runs, then straight segments are drawn between consecutive points and the edge label appears at the persisted label point.
- Given the same element category contains multiple items, when rendering runs, then items are drawn in `.odiagram` order.
- Given a node has `show_data_properties: true`, when matching ontology data properties are loaded, then the node renders a data-property attribute section.
- Given a note has `export: false`, when the interactive canvas renders, then the note remains visible with a non-intrusive no-export indicator.
- Given a note connection edge renders, when the scene is drawn, then it has no ontology arrowhead and no edge label by default.

## Degraded And Fatal Errors

- Given the `.odiagram` file cannot be parsed as YAML, when rendering runs, then rendering fails with a fatal error.
- Given an ontology, theme, or image cannot be loaded, when rendering runs, then the diagram renders in degraded mode and exposes the warning.
- Given note HTML contains scripts, remote resources, or event handlers, when rendering runs, then unsafe content is sanitized and not executed.
