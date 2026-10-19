# EduSport architecture: club management

Scope: registrations, sportivi, groups, presence, abonaments, payments, documents.
Website content (pages, news, settings) is out of scope here.

Diagrams follow UML and are written in PlantUML (`diagrams/*.puml`, shared style in
`diagrams/_style.iuml`). Exported SVGs sit next to the sources. Render locally:

    brew install plantuml
    cd docs/architecture/diagrams && plantuml -tsvg *.puml

Not part of the build: `docs/` is documentation only.

## Steps

1. Glossary
2. Use cases (`02a`..`02d`): overview, then one diagram per actor
3. Class diagram: data model, multiplicities, constraints
4. State machines: Înscriere, Sportiv, Abonament, Ședință
5. Sequence and activity diagrams: main flows
6. Component and deployment diagram
7. Mapping to existing Strapi content types
8. Open decisions, then spec and implementation plan

Decisions log: `edusport_frontend/docs/portal/DECISIONS.md`.
