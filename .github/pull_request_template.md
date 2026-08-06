## What changed

<!-- One or two lines. If you added or edited a resource, name it. -->

## Checklist

- [ ] Edited files under `data/`, **not** `public/resources-data.js` (that file is generated)
- [ ] Ran `npm run build` and committed the regenerated `public/resources-data.js`
- [ ] Ran `npm run validate` locally and it passed
- [ ] New or changed facet values come from the vocabulary in `public/taxonomy.js`
- [ ] If a resource was added, its URL was opened and actually resolves

<!--
The Validate check runs both gates automatically:
  1. the committed data file matches data/  (catches a forgotten rebuild)
  2. every record validates against the taxonomy

If it fails on drift, run `npm run build` and commit the result.
-->
