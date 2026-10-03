# Question image production

This folder is the canonical home for subject art direction, item-specific image
production briefs, the pending production queue and generated images. These
files are versioned in the Students Hub repository, not served by the app build.

Start with [DIAGRAM-WORKFLOW.md](DIAGRAM-WORKFLOW.md) and
[IMAGE-PRODUCTION-FORMAT.md](IMAGE-PRODUCTION-FORMAT.md). The queue is in
`reviews/image-production-queue.json`; pending jobs are not finished images.

## Commands

Run from the Students Hub repository:

```sh
npm run test:image-production
npm run images:plan -- --bank-root="../docs/practice-bank"
npm run images:audit -- --bank-root="../docs/practice-bank"
```

`--bank-root` is the external authored question bank directory, containing
`items/` and subject `reviews/`. It is not the Students Hub production folder.
In the shared Eduversal workspace the sibling bank is selected by default.
A standalone clone can review the committed queue and images immediately, but
needs that external bank to refresh the queue or audit question attachments.
The tests use local fixtures and do not need Firebase, credentials or the bank.

The queue contains stems, choices and production briefs, not answer keys.
`sourceFile` paths are relative to the external bank. Question JSON, learning
objectives, verdicts, the validator and the Firestore seeder remain owned by the
shared workspace; they are not duplicated here.

## Images and publishing

`assets/<bank>/<itemId>.vN.png` is the versioned production image. Keep its exact
prompt and review record alongside it. The collision PNG already has a copy in
the shared bank for its existing `diagramAsset` upload path. That copy is
byte-identical; future versions must be copied to the shared bank only after
approval and before running the seeder.

Committing an image does not attach it to a live question. Publishing remains a
separate, targeted shared-workspace seeder operation. The generated collision
image was previously published to Firebase Storage; this repository migration
does not change its live question or storage path.
