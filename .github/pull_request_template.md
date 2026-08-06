## What changed

<!-- One or two lines. If you added or edited a resource, name it and say why
     it belongs in the collection. That is the part no automated check can do. -->

## Checklist

Most pull requests come from the curation form, which handles the first three
of these for you. Tick what applies and delete the rest.

- [ ] Edited files under `data/` — never `public/resources-data.js`, which is generated and not committed
- [ ] Tags come from the vocabulary in `public/taxonomy.js`, and each field is within its recommended maximum
- [ ] If a resource was added or its link changed, the URL was opened and actually resolves
- [ ] For a developer change: `npm run validate` passes locally

<!--
The Validate check runs automatically:
  1. data/resource.schema.json matches the taxonomy it is generated from
  2. the data builds cleanly from data/
  3. every record validates against the taxonomy

There is no "did you rebuild the artifact" gate any more — the artifact is not
committed. That is what lets a curator open a pull request from a browser.
-->
