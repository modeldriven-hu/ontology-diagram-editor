# Class Hierarchy and Filtering Example

Open `city-mobility.odiagram` with the Ontology Diagram Editor, then expand:

1. `city-mobility.odiagram`
2. `city-mobility.ttl`
3. `Classes`

The model tree displays this hierarchy:

```text
Transport entity
├── Fleet asset
│   └── Vehicle
│       ├── Electric vehicle
│       │   └── Electric tram
│       ├── Rail vehicle
│       │   └── Electric tram
│       └── Road vehicle
└── Place
    ├── Charging site
    │   └── Mobility hub
    └── Station
        └── Rail station
            └── Mobility hub
```

`Electric tram` and `Mobility hub` intentionally use multiple inheritance and therefore
appear under both of their superclass paths.

To try filtering, select **Filter Model Tree** in the model-tree toolbar and search for
text such as `electric`, `station`, or `hub`. As you move through matching results, the
model tree expands to and selects that item.
