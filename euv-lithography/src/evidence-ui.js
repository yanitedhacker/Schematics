import { EVIDENCE, SOURCES, valueText, uncertaintyText, modelDimensions, niceScale } from "./evidence.js";
const $ = (id) => document.getElementById(id),
  LABELS = {
    published: "P · Published nominal",
    derived: "D · Derived",
    illustrative: "I · Illustrative",
    unknown: "U · Unknown",
  };
export function mountEvidence() {
  const draw = () => {
    const frag = document.createDocumentFragment(),
      filter = $("evidence-filter").value;
    for (const e of EVIDENCE.filter((e) => filter === "all" || e.kind === filter)) {
      const tr = document.createElement("tr");
      tr.dataset.evidence = e.id;
      const cells = Array.from({ length: 4 }, () => document.createElement("td"));
      cells[0].textContent = e.label;
      cells[1].textContent = valueText(e);
      const tag = document.createElement("small");
      tag.textContent = LABELS[e.kind];
      tag.dataset.kind = e.kind;
      cells[1].append(tag);
      cells[2].textContent = e.scope;
      const uncertainty = document.createElement("small");
      uncertainty.textContent = uncertaintyText(e) + " " + e.note;
      cells[2].append(uncertainty);
      const source = SOURCES[e.source],
        a = document.createElement(source.url ? "a" : "span");
      a.textContent = source.title;
      if (source.url) {
        a.href = source.url;
        a.target = "_blank";
        a.rel = "noopener";
      }
      cells[3].append(a);
      const loc = document.createElement("small");
      loc.textContent = e.formula || source.location;
      cells[3].append(loc);
      tr.append(...cells);
      frag.append(tr);
    }
    $("evidence-rows").replaceChildren(frag);
  };
  draw();
  $("evidence-filter").addEventListener("change", draw);
  $("export-evidence").addEventListener("click", () => {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { sources: SOURCES, evidence: EVIDENCE, units: "mm unless stated; 1 model unit = 10 mm" },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = "litho-dimension-evidence.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
}
export function showObjectDimensions(o) {
  const panel = $("object-dimensions");
  panel.hidden = !o;
  if (!o) return;
  const mm = modelDimensions(o),
    name = document.createElement("strong"),
    value = document.createElement("p"),
    uncertainty = document.createElement("p"),
    a = document.createElement("a");
  name.textContent = "D · Model bounds, X × Y × Z";
  value.textContent = mm.map((v) => v.toFixed(1)).join(" × ") + " mm";
  uncertainty.textContent =
    "U · Real dimensions and uncertainty unknown. Axis-aligned mesh bounds; placement compression retained. Decimal display is not measurement accuracy.";
  a.textContent = "Read evidence and limits ↓";
  a.href = "#evidence-ledger";
  panel.replaceChildren(name, value, uncertainty, a);
}
export function updateScaleHUD(solid) {
  const on = !!solid?.referenceMode;
  for (const id of ["reference-labels", "scale-ruler"]) if ($(id).hidden !== !on) $(id).hidden = !on;
  if (!on) return;
  solid.camera.updateMatrixWorld(true);
  const layer = $("reference-labels");
  if (!layer.childElementCount)
    for (const item of solid.reference.labels) {
      const e = document.createElement("span");
      e.textContent = item.text;
      e.dataset.kind = item.kind;
      layer.append(e);
    }
  const matrixKey =
    solid.camera.matrixWorld.elements.join(",") +
    solid.camera.zoom +
    solid.canvas.clientWidth +
    ":" +
    solid.canvas.clientHeight;
  if (updateScaleHUD.key === matrixKey) return;
  updateScaleHUD.key = matrixKey;
  const w = solid.cssWidth,
    h = solid.cssHeight;
  for (let i = 0; i < solid.reference.labels.length; i++) {
    const p = solid.reference.labels[i].at,
      xy = solid.projectReference(p),
      e = layer.children[i];
    e.style.left = xy[0] * w + "px";
    e.style.top = xy[1] * h + "px";
    e.hidden = xy[0] < 0 || xy[0] > 1 || xy[1] < 0 || xy[1] > 1;
  }
  const ruler = niceScale(solid.span, solid.camera.zoom, h);
  $("scale-bar").style.width = ruler.pixels + "px";
  $("scale-value").textContent = ruler.mm + " mm";
}
