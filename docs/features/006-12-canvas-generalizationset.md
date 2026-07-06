# Generalization Set

There are situations when multiple nodes are subclasses of the 
same superclass. We want to render this to be appealing to the eyes.

# Prerequirements

- Multiple nodes are selected
- Each nodes have the same supertype

# Action

The user presses a button in a floating toolbar which initiaties the
action. 

# Expected result

The sections of the edges are recalculated and presented in an
appealing way.

# Edge routing general rules

- The number of sections are kept minimal
- The route is orthogonal
- A box is calculated around the selected subclasses

# When the subclasses are on the left side from the superclass

When the subclasses are on the left side:

- The edges start from the middle point of the right edge for each subclasses
- The edges end in the middle point of the left edge for the subclass
- The edges have the minimal amount of sections
- The edges might have more than one section


# When the subclasses are on the right side from the superclass

When the subclasses are on the right side:

- The edges start from the middle point of the left edge for each subclasses
- The edges end in the middle point of the right edge for the subclass
- The edges have the minimal amount of sections
- The edges might have more than one section


# When the subclasses are on the bottom side from the superclass

When the subclasses are on the bottom side:

- The edges start from the middle point of the top edge for each subclasses
- The edges end in the middle point of the bottom edge for the subclass
- The edges have the minimal amount of sections
- The edges might have more than one section

