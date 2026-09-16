/**
 * Fails the build when a client component imports a *value* from lib/data.
 *
 * lib/data/store.ts uses node:crypto, so anything that reaches it from a
 * "use client" module lands in the browser bundle and dies at runtime with
 * "randomUUID is not a function" — a failure that typechecks and builds
 * cleanly, and only surfaces when someone opens the feature. `import type`
 * is erased at compile time and is always fine.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// --others --exclude-standard so new, not-yet-committed files are scanned too:
// those are exactly the ones most likely to introduce this.
const files = execSync(
  "git ls-files --cached --others --exclude-standard '*.ts' '*.tsx'",
  { encoding: "utf8" },
)
  .split("\n")
  .filter(Boolean);

// Whole import statements, so `import type {\n  A,\n  B,\n} from …` spanning
// several lines is read as one unit rather than by its closing brace. The
// clause may not itself contain `import`, which keeps the lazy match from
// swallowing every preceding statement in the file.
const IMPORT =
  /import\s+(type\s+)?((?:(?!\bimport\b)[\s\S])*?)\s*from\s*["'](@\/lib\/data\/[^"']+)["']/g;

const offenders = [];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  if (!/^\s*["']use client["']/m.test(source)) continue;

  for (const match of source.matchAll(IMPORT)) {
    const [statement, typeKeyword, clause, module] = match;
    if (typeKeyword) continue;
    // lib/data/types.ts declares types only, so it emits nothing at runtime.
    if (module === "@/lib/data/types") continue;
    // `import { type Foo, type Bar }` is erased too.
    const named = clause?.match(/\{([\s\S]*)\}/)?.[1];
    if (
      named &&
      named
        .split(",")
        .filter((s) => s.trim())
        .every((s) => /^\s*type\s/.test(s))
    )
      continue;

    const line = source.slice(0, match.index).split("\n").length;
    offenders.push(`${file}:${line}  ${statement.replace(/\s+/g, " ")}`);
  }
}

if (offenders.length > 0) {
  console.error(
    "Client components must not import values from lib/data. Use `import type`,\n" +
      "or move the shared value into a module that imports nothing from lib/data:\n",
  );
  for (const offender of offenders) console.error("  " + offender);
  process.exit(1);
}

console.log(
  `No client-side lib/data value imports (${files.length} files scanned).`,
);
