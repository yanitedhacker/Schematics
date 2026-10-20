# Dimension and uncertainty ledger

Verified on 20 October 2026. Published numbers are nominal. Missing tolerances remain unknown, not zero. The supplier example has a bounded tolerance; it is not a statistical uncertainty or a confidence interval.

| Dimension / parameter | Value | Evidence class | Uncertainty | Source |
|---|---|---|---|---|
| Wafer diameter | 300 mm | published | Tolerance not reported; no numeric error bound assigned. | nxe3400 |
| Wafer thickness — supplier example | 775 µm | published | Supplier tolerance: ±25 µm (750–800 µm); not a confidence interval. | supplier |
| Full scanned exposure field | 26 × 33 mm | published | Tolerance not reported; no numeric error bound assigned. | nxe3400 |
| Linear pattern reduction | 4 × | published | Tolerance not reported; no numeric error bound assigned. | platform |
| Corresponding mask-pattern footprint | 104 × 132 mm | derived | Tolerance not reported; no numeric error bound assigned. | nxe3400 |
| Illustrated slit width | 2 mm | illustrative | Tolerance not reported; no numeric error bound assigned. | drawing |
| Machine layout and component dimensions | Unknown | unknown | Physical dimensions and uncertainty unknown. | drawing |
| Reference comparison spacing | Comparison only | illustrative | Tolerance not reported; no numeric error bound assigned. | drawing |
| Historical scanner throughput reference | 220 wph | published | Tolerance not reported; no numeric error bound assigned. | source2023 |

## Primary sources and model provenance

- **supplier**: [300 mm silicon wafers — SV025](https://svmi.com/product/300mm-silicon-wafer/). Product table, SV025 row, Thickness (µm). Scope: Supplier product SV025 only; not a universal wafer tolerance or NXE:3800E input specification. Accessed 2026-10-20.
- **nxe3400**: [TWINSCAN NXE:3400B](https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b). Key features, Productivity and Optics. Scope: NXE:3400B; NXE family reference, not a dimensional certification of NXE:3800E. Accessed 2026-10-20.
- **platform**: [EUV lithography systems](https://www.asml.com/en/products/euv-lithography-systems). NXE systems; How does EUV work? Optical column. Scope: NXE platform; excludes the anamorphic High-NA EXE optics. Accessed 2026-10-20.
- **source2023**: [EUV Industrialization, Raymond Maas et al., 2023](https://euvlitho.com/2023/P62.pdf#page=16). PDF page 16, throughput specification; page 17, ATP targets. Scope: NXE:3800E historical reference; 96 full fields at 30 mJ/cm². Accessed 2026-10-20.
- **drawing**: Original drawing and recorded solids. plan.mjs: one world unit is 1 cm; frozen source-shapes.json.gz. Scope: Schematic geometry with compressed placement; no manufacturer CAD validation. Accessed 2026-10-20.

## Derived mask-pattern footprint

[26, 33] mm × 4 = [104, 132] mm. Reduction applies to each linear dimension. This is a pattern area, not the reticle substrate outline. The derived dimensions inherit the unreported input tolerances. No error bars or confidence intervals are assigned.

The wafer and full-field sizes are explicitly published for NXE:3400B. They form a labelled NXE family comparison, not a verified NXE:3800E mechanical specification. Machine geometry remains the supplied compressed model.

## Supplier tolerance example

SVM product SV025 lists 775 ±25 µm thickness. The arithmetic bound is 750–800 µm. SV026 on the same page lists ±10 µm, which shows why this bound must not be applied to every wafer. Neither product is asserted to be the input wafer for a particular NXE:3800E recipe. Thickness is not drawn in the planar size view. Tolerance is a product limit, not a probability distribution or measurement confidence interval.

## Model bounds

Selected items show X/Y/Z extents from their frozen world-axis mesh bounds, multiplied by 10 mm per original centimetre unit. These are model-derived extents, not hardware measurements. Display rounding to 0.1 mm does not imply physical accuracy. The optional bounding box follows recorded group translation during breakdown and process motion.

## True-scale scope

Nominal planar shapes share one uniform metric with an orthographic camera. Thickness, bevel and notch are omitted. Separation is illustrative. The ruler reports length in the camera view plane. Under orbit, object-axis dimensions can appear shorter because of foreshortening; use the reset comparison for direct planar comparison. Camera zoom does not establish a physical screen size or a 1:1 print scale. No anisotropic transform is applied to the source machine to imply missing dimensional evidence.
