# Acceptance Tests: Canvas Diagram Links

## Creation And Persistence

- Given Add Linked Diagram is activated, when an `.odiagram` file is selected, then a `link_` element is added to `diagram_links` with a path relative to the current diagram.
- Given a relative `.odiagram` reference, when the document is parsed and serialized, then its bounds, reference, and optional embedded icon are preserved.
- Given an absolute path, blank path, or non-`.odiagram` reference, when validation runs, then the reference is rejected.
- Given a link has no custom icon, when rendered, then the built-in diagram icon is displayed.
- Given a link references `architecture/system.odiagram`, when rendered, then its label is `system`.
- Given a diagram link is rendered on the canvas or in an export, then its container has no visible background, border, or shadow.

## Navigation And Editing

- Given a valid link, when it is double-clicked or its local Open action is activated, then the referenced diagram opens in VS Code.
- Given a link target does not exist, when navigation is requested, then an error is shown and the current document is unchanged.
- Given a link is selected, when its reference is edited or another file is chosen in Properties, then the new relative reference is persisted.
- Given a link is selected, when a gallery icon or image file is chosen, then it is embedded as the link icon.
- Given a custom icon is present, when Restore Default Icon is activated, then the persisted `icon` is removed.

## Canvas Behavior

- Given a link is moved or resized, when the gesture completes, then its bounds are persisted with minimum dimensions enforced.
- Given links are included in a selection, when deletion is confirmed, then the selected links are removed.
- Given a diagram link is visible, when the viewport is fitted or the diagram is exported, then the link is included in the calculated content bounds and output.
