import { readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import subsetFont from "subset-font";
import * as fontkit from "fontkit";

const require = createRequire(import.meta.url);
const inter = (file) => require.resolve(`@fontsource-variable/inter/${file}`);
const out = (name) => new URL(`../src/render/assets/${name}`, import.meta.url);

const chars = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i));
const text = chars.join("") + "…–—’“”";
const source = readFileSync(inter("files/inter-latin-wght-normal.woff2"));
const axes = { variationAxes: { wght: { min: 400, max: 700 } } };

writeFileSync(out("inter-diagram.woff2"), await subsetFont(source, text, { ...axes, targetFormat: "woff2" }));

const sfnt = await subsetFont(source, text, { ...axes, targetFormat: "sfnt" });
const font = fontkit.create(Buffer.from(sfnt)).getVariation({ wght: 400 });
const adv = Object.fromEntries(chars.map((c) => [c, font.layout(c).advanceWidth]));
const kern = {};
for (const a of chars) {
	for (const b of chars) {
		const k = font.layout(a + b).advanceWidth - adv[a] - adv[b];
		if (k) kern[a + b] = k;
	}
}
writeFileSync(out("inter-widths.json"), JSON.stringify({ em: font.unitsPerEm, adv, kern }));
copyFileSync(join(dirname(inter("package.json")), "LICENSE"), out("inter-LICENSE.txt"));
