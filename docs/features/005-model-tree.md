# Model tree

The model tree is displayed on the left side of the diagram editor. It displays data for
the currently opened `.odiagram` file and provides commands for managing ontology files
referenced by the diagram.

# Scope

This specification defines the model tree user interface, the commands owned by the
model tree, the changes the model tree makes to the `.odiagram` file, and the events it
emits. Other features may subscribe to these events and define their own reactions in
their own specifications.

# Functions

## Display ontologies

The model tree displays the ontologies referenced by the current `.odiagram` file in a
tree structure.

- The root node represents the diagram file.
- Every direct child of the root represents one ontology file from the `.odiagram`
  `ontologies` section.
- Ontology files are displayed in the order in which they appear in the `.odiagram`
  file.
- The label of an ontology file is its relative path from the `.odiagram` file.
- If an ontology file cannot be loaded, its node remains visible and is marked with an
  error status.
- Under each ontology file, ontology items are grouped by type.
- Groups and items are sorted alphabetically by display label unless the ontology
  parser provides a stable source order.

Version 1 loads only the ontology files directly referenced by the `.odiagram` file and
does not resolve ontology imports unless a later specification explicitly adds that
behavior.

An ontology item is any parsed item from an ontology file that the editor exposes to the
user or to diagram features. Ontology items include named entities such as classes,
properties, individuals, and datatypes, as well as explicit relationships or predicates
such as subclass relationships.

The model tree shall display the following ontology item groups:

| Group label | Ontology item type | Icon |
|-------------|--------------------|------|
| Classes | OWL/RDFS classes | Class icon |
| Object properties | OWL object properties | Link/property icon |
| Data properties | OWL data properties | Field/property icon |
| Annotation properties | OWL annotation properties | Comment/tag icon |
| Subclass relationships | Explicit subclass relationships | Inheritance/generalization icon |
| Individuals | Named individuals | Object/instance icon |
| Datatypes | Datatypes | Type/value icon |

The implementation may use the closest available icon from the active UI framework. For
the Visual Studio Code extension, Codicons should be used where possible. The exact icon
name is an implementation detail, but different ontology item types must be visually
distinguishable.

Each ontology item node shall have:

- A display label, preferably the compact qualified name using the namespace shortcuts
  from the `.odiagram` file.
- The full ontology IRI, URI, or relationship reference as metadata.
- The source ontology file path as metadata.
- Its ontology item type as metadata.

Each ontology item node shall also expose the parsed ontology item metadata needed
by other editor features. This metadata is runtime state derived from the referenced
ontology file and shall not be persisted into the `.odiagram` file.

At minimum, ontology item metadata shall include:

| Ontology item type | Runtime metadata |
|-----------------------|------------------|
| Class | IRI or URI, display labels, superclass references where available, equivalent class references where available. |
| Individual | IRI or URI, display labels, asserted class references where available. |
| Datatype | IRI or URI, display labels. |
| Object property | IRI or URI, display labels, domain class references, range class references. |
| Data property | IRI or URI, display labels, domain class references, datatype range references. |
| Annotation property | IRI or URI, display labels, domain references, range references where available. |
| Subclass relationship | Relationship reference, display label, subclass class reference, superclass class reference. |

When ontology metadata contains multiple domains, ranges, class assertions, or equivalent
references, the model tree shall preserve all available values instead of choosing one
silently. Consumers such as the canvas may then reject ambiguous actions or, in later
versions, ask the user to choose among valid values.

The `.odiagram` file shall persist only ontology references used by diagram elements and
shall not duplicate ontology-derived fields such as labels, domains, ranges, superclass
relationships, or class assertions.

Equivalent class relationships may be exposed by a later version, but they are not a
minimum viable product model tree group.

## Refresh model tree

The model tree is refreshed when:

- A `.odiagram` file is opened.
- The currently displayed `.odiagram` diagram editor is closed.
- The `.odiagram` file changes on disk or in the editor.
- An ontology file referenced by the `.odiagram` file changes.
- An ontology is added or removed through the model tree toolbar.

The refresh must preserve the current selection and expanded state when the same nodes
still exist after the refresh.

When the currently displayed `.odiagram` diagram editor is closed, the model tree shall
clear the diagram document, parsed ontology data, current selection, and last dragged
ontology item. The model tree shall then render no root node and shall disable commands
that require an open diagram.

## Events

The model tree emits the following events:

| Event | Trigger | Payload |
|-------|---------|---------|
| Model tree refreshed | The model tree reloads the `.odiagram` file or referenced ontology files | Diagram file path, ontology file paths, load errors |
| Model tree selection changed | The user selects a node in the model tree | Node kind, display label, ontology file path, ontology item type, ontology item reference, ontology item metadata |
| Model tree item dragged | The user drags an ontology item node | Source ontology file path, ontology item type, ontology item reference, display label, ontology item metadata |
| Ontology added | An ontology file is added to the `.odiagram` file | Added ontology file path |
| Ontology removed | An ontology file is removed from the `.odiagram` file | Removed ontology file path, removed diagram node identifiers, removed diagram edge identifiers |

## Selection in model tree

When the user selects a node in the model tree, a selection event is generated. Other
parts of the plugin can subscribe to this event.

The selection event shall include:

- The selected node kind: diagram, ontology file, ontology group, or ontology item.
- The selected ontology file path, if applicable.
- The selected ontology item type, if applicable.
- The selected ontology item reference, if applicable.
- The parsed ontology item metadata, if applicable.
- The display label shown to the user.

Selecting a group node emits a selection event for the group, but it does not select all
children in the group.

When the user selects an ontology item in the model tree, the canvas should select
the corresponding diagram element when exactly one rendered node or edge in the opened
`.odiagram` file references that ontology item. If multiple diagram elements reference
the same ontology item, the canvas may leave the canvas selection unchanged or offer a
way to choose among matching elements.

In the minimum viable product, node creation prevents duplicate ontology-backed nodes by
default, so selecting a node-capable ontology item should normally select at most one
canvas node.

When the user selects an ontology-backed node or edge on the canvas, the model tree
should select the corresponding ontology item when it is present in the loaded model
tree.

## Drag item

When the user drags an ontology item from the model tree, the model tree shall emit
`Model tree item dragged`. Other parts of the plugin can subscribe to this event.

Only ontology item nodes are draggable by default. Diagram nodes, ontology file nodes,
and group nodes are not draggable.

The `Model tree item dragged` event shall include:

- The source ontology file path.
- The ontology item type.
- The ontology item reference.
- The display label shown to the user.
- The parsed ontology item metadata exposed by the model tree.

For subclass relationship nodes, the ontology item reference identifies the relationship
predicate, such as `rdfs:subClassOf`, while the parsed ontology item metadata identifies
the concrete subclass and superclass endpoints. Consumers shall use the subclass and
superclass metadata to distinguish individual subclass relationship nodes.

The `Model tree item dragged` event does not itself create a diagram element. Creating a
node, edge, or other diagram element is handled by the canvas or another consumer of the
event.

## Toolbar

The model tree has a toolbar with custom buttons. When the user presses a button, a
command is executed.

The toolbar shall contain:

| Command | Enabled when | Result |
|---------|--------------|--------|
| Add ontology | A `.odiagram` file is open | Opens the add ontology flow |
| Remove ontology | An ontology file node is selected | Opens the remove ontology confirmation flow |
| Refresh | A `.odiagram` file is open | Reloads the `.odiagram` file and referenced ontology files |

Commands must be disabled when they cannot be executed.

## Add a new ontology

When the user presses the add ontology button in the toolbar, a file selection dialog is
displayed. The dialog allows the user to select standard ontology file formats.

Supported file formats shall include at least:

- Turtle: `.ttl`
- RDF/XML: `.rdf`, `.owl`, `.xml`
- JSON-LD: `.jsonld`
- N-Triples: `.nt`

When a file is selected:

- The file path is stored in the `.odiagram` file as a relative path from the `.odiagram`
  file.
- The ontology reference is added to the end of the `.odiagram` `ontologies` section.
- The ontology file is loaded and its elements are added to the model tree.
- A model tree refresh event is emitted.

If the selected ontology file is already referenced by the `.odiagram` file, the file
must not be added a second time. The existing ontology node should be selected instead.

If the selected file cannot be parsed as a supported ontology file, the `.odiagram` file
must not be changed and an error must be shown to the user.

## Remove an ontology

When the user presses the remove ontology button in the toolbar, a confirmation dialog is
displayed.

The confirmation dialog shall show:

- The ontology file path.
- A warning that diagram elements referencing this ontology will be removed.
- Yes and No actions.

If No is selected, nothing changes.

If Yes is selected:

- The ontology file reference is removed from the `.odiagram` `ontologies` section.
- Diagram nodes whose ontology reference comes from the removed ontology are removed from
  the `.odiagram` file.
- Diagram edges whose ontology reference comes from the removed ontology are removed from
  the `.odiagram` file.
- Diagram edges connected to removed nodes are removed from the `.odiagram` file.
- Standalone notes, labels, and images are kept unchanged.
- The model tree is refreshed.
- An ontology removed event is emitted.

The ontology file itself is not deleted from disk.

The ontology removed event shall include:

- The removed ontology file path.
- The list of removed diagram node identifiers.
- The list of removed diagram edge identifiers.

## Error handling

The model tree must tolerate invalid or missing ontology files without preventing the
`.odiagram` file from opening.

If an ontology file cannot be loaded:

- The ontology file node is shown with an error status.
- The node tooltip or details include the error message.
- The remaining ontology files are still loaded.

If the `.odiagram` file is invalid, the model tree should show the diagram root and an
error state instead of partial ontology data.

## Persistence

All changes made by add and remove commands must update and save the opened `.odiagram`
file using the same document update and autosave flow as canvas edits. The persisted
file must remain valid according to the `.odiagram` file format specification.

Model tree changes to the `.odiagram` file shall emit `Diagram document updated`,
`Diagram save requested`, `Diagram saved`, and `Diagram save failed` events using the same
semantics defined by the canvas persistence specification.

The model tree must not write to ontology files.
