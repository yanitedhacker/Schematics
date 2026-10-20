// The truth model of the litho cell. Pure numbers and pure functions of time: the build samples them,
// the page plays them. Every constant carries its source tag; see SOURCES at the bottom.

export const FACTS = {
  wavelength_nm: 13.5,                 // [asml-products]
  na: 0.33,                            // [asml-3800e]
  reduction: 4,                        // [lowisch2012]
  field_mm: [26, 33],                  // [asml-3600d]
  chief_ray_deg: 6,                    // [semieng-mask3d]
  resolution_nm: 13,                   // [asml-3800e]
  pob_mirrors: 6,                      // [zeiss-euv]
  mirror_reflectivity: 0.7,            // [zeiss-euv] "up to 70 percent"
  droplet_um: 25,                      // [asml-light]
  droplet_speed_ms: 70,                // [asml-light]
  droplet_rate_hz: 50000,              // [asml-light]
  plasma_c: 220000,                    // [asml-x-plasma]
  ce: 0.055,                           // [fomenkov] about 5%, 6% best
  collector_reflectivity: 0.67,        // [fomenkov]
  laser_kw: 40,                        // [trumpf-laser]
  laser_um: 10.6,                      // [fomenkov]
  laser_t: 17,                         // [trumpf-laser] 17,090 kg
  source_w: 250,                       // [sciencedirect-3400b] NXE:3400B at intermediate focus
  source_w_3800e: 500,                 // ">500 W at IF" [euvlitho-2023-p62]
  mmo_nm: 0.9,                         // matched-machine overlay, NXE:3800E [euvlitho-2023-p62]
  alignment_marks: "tens",             // for wafer positioning; >1,000 for overlay [asml-orion]
  reticle_g: 8,                        // DERIVED: EXE 32 g is "4x NXE" [asml-highna]
  wafer_g: 4,                          // DERIVED: EXE 8 g is "2x NXE" [asml-highna]
  wafer_scan_ms: 0.3,                  // NXE:3400B max wafer scan speed [lercel-kek]
  reticle_scan_ms: 1.2,                // 4x the wafer, opposite sign [heertjes2020]
  scan_ms_per_field: 117,              // DERIVED: (33 + 2) mm at 0.3 m/s
  fields_per_wafer: 96,                // throughput layout [euvlitho-2023-p62]
  slit_mm: [26, 2],                    // arc slit at the wafer, ESTIMATED width [US6840640B2]
  mask_to_wafer_mm: [1500, 1650],      // [lowisch2012]
  h2_pa_scanner: 5,                    // [euvlitho-2024-s45]
  h2_pa_collector: 100,                // [euvlitho-2024-s45]
  position_hz: 20000,                  // [asml-mechanics]
  position_pm: 60,                     // [asml-mechanics]
  wph: 220,                            // NXE:3800E spec, 96 full fields at 30 mJ/cm2 [euvlitho-2023-p62]; >195 at launch [semiwiki-3800e]
  dose_mj_cm2: 30,                     // [asml-3800e]
  foup_wafers: 25,                     // [wiki-foup]
  wafer_mm: 300,
  tool_t: [150, 200],                  // [reuters-explainer], [intel-euv]
  power_mw: 1,                         // [arxiv-2405.11717]
  price_musd: 180,                     // [semiwiki-3800e]
  peb_c: [110, 120],                   // [uspto-8614047] example recipe
  tmah_n: 0.26,                        // [uspto-8614047]
};

// transmission of the six projection mirrors alone
export const POB_TRANSMISSION = FACTS.mirror_reflectivity ** FACTS.pob_mirrors;

// the steps one wafer takes through the cell, in order, with their real meaning
export const STEPS = [
  { id: "deliver", word: "FOUP in", say: "overhead hoist sets the FOUP on the load port" },
  { id: "coat", word: "coat", say: "resist spun on, soft-baked" },
  { id: "load", word: "load lock", say: "into vacuum through the load lock" },
  { id: "measure", word: "measure", say: "height map and alignment marks" },
  { id: "swap", word: "swap", say: "stages trade places" },
  { id: "expose", word: "expose", say: "step and scan, field by field" },
  { id: "unload", word: "unload", say: "out through the load lock" },
  { id: "develop", word: "PEB · develop", say: "post-exposure bake, developer" },
  { id: "return", word: "FOUP out", say: "back in the FOUP" },
];

export const SOURCES = {
  "asml-products": "https://www.asml.com/en/products/euv-lithography-systems",
  "asml-3800e": "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3800e",
  "asml-3600d": "https://www.asml.com/en/products/euv-lithography-systems/twinscan-nxe-3600d",
  "asml-light": "https://www.asml.com/en/technology/lithography-principles/light-and-lasers",
  "asml-mechanics": "https://www.asml.com/en/technology/lithography-principles/mechanics-and-mechatronics",
  "asml-x-plasma": "https://x.com/ASMLcompany/status/1831233871163101645",
  "euvlitho-2023-p62": "https://euvlitho.com/2023/P62.pdf",
  "asml-orion": "https://www.asml.com/en/company/stories/2021/fellow-simon-mathijssen-aligning-lithography-nanometer",
  "asml-highna": "https://www.asml.com/en/company/stories/2024/5-things-high-na-euv",
  "lercel-kek": "http://pfwww.kek.jp/PEARL/EUV-FEL_Workshop2/Proceedings/01_Lercel.pdf",
  "heertjes2020": "https://fab.cba.mit.edu/classes/865.24/topics/mechanical_design/mechanical_design/precision-frontier/Control_of_Wafer_Scanners_Methods_and_Developments.pdf",
  "US6840640B2": "https://patents.google.com/patent/US6840640B2",
  "euvlitho-2024-s45": "https://euvlitho.com/2024/S45.pdf",
  "lowisch2012": "https://euvlsymposium.lbl.gov/pdf/2012/pres/M.%20Lowisch.pdf",
  "semieng-mask3d": "https://semiengineering.com/next-euv-issue-mask-3d-effects",
  "zeiss-euv": "https://www.zeiss.com/semiconductor-manufacturing-technology/inspiring-technology/euv-lithography.html",
  "fomenkov": "https://scispace.com/pdf/light-sources-for-high-volume-manufacturing-euv-lithography-3peitxpiph.pdf",
  "trumpf-laser": "https://www.trumpf.com/en_INT/solutions/applications/euv-lithography/euv-drive-laser/",
  "sciencedirect-3400b": "https://www.sciencedirect.com/science/article/pii/S270947232200017X",
  "semiwiki-3800e": "https://semiwiki.com/forum/threads/asml-delivers-cutting-edge-new-chipmaking-tool-%E2%80%94-third-generation-euv-enables-2nm-processors-and-beyond.19854/",
  "wiki-foup": "https://en.wikipedia.org/wiki/FOUP",
  "reuters-explainer": "https://finance.yahoo.com/news/explainer-250-million-asml-printer-050227041.html",
  "intel-euv": "https://www.intel.com/content/www/us/en/newsroom/news/euv-most-precise-complex-machine.html",
  "arxiv-2405.11717": "https://arxiv.org/pdf/2405.11717",
  "uspto-8614047": "https://image-ppubs.uspto.gov/dirsearch-public/print/downloadPdf/8614047",
};
