# Canvas Floating Toolbar

This specification defines the floating toolbar used to customize selected canvas
elements.

# Scope

This specification covers toolbar visibility, supported controls, and persistence of
element-level style overrides. It does not define theme file editing or bottom property
panel behavior.

# Customize Elements With the Floating Toolbar

When an element is selected, the canvas shall show a floating toolbar near the selected
element when there are customization actions available for that element.

The toolbar shall expose style controls based on the style fields defined by the
`.odiagram` and `.otheme` specifications.

Supported customization controls in version 1 are:

| Element type | Controls |
|--------------|----------|
| Node | Background color, text color, font family, font size, bold, italic, border type, border weight, border color. |
| Edge | Line color, line style, line weight, label text color, font family, font size, bold, italic. |
| Note | Background color, text color, font family, font size, bold, italic, border type, border weight, border color. |
| Label | Text color, font family, font size, bold, italic. |
| Image | None. |

Changing a toolbar control shall update the selected element's `style` map in the
`.odiagram` file. Style changes shall be stored only as element-level overrides. The
toolbar shall not modify the active `.otheme` file.

The toolbar shall not expose node image, standalone image source, or image dimension
editing. Node image and standalone image source fields are edited through the property
panel. Standalone image dimensions are edited through canvas resize handles or the
property panel.

If a toolbar value matches the effective theme value, the implementation shall remove
the corresponding element-level override to keep the `.odiagram` file minimal.

# Validation

The toolbar shall validate style edits before writing them to the `.odiagram` document.

The toolbar shall reject edits that would create invalid style values, such as
unparseable colors, unsupported line or border styles, non-positive font sizes, or
negative line and border weights.

When a style edit is rejected, the toolbar shall leave the persisted document unchanged
and show the validation problem near the edited control or in a canvas-level notification
area.

The toolbar shall not appear while the user is editing text inside a note or label.
