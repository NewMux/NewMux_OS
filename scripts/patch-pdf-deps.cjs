// postinstall: makes @react-pdf/renderer's dependencies run on Cloudflare
// Workers (see wrangler.jsonc). Node behaviour is unchanged. Idempotent, and a
// no-op for a dependency whose files no longer have the expected shape.
const fs = require("node:fs");
const path = require("node:path");

function pkgDir(name, entry) {
  try {
    let dir = path.dirname(require.resolve(entry ?? name));
    while (!fs.existsSync(path.join(dir, "package.json")))
      dir = path.dirname(dir);
    return dir;
  } catch {
    return undefined;
  }
}

// pdfkit's Node build loads its 14 standard fonts with
// `createRequire(import.meta.url)('#standard-fonts/…')` at runtime, which needs
// node_modules on disk. Static imports let the bundler include the (small)
// font metrics instead.
function patchPdfkit() {
  const dir = pkgDir("pdfkit");
  if (!dir) return;
  const file = path.join(dir, "js", "pdfkit.node.mjs");
  const source = fs.readFileSync(file, "utf8");
  const fonts = new Set();
  const body = source.replace(
    /require\$1\('#standard-fonts\/(\w+)'\)/g,
    (_, name) => {
      fonts.add(name);
      return `__stdFont_${name}`;
    },
  );
  if (fonts.size === 0) return;
  const imports = [...fonts].map(
    (name) => `import __stdFont_${name} from "pdfkit/standard-fonts/${name}";`,
  );
  fs.writeFileSync(file, `${imports.join("\n")}\n${body}`);
  console.log(`patch-pdf-deps: pdfkit bundles ${fonts.size} standard fonts`);
}

// yoga-layout (react-pdf's layout engine) compiles its WebAssembly from an
// inlined base64 string, which Workers forbid. Extract the .wasm file and add a
// "workerd" export condition that instantiates the precompiled module instead.
function patchYoga() {
  const dir = pkgDir("yoga-layout", "yoga-layout/load");
  if (!dir) return;
  const pkgFile = path.join(dir, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgFile, "utf8"));
  if (typeof pkg.exports?.["./load"] !== "string") return;
  const binary = fs.readFileSync(
    path.join(dir, "dist", "binaries", "yoga-wasm-base64-esm.js"),
    "utf8",
  );
  const match = binary.match(
    /data:application\/octet-stream;base64,([A-Za-z0-9+/=]+)/,
  );
  if (!match) return;
  fs.writeFileSync(
    path.join(dir, "dist", "binaries", "yoga.wasm"),
    Buffer.from(match[1], "base64"),
  );
  fs.writeFileSync(
    path.join(dir, "dist", "src", "load-workerd.js"),
    `import loadYogaImpl from "../binaries/yoga-wasm-base64-esm.js";
import yogaWasm from "../binaries/yoga.wasm";
import wrapAssembly from "./wrapAssembly.js";
export async function loadYoga() {
  return wrapAssembly(
    await loadYogaImpl({
      instantiateWasm(imports, done) {
        WebAssembly.instantiate(yogaWasm, imports).then((instance) => done(instance, yogaWasm));
        return {};
      },
    }),
  );
}
export * from "./generated/YGEnums.js";
`,
  );
  pkg.exports["./load"] = {
    workerd: "./dist/src/load-workerd.js",
    default: pkg.exports["./load"],
  };
  fs.writeFileSync(pkgFile, `${JSON.stringify(pkg, null, 2)}\n`);
  console.log(
    "patch-pdf-deps: yoga-layout loads a precompiled module on workerd",
  );
}

patchPdfkit();
patchYoga();
