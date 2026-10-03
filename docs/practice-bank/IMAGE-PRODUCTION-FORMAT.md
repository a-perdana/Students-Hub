# Subject-specific image production format

These are art-direction and review briefs, not runtime drawing rules. Each
question receives its own reviewed PNG. Shared typography hierarchy keeps the
bank coherent; each subject has its own lettering treatment, palette and
scientific notation in [IMAGE-STYLES.json](IMAGE-STYLES.json).

Font names describe the desired appearance, not a guarantee that image generation
uses that exact font. Inspect rendered lettering. If an exact font is essential,
typeset labels in a separate production step before approving the final bitmap.
Never approve a generated graph or equation just because it looks plausible.

## Question brief

Complete this record before changing a queue job to `ready-to-generate`:

```text
Item ID / bank / grade:
Source hash:
Subject style / version:
Learning objective:
Figure type and educational purpose:
Given objects, geometry or apparatus:
Given values and units (copy exactly):
Exact labels to display:
Unknowns and labels that must NOT be shown:
Spatial relationships / directions / circuit connections:
Data points / axis limits / tick intervals, if a graph:
Scale: exact from supplied data, or explicitly schematic:
Composition and aspect ratio:
Item-specific generation prompt:
Proposed asset path and alt text:
Scientific reviewer / findings:
Visual reviewer / mobile findings:
Approval decision:
```

The stem and choices are reviewed as context, not pasted into the image. Do not
draw the solution, a calculated result or a named structure the student must
identify. Omit names on identification tasks, including in alt text. Do not add
instructional captions that help select the correct option.

## Prompt assembly

Use the shared profile, selected subject profile and completed question brief
together. The content brief overrides artistic preferences; when a description
is ambiguous, return to brief review instead of inventing details.

```text
Create one clean textbook figure for [item ID], [grade], [subject].
Use the shared and [subject] style profiles, version [version].
Draw only: [reviewed objects and relationships].
Use exactly these labels and values: [reviewed list].
Keep unknown: [unknowns and withheld labels].
Arrange: [panel layout, orientation and aspect ratio].
Scientific constraints: [item-specific constraints].
Do not include: [solutions, inferred details, prohibited labels].
White background, no decorative frame; all labels readable at mobile size.
```

## Subject checks

| Subject | Lettering and visual identity | Mandatory content check |
| --- | --- | --- |
| Mathematics | Neutral labels, STIX-like maths, blue outlines, teal markers | Exact vertices, dimensions, angle arcs and plotted points |
| Physics | Technical sans-serif, tabular values, teal objects, red directional emphasis | SI units, reference frames, arrows and circuit topology |
| Chemistry | Upright formulae, precise indices and charges, purple/teal accents | Atom counts, bonds, reactions and apparatus connections |
| Biology | Humanist labels, tidy leaders, green/rose structural fills | Anatomy, process direction and identification-task leakage |

Use consistent palette semantics within each figure. Grade changes affect detail
density and vocabulary, not the core identity. Schematic dimensions must not
pretend to be measurable; graphs must preserve actual supplied data.

## Approval and publishing

1. Verify every label and scientific relationship against the source question.
2. Inspect the bitmap at desktop width and at 360 px display width. Check overlaps,
   tiny labels, cropping, contrast and colour-independent meaning.
3. Record the exact prompt, source hash, style version, model if known and review
   findings beside the image. Do not claim an unknown generation model.
4. Publish only after content and visual approval, following
   [DIAGRAM-WORKFLOW.md](DIAGRAM-WORKFLOW.md). Replacements get a new asset version.

A queue status tracks work; it is not an automatic scientific approval.
