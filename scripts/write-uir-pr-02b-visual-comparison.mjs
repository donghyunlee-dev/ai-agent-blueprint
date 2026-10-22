import { readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const directory = path.resolve('.pr-artifacts/UIR-PR-02B');
const evidence = JSON.parse(await readFile(path.join(directory, 'reference-geometry.json'), 'utf8'));
const head = process.env.UIR_PR_HEAD_SHA ?? execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const { main, hero, composer, recent, textarea } = evidence.geometry;
const files = (await readdir(directory)).filter((file) => file.endsWith('.png')).sort();
const viewport = { width: 1672, height: 941 };
const formatDelta = (reference, rendered, dimension) => {
  const delta = rendered - reference;
  const isPosition = dimension === 'x' || dimension === 'y';
  const denominator = isPosition
    ? dimension === 'x' ? viewport.width : viewport.height
    : reference;
  const percent = delta / denominator * 100;
  const basis = isPosition
    ? `viewport ${dimension === 'x' ? 'width' : 'height'} (${denominator}px)`
    : `reference ${dimension} (${denominator}px)`;
  return `${delta >= 0 ? '+' : ''}${delta}px (${percent >= 0 ? '+' : ''}${percent.toFixed(1)}% of ${basis})`;
};
const mainRow = `| Main content inner canvas | x≈304, y=N/A, w≈1319, h=N/A | x=${main.x}, y=${main.y}, w=${main.width}, h=${main.height} | x ${formatDelta(304, main.x, 'x')}; y N/A; width ${formatDelta(1319, main.width, 'width')}; height N/A | Reference inner canvas is bounded by the populated recent/start cards. The design has no clear vertical boundary, so reference y/height are excluded. |`;
const heroTitleCenterX = Math.round(hero.x + hero.width / 2);
const heroTitleTopY = hero.y;
const heroRow = `| Hero/title | title center x≈905, title y≈217; glyph w/h=N/A | container x=${hero.x}, y=${hero.y}, w=${hero.width}, h=${hero.height}; title center x≈${heroTitleCenterX}, title top y≈${heroTitleTopY}; glyph w/h=N/A | title center x ${formatDelta(905, heroTitleCenterX, 'x')}; title y ${formatDelta(217, heroTitleTopY, 'y')}; container bounds reported separately | Reference is the visible title location. Glyph dimensions are not estimated because screenshot text edges are ambiguous. |`;
const composerRow = `| Composer | x≈413, y≈345, w≈985, h≈171 | x=${composer.x}, y=${composer.y}, w=${composer.width}, h=${composer.height} | x ${formatDelta(413, composer.x, 'x')}; y ${formatDelta(345, composer.y, 'y')}; width ${formatDelta(985, composer.width, 'width')}; height ${formatDelta(171, composer.height, 'height')} | Approximate screenshot card bounds. Height exception is documented below. |`;
const recentRow = `| Recent area | x≈304, y≈570, w≈1319, h=N/A | x=${recent.x}, y=${recent.y}, w=${recent.width}, h=${recent.height} | x ${formatDelta(304, recent.x, 'x')}; y ${formatDelta(570, recent.y, 'y')}; width ${formatDelta(1319, recent.width, 'width')}; height N/A | Reference shows populated cards; implementation comparison capture is empty state. Height is incomparable. |`;
const anchorRows = [mainRow, heroRow, composerRow, recentRow].join('\n');

const comparison = `# UIR-PR-02B visual comparison

- Reference: \`docs/blueprint-design/윈드소프트 모던 SaaS 대시보드.png\` (1672×941)
- Route/state: \`/\`, authenticated presentation mock, empty recent-project state
- CSS viewport: 1672×941; screenshot: \`home-empty-1672x941.png\`
- Final HEAD: \`${head}\`
- Runtime: local Vite preview, Playwright Chromium. The session mock verifies presentation only, not authentication.

| Anchor | Design reference (approx.) | Final rendered bounds | Signed deltas (rendered − reference) | Notes |
| --- | --- | --- | --- | --- |
${anchorRows}

Reference values are approximate measurements from the 1672×941 design image. Position delta percentages use the corresponding viewport axis (x: viewport width 1672px; y: viewport height 941px). Width and height delta percentages use the corresponding approximate reference dimension. N/A dimensions are omitted from comparison and percentage calculations.

## Exceptions and non-comparable anchors

- Composer height is ${Math.round((composer.height - 171) / 171 * 1000) / 10}% above the approximate 171px reference card height. \`docs/ui/screens/01-home-and-start.md\` H05 requires the input to show at least four rows; the measured textarea is ${textarea.height}px and its computed four-row minimum is ${textarea.minFourRows}px. This is the documented composer height exception.
- The design screenshot shows three populated recent-project cards, while the primary comparison capture is the empty-project state. Recent section bounds are therefore approximate layout comparison only; card contents and section height are not directly comparable. The artifact list includes populated one- and six-project states for inspection.
- The title glyph width/height and main-content inner-canvas y/height are not measurable with confidence from the screenshot and are marked N/A.

## Rail and header reference

| Anchor | Design reference (approx.) | Final rendered bounds | Signed deltas (rendered − reference) | Notes |
| --- | --- | --- | --- | --- |
| Rail | x≈0, y≈0, 250×941 | x=0, y=0, 248×941 | x +0px (0.0% of viewport width); y +0px (0.0% of viewport height); width -2px (-0.8% of reference width); height +0px (+0.0% of reference height) | Position/size comparable; Windsoft logo and branded treatment are excluded. |
| Header | x≈250, y≈0, 1422×72 | x=248, y=0, 1424×72 | x -2px (-0.1% of viewport width); y +0px (0.0% of viewport height); width +2px (+0.1% of reference width); height +0px (+0.0% of reference height) | Geometry comparable; brand/profile content differs and is excluded. |

Rail/header x and y percentages use the corresponding viewport axis; width and height percentages use the reference dimension.

A responsive continuity assertion samples 1598px, 1600px, and 1602px CSS widths and limits adjacent 2px changes to 6px for anchor position/height and 5px for width. Captures include loading and recent-project read-error/retry states at 1440×900 and 390×844, plus the other states listed below.

## Included final-HEAD screenshots

${files.map((file) => `- \`${file}\``).join('\n')}

The recent read-error screenshot is captured before activating retry; the test then verifies retry reaches the empty state. The loading screenshot uses a held synthetic IndexedDB open. No product behavior or persisted data is changed.
`;
await writeFile(path.join(directory, 'visual-comparison.md'), comparison);
