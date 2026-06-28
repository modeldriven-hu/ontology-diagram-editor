# Acceptance Tests: Canvas Nodes

## Create Nodes

- Given a class, individual, or datatype is dragged from the model tree, when it is dropped on the canvas, then a node is created at the drop position.
- Given a node-capable ontology item already has a corresponding node, when it is dropped again, then the existing node is selected and revealed without writing a duplicate.
- Given a connection-capable ontology item needs a missing endpoint node, when edge materialization runs, then the missing node is created using edge placement rules.

## Move And Resize

- Given a node is selected, when the user drags it, then persisted `x` and `y` are updated and dimensions are unchanged.
- Given a connected node moves, when persistence completes, then connected edge endpoints are recalculated to remain on the node boundary.
- Given a node resize handle is dragged, when the resize completes, then persisted dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when the user completes the resize, then the action is rejected and the document remains unchanged.
