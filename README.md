# Ontology Diagram Editor

Turn RDF and OWL ontologies into clear, easy-to-explore diagrams without leaving
Visual Studio Code. Ontology Diagram Editor helps you understand complex models,
communicate their structure, and create polished visuals for documentation and
presentations.

## Screenshots

<img width="1280" height="672" alt="image" src="https://github.com/user-attachments/assets/44a43081-e1dd-4b27-b6a4-aa7c39286078" />


## Features

- Browse ontology classes, properties, relationships, individuals, and datatypes in a
  model tree.
- Build diagrams by dragging ontology elements onto an interactive canvas or finding
  them with search.
- Arrange, connect, resize, and style elements to make complex models easier to
  understand.
- Add notes, labels, images, and icons to explain or highlight important details.
- Apply reusable themes and switch between light and dark appearances.
- Export finished diagrams as SVG or PNG for sharing and documentation.

Your work is saved in portable, YAML-based `.odiagram` files. Referenced ontologies
and themes reload when their source files change, so diagrams can stay in sync with
your model.

## Getting Started

1. Open the Command Palette and run **Create Ontology Diagram**, or right-click a
   folder in the Explorer and choose the same command.
2. Open the new `.odiagram` file in the visual editor.
3. Add an ontology from the **Ontology Diagram** view.
4. Drag items from the model tree onto the canvas and start arranging your diagram.

## Supported Ontology Formats

- Turtle (`.ttl`)
- RDF/XML (`.rdf`, `.owl`, `.xml`)
- JSON-LD (`.jsonld`)
- N-Triples (`.nt`)

## Requirements

- Visual Studio Code `^1.125.0`
- Referenced ontology and optional theme files must be accessible from the diagram
  file.

## Release Notes

See the [changelog](CHANGELOG.md) for release information.
