# Acceptance Tests: `.otheme` File Format

## Valid Theme Shape

- Given a theme file with a top-level `theme` mapping, when it is parsed, then it is accepted as a valid theme document shape.
- Given an element theme block is omitted, when styles are resolved, then renderer internal defaults are used for that element type.
- Given the root document or `theme` value is not a mapping, when validation runs, then validation reports an error.

## Style Resolution

- Given renderer defaults, an active theme, and element-level style overrides, when effective style is resolved, then element-level overrides take precedence over the theme and defaults.
- Given a nested `font` or `border` override contains one field, when style is resolved, then only that nested field overrides lower-precedence values.

## Value Rules

- Given an invalid enum value for `border.type` or `line_style`, when validation runs, then validation reports an error.
- Given a non-positive font size, negative border weight, or negative edge weight, when validation runs, then validation reports an error.
- Given an unparsable color value, when validation runs, then validation reports an error.
- Given a label theme block contains `bg_color` or `border`, when validation runs, then validation reports an error.
