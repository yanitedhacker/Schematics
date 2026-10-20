# Schematics

Educational and research-oriented interactive schematics of the ultra-high-tech machines that power our world.

| # | Schematic | Machine |
| --- | --- | --- |
| 01 | [Inside the EUV cell](euv-lithography/) | ASML TWINSCAN NXE:3800E EUV lithography scanner |

Each schematic is a self-contained static web page in its `app/` folder. Clone or download this repo, then for example:

```sh
cd Schematics/euv-lithography
python3 -m http.server 8000 -d app
```

Open http://localhost:8000. See each schematic's README for details, a single-file build and iPad use.

## Licence

Code: [MIT](LICENSE). Drawings, geometry and text: [CC BY 4.0](LICENSE-CONTENT.md). You can use and adapt anything here, commercially too, if you credit the author.
