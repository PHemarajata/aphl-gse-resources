# data/

Source of truth for the resource library. `public/resources-data.js` is built
from this directory and **must not be edited by hand**.

    data/metadata.json          version, taxonomyVersion, lastUpdated, lastValidated
    data/order.json             display order — the site renders in array order
    data/resources/<id>.json    one file per resource; filename must match "id"

## Making a change

Edit the one record file you care about, then:

    npm run build        # regenerates public/resources-data.js
    npm run validate     # drift check + full schema validation

Commit both the changed record file and the rebuilt `public/resources-data.js`.

## Why one file per record

A single 584 KB data file made every change an unreadable diff and guaranteed
merge conflicts between curators editing different records. One file per record
means a pull request reads as "one file, three changed lines", and two people
can work at once.

## Conventions

- `validated: true` marks a record a curator has reviewed. The build collects
  these into `metadata.validatedResources` so the admin panel keeps working, but
  the per-record flag is authoritative.
- A record not listed in `order.json` still ships; it is appended alphabetically
  and the build prints a note. Add it to `order.json` to control placement.
- Vocabulary for every faceted field lives in `public/taxonomy.js`. The
  validator rejects values outside it.
- Version history is git. The old in-file `versionHistory` (285 KB of full
  record snapshots, growing with every save) has been dropped.
