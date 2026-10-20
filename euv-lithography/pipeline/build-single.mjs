import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { build } from "esbuild";

const app = new URL("../app/", import.meta.url);
const read = (p) => readFileSync(new URL(p, app));
const files = [
  ...readdirSync(new URL("data/", app)).map((f) => "data/" + f),
  ...readdirSync(new URL("assets/", app)).map((f) => "assets/" + f),
];

const { outputFiles } = await build({
  entryPoints: [new URL("src/app.js", app).pathname],
  bundle: true,
  write: false,
  format: "esm",
  target: "es2022",
  minify: true,
  legalComments: "inline",
});

const inline = files
  .map((f) => `<script type="application/octet-stream" data-asset="${f}">${read(f).toString("base64")}</script>`)
  .join("");
const script = outputFiles[0].text.replace(/<\/script/gi, "<\\/script");

let html = read("index.html").toString();
const swap = (from, to) => {
  if (!html.includes(from)) throw Error("index.html is missing " + from);
  html = html.replace(from, () => to);
};
swap('<link rel="stylesheet" href="src/style.css">', `<style>${read("src/style.css")}</style>`);
html = html.replace(/<script type="importmap">[\s\S]*?<\/script>/, "");
swap('<script type="module" src="src/app.js"></script>', `${inline}<script type="module">${script}</script>`);

const out = new URL("../dist/euv-lithography.html", import.meta.url);
mkdirSync(new URL("./", out), { recursive: true });
writeFileSync(out, html);
console.log(`dist/euv-lithography.html ${(Buffer.byteLength(html) / 1048576).toFixed(1)} MiB`);
