import{writeFileSync}from'node:fs';import{EVIDENCE,SOURCES,valueText,uncertaintyText}from'../app/src/evidence.js';
const save=(name,text)=>writeFileSync(new URL('../'+name,import.meta.url),text);
save('app/dimension-evidence.json',JSON.stringify({checked:'2026-10-20',sources:SOURCES,evidence:EVIDENCE,unitBasis:'1 original model unit = 10 mm; no guessed decompression'},null,2)+'\n');
const rows=EVIDENCE.map(e=>`| ${e.label} | ${valueText(e)} | ${e.kind} | ${uncertaintyText(e)} | ${e.source} |`).join('\n');const sources=Object.entries(SOURCES).map(([id,s])=>`- **${id}**: ${s.url?`[${s.title}](${s.url})`:s.title}. ${s.location}. Scope: ${s.scope}. Accessed ${s.checked}.`).join('\n');
save('DIMENSION-SOURCES.md',`# Dimension and uncertainty ledger

Verified on 20 October 2026. Published numbers are nominal. Missing tolerances remain unknown, not zero. The supplier example has a bounded tolerance; it is not a statistical uncertainty or a confidence interval.

| Dimension / parameter | Value | Evidence class | Uncertainty | Source |
|---|---|---|---|---|
${rows}

## Primary sources and model provenance

${sources}

## Derived mask-pattern footprint

[26, 33] mm × 4 = [104, 132] mm. Reduction applies to each linear dimension. This is a pattern area, not the reticle substrate outline. The derived dimensions inherit the unreported input tolerances. No error bars or confidence intervals are assigned.

The wafer and full-field sizes are explicitly published for NXE:3400B. They form a labelled NXE family comparison, not a verified NXE:3800E mechanical specification. Machine geometry remains the supplied compressed model.

## Supplier tolerance example

SVM product SV025 lists 775 ±25 µm thickness. The arithmetic bound is 750–800 µm. SV026 on the same page lists ±10 µm, which shows why this bound must not be applied to every wafer. Neither product is asserted to be the input wafer for a particular NXE:3800E recipe. Thickness is not drawn in the planar size view. Tolerance is a product limit, not a probability distribution or measurement confidence interval.

## Model bounds

Selected items show X/Y/Z extents from their frozen world-axis mesh bounds, multiplied by 10 mm per original centimetre unit. These are model-derived extents, not hardware measurements. Display rounding to 0.1 mm does not imply physical accuracy. The optional bounding box follows recorded group translation during breakdown and process motion.

## True-scale scope

Nominal planar shapes share one uniform metric with an orthographic camera. Thickness, bevel and notch are omitted. Separation is illustrative. The ruler reports length in the camera view plane. Under orbit, object-axis dimensions can appear shorter because of foreshortening; use the reset comparison for direct planar comparison. Camera zoom does not establish a physical screen size or a 1:1 print scale. No anisotropic transform is applied to the source machine to imply missing dimensional evidence.
`);
