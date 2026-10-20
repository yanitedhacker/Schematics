// Values are nominal design references. A missing tolerance is unknown, never zero.
export const CHECKED = "2026-10-20";
export const SOURCES = {
  supplier: {
    publisher: "Silicon Valley Microelectronics",
    title: "300 mm silicon wafers — SV025",
    url: "https://svmi.com/product/300mm-silicon-wafer/",
    location: "Product table, SV025 row, Thickness (µm)",
    scope: "Supplier product SV025 only; not a universal wafer tolerance or NXE:3800E input specification",
    checked: CHECKED,
  },
  nxe3400: {
    publisher: "ASML",
    title: "TWINSCAN NXE:3400B",
    url: "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe3400b",
    location: "Key features, Productivity and Optics",
    scope: "NXE:3400B; NXE family reference, not a dimensional certification of NXE:3800E",
    checked: CHECKED,
  },
  platform: {
    publisher: "ASML",
    title: "EUV lithography systems",
    url: "https://www.asml.com/en/products/euv-lithography-systems",
    location: "NXE systems; How does EUV work? Optical column",
    scope: "NXE platform; excludes the anamorphic High-NA EXE optics",
    checked: CHECKED,
  },
  source2023: {
    publisher: "ASML; hosted by EUVL workshop",
    title: "EUV Industrialization, Raymond Maas et al., 2023",
    url: "https://euvlitho.com/2023/P62.pdf#page=16",
    location: "PDF page 16, throughput specification; page 17, ATP targets",
    scope: "NXE:3800E historical reference; 96 full fields at 30 mJ/cm²",
    checked: CHECKED,
  },
  drawing: {
    publisher: "Supplied model",
    title: "Original drawing and recorded solids",
    url: null,
    location: "plan.mjs: one world unit is 1 cm; frozen source-shapes.json.gz",
    scope: "Schematic geometry with compressed placement; no manufacturer CAD validation",
    checked: CHECKED,
  },
};
const nominal = (id, label, value, unit, source, note) => ({
  id,
  label,
  value,
  unit,
  kind: "published",
  tolerance: null,
  source,
  scope: SOURCES[source].scope,
  note,
});
export const EVIDENCE = [
  nominal(
    "wafer",
    "Wafer diameter",
    300,
    "mm",
    "nxe3400",
    "Nominal NXE family reference. Edge notch, bevel and thickness are omitted.",
  ),
  {
    id: "wafer-thickness",
    label: "Wafer thickness — supplier example",
    value: 775,
    unit: "µm",
    kind: "published",
    tolerance: 25,
    source: "supplier",
    scope: SOURCES.supplier.scope,
    note: "SV025 product tolerance. Other products differ: SV026 lists ±10 µm. Thickness is not rendered in the planar comparison. A tolerance bound is not a statistical confidence interval.",
  },
  nominal(
    "field",
    "Full scanned exposure field",
    [26, 33],
    "mm",
    "nxe3400",
    "The complete scanned field, not the instantaneous slit. The source names NXE:3400B.",
  ),
  nominal(
    "reduction",
    "Linear pattern reduction",
    4,
    "×",
    "platform",
    "Isotropic NXE reference; do not transfer this to High-NA EXE.",
  ),
  {
    id: "mask-pattern",
    label: "Corresponding mask-pattern footprint",
    value: [104, 132],
    unit: "mm",
    kind: "derived",
    tolerance: null,
    source: "nxe3400",
    dependencies: ["field", "reduction"],
    formula: "[26, 33] mm × 4 = [104, 132] mm",
    scope: "Derived NXE pattern-area comparison",
    note: "Patterned area only. This is not the mask substrate size. Optical clearances are not included.",
  },
  {
    id: "slit",
    label: "Illustrated slit width",
    value: 2,
    unit: "mm",
    kind: "illustrative",
    tolerance: null,
    source: "drawing",
    scope: "Animation estimate",
    note: "Estimated short-axis width. No verified tolerance or NXE:3800E slit specification is assigned.",
  },
  {
    id: "placement",
    label: "Machine layout and component dimensions",
    value: null,
    unit: "mm",
    kind: "unknown",
    tolerance: null,
    source: "drawing",
    scope: "All 2,834 supplied source items",
    note: "Mesh bounds are model-only measurements. Real dimensions and their uncertainty are unknown. Machine length compression is retained.",
  },
  {
    id: "spacing",
    label: "Reference comparison spacing",
    value: null,
    unit: "mm",
    kind: "illustrative",
    tolerance: null,
    source: "drawing",
    scope: "True-scale reference view only",
    note: "Object sizes share a uniform metric. Their separation is for comparison, not the machine optical layout.",
  },
  {
    id: "throughput",
    label: "Historical scanner throughput reference",
    value: 220,
    unit: "wph",
    kind: "published",
    tolerance: null,
    source: "source2023",
    scope: "Dated reference, not the latest specification",
    note: "The animation is calibrated to this value; it does not predict productivity.",
  },
];
export const findEvidence = (id) => EVIDENCE.find((e) => e.id === id);
export const MM_PER_UNIT = 10;
export const mmToWorld = (n) => n / MM_PER_UNIT;
export const REFERENCE_SHAPES = {
  wafer: { diameter: mmToWorld(findEvidence("wafer").value), center: [-12, 0, 0] },
  field: { size: findEvidence("field").value.map(mmToWorld), center: [-12, 0, 0.025] },
  mask: { size: findEvidence("mask-pattern").value.map(mmToWorld), center: [18, 0, 0] },
};
export const toleranceBounds = (e) =>
  typeof e.value === "number" && Number.isFinite(e.tolerance)
    ? [e.value - e.tolerance, e.value + e.tolerance]
    : null;
export function uncertaintyText(e) {
  return e.tolerance == null
    ? e.kind === "unknown"
      ? "Physical dimensions and uncertainty unknown."
      : "Tolerance not reported; no numeric error bound assigned."
    : `Supplier tolerance: ±${e.tolerance} ${e.unit} (${toleranceBounds(e).join("–")} ${e.unit}); not a confidence interval.`;
}
export function valueText(e) {
  return e.value == null
    ? e.kind === "illustrative"
      ? "Comparison only"
      : "Unknown"
    : `${Array.isArray(e.value) ? e.value.join(" × ") : e.value} ${e.unit}`;
}
export function modelDimensions(object) {
  return object.bounds[1].map((x, i) => (x - object.bounds[0][i]) * MM_PER_UNIT);
}
export function niceScale(span, zoom, height) {
  const mmPerPixel = (span / zoom / height) * MM_PER_UNIT,
    target = mmPerPixel * 100,
    p = Math.pow(10, Math.floor(Math.log10(target))),
    mm = [1, 2, 5, 10].map((v) => v * p).find((v) => v >= target) || 10 * p;
  return { mm, pixels: mm / mmPerPixel };
}
