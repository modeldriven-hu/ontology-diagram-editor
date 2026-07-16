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
- Classes with an in-ontology superclass are nested below that superclass in the Classes
  group. Root classes remain direct children of the Classes group.
- A class with several in-ontology superclasses is shown below each superclass. Cyclic
  subclass declarations must not cause infinitely repeating tree nodes, and every class
  must remain reachable.

Version 1 displays only ontology files directly referenced by the `.odiagram` file.
When the user adds an ontology, the editor follows its transitive `owl:imports`
declarations and appends matching local ontology files as direct `.odiagram` references,
as specified in `005-02-model-tree-import.md`. An import may resolve directly to a local
file URI or to one uniquely matching workspace ontology IRI. The editor does not resolve
remote imports.

An ontology item is any parsed item from an ontology file that the editor exposes to the
user or to diagram features. Ontology items include named entities such as classes,
properties, individuals, and datatypes, as well as explicit relationships or predicates
such as subclass relationships.

The model tree shall display the following ontology item groups:

| Group label | Ontology item type | Icon |
|-------------|--------------------|------|
| Classes | OWL/RDFS classes | Class icon |
| Object properties | OWL object properties | Link/property icon |
| Object property assertions | Resource-valued assertions between individuals | Link/property icon |
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

Class item rows shall avoid displaying raw ontology URLs in the visible label or row
description. If no explicit label or compact namespace form is available, the row label
shall fall back to the local IRI name. The full class reference should remain available
through metadata and tooltip details.

Relationship item display labels shall identify the concrete relationship endpoints
rather than repeating only the relationship predicate. A subclass relationship shall use
the subclass display name, a subclass glyph, and the superclass display name, for
example `Requirement ⊑ Domain`.

Object and data property item rows shall keep the property display name as the primary
label and use the row description or tooltip to show the domain and range names. For
example, an `applies to` object property from `Requirement` to `Domain` may display as
`applies to (Requirement, Domain)`, while an `identifier` data property may display as
`identifier (Requirement, Literal)`. The full property reference should remain available
in the tooltip instead of being the primary row description.

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
- An already-open `.odiagram` custom-editor tab becomes the active editor.
- The currently displayed `.odiagram` diagram editor is closed.
- The `.odiagram` file changes on disk or in the editor.
- An ontology file referenced by the `.odiagram` file changes.
- An ontology is added or removed through the model tree toolbar.

Each open diagram editor shall watch the exact ontology files referenced by its
`.odiagram` document. A referenced ontology change, creation, deletion, or recreation
shall reload the ontology data and rerender that diagram, whether the filesystem change
originates inside or outside Visual Studio Code. If the changed dependency belongs to
the active diagram, its model tree shall refresh as well.

When the diagram's ontology or theme references change, the editor shall stop watching
dependencies that are no longer referenced and start watching the newly referenced
files. Dependency paths may resolve outside the workspace when selected by the user.

The refresh must preserve the current selection and expanded state when the same nodes
still exist after the refresh.

When the currently displayed `.odiagram` diagram editor is closed, the model tree shall
switch to another visible `.odiagram` custom-editor tab when one is available. If no
other diagram editor is active, it shall clear the diagram document, parsed ontology
data, current selection, and last dragged ontology item. The model tree shall then render
no root node and shall disable commands that require an open diagram.

When several diagram files are open, the model tree shall always represent the active
`.odiagram` custom-editor tab. Switching tabs shall not require reopening the diagram,
and closing an inactive diagram tab shall not clear or replace the active diagram's
model tree.

## Events

The model tree emits the following events:

| Event | Trigger | Payload |
|-------|---------|---------|
| Model tree refreshed | The model tree reloads the `.odiagram` file or referenced ontology files | Diagram file path, ontology file paths, load errors |
| Model tree selection changed | The user selects a node in the model tree | Node kind, display label, ontology file path, ontology item type, ontology item reference, ontology item metadata |
| Model tree item dragged | The user drags an ontology item node | Source ontology file path, ontology item type, ontology item reference, display label, ontology item metadata |
| Ontology added | An ontology file is added to the `.odiagram` file | Added ontology file path |
| Ontology removed | An ontology file is removed from the `.odiagram` file | Removed ontology file path, removed diagram node identifiers, removed diagram edge identifiers |

## Add all to diagram

The context menu for an ontology file node and every ontology item group node shall
provide an `Add All to Diagram` action. The ontology-file action considers every
addable item in that ontology; the group action considers only the items in that group.

The action shall add all items that are not already materialized in the diagram. It shall
create node-capable items before relationship items so that applicable relationships can
be added between their endpoints. Unsupported items and already materialized elements
shall be skipped. If no addable items remain, the editor shall show a concise message and
leave the diagram unchanged.

## Open ontology source

The model tree shall provide an action to open a referenced ontology file in the built-in
Visual Studio Code text editor.

When invoked on an ontology file node, the source ontology file is opened without
changing the `.odiagram` document.

When invoked on an ontology item node, the source ontology file is opened and the editor
reveals the best available source location for that item. The implementation should
prefer exact compact IRI or full IRI matches and may fall back to local-name matches when
the source syntax does not expose the compact IRI text directly.

If the ontology file can be opened but no source location can be found for the item, the
file remains open and the user is shown a concise informational message.

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

When the user selects an ontology item in the model tree, the model tree shall emit the
selection event with enough information for canvas features to react. Version 1 does
not require automatic canvas selection changes from model-tree selection.

When the user selects an ontology-backed node or edge on the canvas and invokes the
canvas action to select the corresponding model-tree item, the model tree shall reveal
and select the matching ontology item when it is present in the loaded model tree. If no
matching item is found, the canvas shall show a concise user-visible message.

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
| Filter model tree | A `.odiagram` file is open | Opens an ontology-item search. Moving through matching results expands the model tree to that item's parent path and selects it. |
| Show unadded ontology elements | A `.odiagram` file is open | Chooses an ontology (or uses the selected ontology) and filters the tree to its addable items that are not yet materialized in the current diagram. Invoking it again for the same ontology clears the filter. |
| Add ontology | A `.odiagram` file is open | Opens the add ontology flow |
| Remove ontology | An ontology file node is selected | Opens the remove ontology confirmation flow |
| Refresh diagram dependencies | A `.odiagram` file is open | Reloads the model tree, referenced ontology files, active theme, and open canvas for the current diagram. |

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
