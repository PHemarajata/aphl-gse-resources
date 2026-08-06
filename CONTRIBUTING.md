# Contributing

This is a curated collection. The value is in the judgement, not the volume — a
resource that is merely relevant makes the collection worse, because it dilutes
the ones that are genuinely useful.

Everything below assumes you have a GitHub account and write access to this
repository. Ask the repository owner if you do not.

## The short version

Go to **[the curation form](https://phemarajata.github.io/aphl-gse-resources/curate.html)**,
fill it in, press the button at the bottom right. GitHub opens a pull request.
Someone with write access approves it, and merging publishes the site.

You do not need to install anything, clone anything, or use a terminal.

## The curation form

The form is a page on the site itself. It reads the same vocabulary file the
site and the automated checks read, so the tags it offers are exactly the tags
that are valid — you cannot invent one by mistyping.

It does three things.

**Add a new resource.** Fill in the fields. The record ID is generated from the
title; change it if you want something shorter. As you type, the panel on the
right tells you what would fail the automated check and what is merely a
judgement call. When it is clean, press *Open a pull request on GitHub*. GitHub
opens with the new file already written for you. Scroll to the bottom of that
page, choose **Create a new branch and start a pull request**, and describe why
the resource belongs here.

**Edit an existing one.** Choose *Edit an existing one* and pick the resource.
The form fills itself in from what is currently published. Change what you need
to, then press *Copy, then open the file on GitHub*. That copies the corrected
record and opens the existing file in GitHub's editor. Select everything there,
paste, and choose **Create a new branch and start a pull request**.

**Remove one.** Choose *Remove one*, pick the resource, press the button. GitHub
opens its delete-file page and offers the same pull request option. You do not
need to touch anything else — the display order file tolerates a removed record.

In all three cases nothing changes on the live site until a pull request is
approved and merged. The form has no ability to write to the site. That is
deliberate: the previous browser admin panel *could* write, and could silently
destroy work, which is why it was retired.

## What happens after you submit

Two automated checks run on the pull request:

- **Validate** — rebuilds the data from your record and checks every resource
  against the vocabulary. If the form said you were clean, this passes.
- **Link check** — runs weekly rather than per pull request, so a new URL is not
  verified until the following week's run.

A reviewer then reads the record itself, which is the part no machine can do:
is this resource actually good, is it already covered by something in the
collection, are the tags the ones someone would search by.

On merge, the site rebuilds and publishes automatically. There is no separate
deploy step.

## Tagging: the part that actually matters

The form will happily let you tick fifteen boxes. Do not.

Tag for **how someone would look for this**, not for everything it touches. A
national genomic surveillance strategy touches workforce, financing, data
sharing, and laboratory networks — but if you tag all four, it appears in every
search and helps in none of them.

Two specific traps, both learned the hard way from this collection's own
history:

- **`genomic-surveillance`** applies to nearly everything here. Use it only
  where the surveillance system, programme, or strategy *is* the subject — not
  for a tool that happens to be used in surveillance.
- **`stakeholder-engagement`** should mean convening, engaging, or coordinating
  stakeholders. It should not mean "this document mentions planning". At one
  point 86% of records carried it, which made it worthless as a filter.

Each field shows a recommended maximum. Exceeding it is allowed and will not
fail the automated check — it is a judgement call, and the form flags it in
amber so you make that call deliberately. Topics recommend a maximum of five.

If the tag you need genuinely does not exist, do not force a near-enough one.
Open an issue. Adding vocabulary is a small change to `public/taxonomy.js`, but
it needs a developer, because the record schema is generated from it.

## URLs

Prefer a DOI (`https://doi.org/…`) for anything published. Publisher URLs move
and platforms get reorganised; DOIs do not. Four of this collection's dead links
were publisher URLs whose content had simply been relocated.

For a tool or an organisation, link the thing itself — the project homepage or
repository — rather than a news article about it.

## The `validated` flag

New records are created with `"validated": false`. It means "not yet checked by
a second pair of eyes", not "bad". A reviewer sets it to `true` once they have
confirmed the record is accurate and well tagged. Editing an existing record
preserves whatever it already had; if your edit is substantial, say so in the
pull request so the reviewer knows to look again.

## Proposing a resource without a GitHub account

Open an issue using the **Add a resource** template. Someone with access will
turn it into a pull request. Slower, but nothing is lost.

## Drafting with AI

There is a workflow that drafts a record from a URL. It is a starting point, not
a submission: it always marks the result `validated: false`, and it filters its
own output against the real vocabulary so it cannot invent a tag. Read what it
produced before opening a pull request — particularly the description, which is
where a model will confidently write something plausible and wrong.

## For developers

You only need this section if you are changing the site, the scripts, or the
taxonomy. Curation does not require it.

```bash
git clone https://github.com/PHemarajata/aphl-gse-resources.git
cd aphl-gse-resources
```

Node 20 or newer. There is no `npm install` — every script here is
zero-dependency on purpose, so nothing rots.

```bash
npm run build      # data/ -> public/resources-data.js, and the record schema
npm run validate   # build, then check the schema and every record
npm run preview    # build, then serve the site on http://localhost:8080
npm run new -- my-resource-id   # scaffold a new record file
```

`public/resources-data.js` is a build artifact and is **not** committed. It is
built by CI on every pull request and again at deploy time. Run `npm run build`
after pulling, or `npm run preview`, which does it for you.

The normal loop:

```bash
git checkout main && git pull
git checkout -b short-description-of-change
# edit
npm run validate
git add -A
git commit -m "what changed, and why"
git push -u origin short-description-of-change
```

Then open a pull request.

### Never edit these by hand

- **`public/resources-data.js`** — generated from `data/`. Not committed. Any
  hand edit is erased by the next build.
- **`data/resource.schema.json`** — generated from `public/taxonomy.js`. Edit
  the taxonomy and run `npm run build`. CI fails if these two disagree, and that
  check is the one thing a browser cannot satisfy, which is why taxonomy changes
  need a clone.

## The taxonomy

`public/taxonomy.js` is the single source of truth for the controlled
vocabulary. The site, the curation form, the record schema, and the validators
all read it. Version 2.0.0 keeps every v1 value unchanged and adds eight
optional secondary facets, all defaulting to "not assessed" — an honest blank is
more useful than a guess.
