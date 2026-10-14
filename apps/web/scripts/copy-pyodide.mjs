import { mkdir, copyFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const pyodideRoot = path.dirname(require.resolve("pyodide"));
const output = path.join(appRoot, "public", "pyodide");
const runtimeFiles = ["pyodide.js", "pyodide.asm.js", "pyodide.asm.wasm", "pyodide-lock.json", "python_stdlib.zip"];

await mkdir(output, { recursive: true });
await Promise.all(runtimeFiles.map((file) => copyFile(path.join(pyodideRoot, file), path.join(output, file))));
await writeFile(path.join(output, "THIRD_PARTY_NOTICES.md"), "Pyodide 0.29.5 is distributed under the Mozilla Public License 2.0. Project and license: https://github.com/pyodide/pyodide\n");
console.log("Prepared local Pyodide runtime (" + runtimeFiles.length + " files).");
