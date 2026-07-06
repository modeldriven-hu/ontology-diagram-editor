# Model Tree Importing 

When the user imports an ontology in the model tree,
and the ontology references another ontology file,
then we shall find that ontology file in the workspace
(check each file that might represent an ontology, like ttl)
and import that as well into the model-tree, before the 
selected ontology is being imported.


Find the ontology files based on @prefix and @base.