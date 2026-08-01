# Acceptance Tests: Canvas Nodes

## Create Nodes

- Given a class, individual, or datatype is dragged from the model tree, when it is dropped on the canvas, then a node is created at the drop position.
- Given an ontology node is created by any supported addition workflow, when it is persisted, then it uses the minimum node dimensions and `label_text_overflow: wrap`.
- Given a node-capable ontology item already has a corresponding node, when it is dropped again, then the user sees a duplicate-node message and no duplicate is written.
- Given a connection-capable ontology item needs a missing endpoint node, when edge materialization runs, then the missing node is created using edge placement rules.

## Move And Resize

- Given a node is selected, when the user drags it, then persisted `x` and `y` are updated and dimensions are unchanged.
- Given a connected node moves, when persistence completes, then connected edge endpoints are recalculated to remain on the node boundary.
- Given a node resize handle is dragged, when the resize completes, then persisted dimensions and any affected top-left coordinate are updated.
- Given a resize would create non-positive or unusably small dimensions, when the user completes the resize, then the action is rejected and the document remains unchanged.

## Label Overflow

- Given a node uses the default label overflow behavior, when its label exceeds the available width, then it is truncated and ends with `...`.
- Given a node is selected, when its Style tab is shown, then the label overflow selector is available there rather than in the Ontology tab.
- Given the user selects Wrap for a node label, when the node renders or is exported, then the label uses multiple lines within the available title area and `label_text_overflow: wrap` is persisted.
- Given the user switches a wrapped node label back to Truncate with ..., when persistence completes, then `label_text_overflow` is omitted.

## Data Properties

- Given a class node has matching data properties in loaded ontology metadata, when the property panel is shown, then it displays the available data-property count.
- Given the user enables Show Data Properties, when persistence completes, then the node stores `show_data_properties: true`.
- Given the user disables Show Data Properties, when persistence completes, then the effective value is false and the field is omitted from serialized output.
- Given shown data properties exceed the node bounds, when the node renders, then visible rows are deterministic and an overflow indicator is shown.
