# Question-specific diagram assets

The student-facing diagram is a versioned file tied to an item ID. Generate it
once, review it against the question, and publish the approved file. Runtime
keyword matching must not invent geometry, apparatus, components or values.

These production files belong to Students Hub. Question sources, validation and
publishing belong to the external shared bank; see [README.md](README.md) for
the repository boundary and standalone-clone commands.

## Production

1. Read the full stem, options and learning objective. Decide whether a visual
   helps and write an item-specific brief containing only given information.
   Use [IMAGE-PRODUCTION-FORMAT.md](IMAGE-PRODUCTION-FORMAT.md) and the matching
   subject profile in [IMAGE-STYLES.json](IMAGE-STYLES.json).
2. Generate an item-specific raster image using the built-in image generation
   tool. Include exact labels, values and scientific constraints in the prompt.
   Save the exact prompt and review notes beside the image. Existing authored
   SVG assets may remain, but new production uses the one-off image workflow.
3. Check every value, label, connection, direction and angle against the stem.
   A graph must use the actual data or specified function. Mark schematic views
   as not to scale. Check that the visual and its alt text do not reveal answers.
4. Inspect the rendered asset at desktop and mobile widths. Check legibility,
   clipping, overlaps and contrast. A subject reviewer approves its content.
5. Save the approved file here as `assets/<bank>/<itemId>.v1.png`, with its
   prompt and review record. Copy that approved version to the external bank's
   `assets/` directory for its existing upload path. Set
   `diagramNeeded`, `diagramType`, `diagramAsset`, `diagramAlt` and `diagramBrief`
   in the item JSON. A corrected drawing uses `.v2.png` so cached assets cannot
   continue showing the previous version.
6. From the shared workspace, run `node scripts/practice/validate-items.js <bank>`
   and `node scripts/practice/audit-visuals.js`. The existing seeder uploads the file
   and stores `diagramStoragePath`; Students Hub displays the asset directly.
   These mechanical checks do not replace subject review.
   For an existing question, use `--only=<item-id> --diagram-only` on the seeder
   to review the dry run, then add `--apply` to upload and attach only its image.
   This requires the live stem to match the source and preserves all question
   content and status fields.

## Existing pool

From Students Hub, run `npm run images:plan -- --bank-root="../docs/practice-bank"` to rebuild
`reviews/image-production-queue.json`. The queue retains existing production
requests and adds author-declared missing diagrams. It counts other questions as
untriaged, not as questions that do not need a visual. A ten-question first batch
spans mathematics, physics, biology and chemistry using questions with passing
content reviews. Each candidate still requires an item-specific brief review.

Track work through `brief-review`, `ready-to-generate`, `generated`,
`content-review`, `approved`, `published` or `skipped`. Put the exact prompt and
review notes in its queue record. Queue rebuilds retain progress for unchanged
questions; changed stems/options return to brief review. Queue states do not
automatically authorize publishing or generate images.

Use the attachment audit to find missing files. Prioritize questions whose
spatial relationships, processes or data would benefit from a visual, retaining
the queue's reviewed priorities. Produce and approve batches by subject. Visuals are optional for
questions that do not benefit from them; do not attach a generic illustration
just because a subject keyword occurs.

The collision question `g11-science-r3740-c` has a generated, reviewed PNG and
its exact production prompt in this repository. The earlier radio/gamma SVG
remains an authored asset in the external bank. Practice Run displays only attached image assets; it no
longer contains the automatic question-visual renderer. There is no fallback
drawing when an image is missing. The seeder deletes obsolete live `visual`
fields on subsequent item updates; no bulk live-content rewrite is needed.
