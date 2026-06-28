# Acceptance Tests: Canvas Floating Toolbar

## Visibility And Controls

- Given a selected element has customization actions, when selection is active, then the floating toolbar appears near the selected element.
- Given no style customization actions are available for the selected element, when selection is active, then the toolbar does not expose unsupported controls.
- Given an image is selected, when the toolbar appears, then no image style controls are available.
- Given note or label text editing is active, when the user edits text, then the toolbar is hidden.

## Style Persistence

- Given a node, edge, note, or label style control changes, when the edit is valid, then the selected element's `style` map is updated in the `.odiagram` file.
- Given a toolbar value matches the effective theme value, when the edit is persisted, then the corresponding element-level override is removed.
- Given a style edit is invalid, when the user applies it, then the document remains unchanged and the validation problem is shown near the control or in a canvas notification area.
- Given a toolbar style edit is persisted, when the active theme file is inspected, then it is unchanged.
