# Curating this library

Everything here lives in `data/`. There is no admin panel and no login — a
resource is a small JSON file, and changing one is a pull request.

## One-time setup

You need the repository on your machine and Node installed. Nothing else: the
build and validator have no dependencies, so there is no `npm install` step.

    git clone https://github.com/PHemarajata/aphl-gse-resources.git
    cd aphl-gse-resources
    node --version        # any Node 20+ is fine

Open the folder in an editor that understands JSON Schema — VS Code does out of
the box. Each record points at `data/resource.schema.json`, so every vocabulary
field autocompletes, hovering a field explains what the values mean, and an
invalid value is underlined as you type.

## The loop, exactly

Four commands, every time, in this order:

    git checkout main && git pull          # 1. start from current main
    git checkout -b fix-something          # 2. never work on main; it is protected

    # 3. edit the file(s) under data/

    npm run validate                       # 4. rebuild + check everything

`npm run validate` is not optional and not a formality. It regenerates
`public/resources-data.js` from your edit. **If you skip it, CI rejects the
pull request**, because the committed data file will no longer match its source.

Then:

    git add data public
    git commit -m "fix: shorter description of what changed"
    git push -u origin fix-something

Open the pull request on GitHub, wait for the green check, merge. Merging
publishes the site.

## Worked example: fixing a broken link

The weekly link check has opened an issue saying `who-costing-tool` is dead.

    git checkout main && git pull
    git checkout -b fix-who-costing-tool

Open `data/resources/who-costing-tool.json`. Find the current URL by hand —
search for the resource on the publisher's own site. Prefer the publisher's
canonical page over a mirror, and a DOI over whichever host currently serves an
article. Change one line:

    "url": "https://www.who.int/publications/i/item/9789240118843",

Then:

    npm run validate

You should see three lines of output ending in `Validation status: PASS`. If
instead you see `DRIFT`, you edited the generated file by mistake — undo that
and edit the record under `data/` instead.

    git add data public
    git commit -m "fix: who-costing-tool now points at the 2nd edition"
    git push -u origin fix-who-costing-tool

Open the PR, merge it, and close the link-check issue.

## Where you can edit

**On your own machine — the only route that completes on its own.** Everything
above assumes this.

**In the browser (github.dev, or GitHub's pencil icon).** Pressing `.` on the
repository opens VS Code in a browser tab, and the schema autocomplete works
there. It is a genuinely good place to *read* records, and fine for editing
anything that is not under `data/`.

But it **cannot finish a data change**, because there is no terminal, so you
cannot run `npm run validate`. A pull request made this way will fail CI with a
drift error. If you have already made one, it is not lost — someone with a
clone can check out your branch, run `npm run validate`, and push the result to
it. Just do not expect a browser-only edit to merge by itself.

**Not editing at all.** Open an issue with the "Suggest a resource" template. A
link and a sentence on why it matters is enough; a curator handles the rest.

## Never edit these

    public/resources-data.js     generated from data/ — CI compares them
    data/resource.schema.json    generated from public/taxonomy.js

Both are build outputs. `npm run build` regenerates them; CI fails if a commit
contains one that does not match its source.

## Tagging: the part that actually matters

The failure mode of a faceted library is not wrong tags. It is *too many* tags.

This collection has already been through it. `stakeholder-engagement` ended up
on 68 of 79 records — 86% — which meant filtering by it excluded almost nothing.
It had arrived through a migration that mapped three unrelated source terms onto
it, and nobody noticed because nothing was obviously broken. Nine records
genuinely concerned stakeholder engagement. The other 59 tags were noise that
made the facet useless.

So:

**Tag what a resource is _about_, not what it touches.** Nextclade is a quality
control tool. It is used within genomic surveillance, but it is not *about*
genomic surveillance, and tagging it so makes `genomic-surveillance` mean
nothing. A tree viewer is not a phylogenetics primer.

**Prefer the specific tag over the general one.** If `environmental-surveillance`
fits, you rarely also need `genomic-surveillance`. Two tags where one is a
superset of the other is one tag too many.

**Stay inside the caps.** One to three topics is usually right; the validator
warns above five. Audiences the same. If you find yourself wanting six, you are
probably describing the field rather than the resource.

**A tag on most records is a broken tag.** If you notice a facet value creeping
past roughly half the collection, that is a signal to narrow it, not to keep
going. Check with:

    node -e 'const d=require("./public/resources-data.js");' 2>/dev/null || \
      node -e '
        const fs=require("fs");const db=new Function(fs.readFileSync("public/resources-data.js","utf8")+";return resourcesDatabase;")();
        const t={};db.resources.forEach(r=>r.topics.forEach(x=>t[x]=(t[x]||0)+1));
        Object.entries(t).sort((a,b)=>b[1]-a[1]).slice(0,5)
          .forEach(([k,v])=>console.log(k,v,Math.round(100*v/db.resources.length)+"%"));'

**Empty is allowed.** `pathogenFocus` is blank on most records and that is
correct. A facet that does not apply should be left alone, not filled in.

## URLs

Use the publisher's own canonical page, not a mirror or an aggregator, and
prefer a landing page over a direct PDF where both exist.

The URL must start with `https://` and contain no whitespace. This is enforced
by the schema for a reason: five records once had an audience list concatenated
onto the end of their URL by a bad import, which broke every one of those links
and went unnoticed because the value still started with `https://`.

If no public URL exists, use `#`. Four records currently do, and they lead
nowhere — better to fix or remove them than to add more.

## `validated`

Set `validated: true` only when you have opened the URL and checked the tagging
yourself. It is a curator's signature, not a formality. The build collects these
into `metadata.validatedResources`.

Records that arrive from `.github/workflows/ai-draft.yml` are always
`validated: false` and carry a `machine-drafted` legacy tag. Every field in them
is a suggestion.

## Reviewing someone else's pull request

- Does the URL open, and is it the canonical page?
- Do title and organization match what the publisher says?
- Is the description factual, and free of marketing language?
- Do the topics describe what it is *about*?
- Is anything tagged so broadly it stops filtering narrowing?
- Is `validated` honest?

## Proposing without Git

Open an issue with the "Suggest a resource" template. A link and a sentence on
why it matters is enough; a curator handles the tagging.

## Drafting with AI

Actions → "Draft a resource record" → run with a URL. It fetches the page,
drafts a record against the current taxonomy, and opens a pull request for
review. Values the model invents are filtered out against the real vocabulary
before anything is written, and reported in the PR body so you can see what it
tried. Requires an `OPENAI_API_KEY` repository secret.

## Commands

    npm run new -- <id>   scaffold a record
    npm run build         regenerate resources-data.js and the schema
    npm run check         verify both are in sync with their sources
    npm run validate      check + full taxonomy validation

## The taxonomy

`public/taxonomy.js` is the single source of truth for every controlled
vocabulary. Adding a value there, running `npm run build`, and committing the
result is all that is needed — the schema, the editor autocomplete, the
validator and the site filters all follow from it.

Be slow to add topics. An empty facet value renders as a filter that returns
nothing; there are currently 11 such options, which is already too many.
