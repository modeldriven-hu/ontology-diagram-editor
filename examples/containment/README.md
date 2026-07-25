# Nested Containment Examples

Open either `.odiagram` file with the Ontology Diagram Editor.

- `part-of.odiagram` uses relationships directed from each part to its whole. Its
  containment edges use `target_contains_source`.
- `has-part.odiagram` uses relationships directed from each whole to its part. Its
  containment edges use `source_contains_target`.

Containment relationships are stored as ordinary diagram edges with:

```yaml
render_as: containment
containment_direction: target_contains_source
```

The relationship line is hidden and the contained node is rendered inside the container
node. Select either involved node and open its **Ontology** tab to restore a hidden
relationship to an ordinary connection. To create a containment relationship yourself,
select an ordinary edge, open **Details**, set **Display as** to **Containment**, and
choose which endpoint is the container.

Useful checks:

1. Move the outermost box and verify that every descendant moves with it.
2. Export SVG or PNG and verify that containment edges are omitted.
3. Restore one containment relationship to a connection from an involved node.
4. Try assigning one child to a second parent or creating a cycle; the editor should
   reject the change with a concise message.
