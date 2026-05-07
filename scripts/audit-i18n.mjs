import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const sourceRoot = path.join(repoRoot, "src");
const { translateUiText } = await import(
  pathToFileURL(
    path.join(sourceRoot, "i18n", "index.js"),
  ).href
);

const SCAN_EXTENSIONS = new Set([".js", ".jsx"]);
const SKIP_DIRS = new Set(["assets", "i18n"]);
const VISIBLE_ATTRIBUTE_PATTERN =
  /\b(?:aria-label|title|placeholder|alt)\s*=\s*["']([^"']*[A-Za-z][^"']*)["']/g;
const JSX_TEXT_PATTERN = />\s*([^<>{}\n]*[A-Za-z][^<>{}\n]*)\s*</g;
const MESSAGE_SETTER_PATTERN =
  /\b(?:message|set[A-Z][A-Za-z]*Message|setErrorMessage|setRenderError)\s*(?:\(|:)\s*["']([^"']*[A-Za-z][^"']*)["']/g;

const IGNORE_TEXT = new Set([
  "Inkling",
  "Inkling Pro",
  "React",
  "Vite",
  "Convex",
  "PDF",
  "EPUB",
  "CBZ",
  "MOBI",
  "AZW3",
  "PNG",
  "SVG",
  "JPEG",
  "JPG",
  "WEBP",
  "Menu",
  "v0.1",
  "&larr;",
  "&rarr;",
]);

function shouldScanFile(filePath) {
  return SCAN_EXTENSIONS.has(path.extname(filePath));
}

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) {
        files.push(...(await walk(fullPath)));
      }
      continue;
    }

    if (entry.isFile() && shouldScanFile(fullPath)) {
      files.push(fullPath);
    }
  }

  return files;
}

function lineNumberForIndex(source, index) {
  return source.slice(0, index).split(/\r?\n/).length;
}

function normalizeCandidate(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isLikelyVisibleText(value) {
  const normalized = normalizeCandidate(value);
  if (!normalized || IGNORE_TEXT.has(normalized)) {
    return false;
  }

  if (/[À-ỹĐđ]/.test(normalized)) {
    return false;
  }

  if (normalized.length < 2 || normalized.length > 180) {
    return false;
  }

  if (/[{}()[\]?:=&|]/.test(normalized)) {
    return false;
  }

  if (/\b[A-Za-z_$][\w$]*\s*[-+*/]\s*[A-Za-z_$][\w$]*\b/.test(normalized)) {
    return false;
  }

  if (/^[A-Z0-9_./:-]+$/.test(normalized)) {
    return false;
  }

  if (/^(https?:|\/|\.\/|\.\.\/|#[0-9a-f]{3,8}$)/i.test(normalized)) {
    return false;
  }

  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    return false;
  }

  return /[A-Za-z]/.test(normalized);
}

function collectMatches(source, filePath, pattern, type, results) {
  pattern.lastIndex = 0;
  for (const match of source.matchAll(pattern)) {
    const text = normalizeCandidate(match[1]);
    if (!isLikelyVisibleText(text)) {
      continue;
    }

    if (translateUiText(text, "vi") !== text) {
      continue;
    }

    const relativePath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
    const key = `${text}\u0000${relativePath}`;
    const current = results.get(key) ?? {
      text,
      file: relativePath,
      lines: new Set(),
      types: new Set(),
    };
    current.lines.add(lineNumberForIndex(source, match.index ?? 0));
    current.types.add(type);
    results.set(key, current);
  }
}

const files = await walk(sourceRoot);
const missing = new Map();

for (const filePath of files) {
  const source = await readFile(filePath, "utf8");
  collectMatches(source, filePath, VISIBLE_ATTRIBUTE_PATTERN, "attribute", missing);
  collectMatches(source, filePath, JSX_TEXT_PATTERN, "jsx-text", missing);
  collectMatches(source, filePath, MESSAGE_SETTER_PATTERN, "message", missing);
}

const rows = [...missing.values()].sort((a, b) => {
  const fileSort = a.file.localeCompare(b.file);
  if (fileSort) {
    return fileSort;
  }
  return Math.min(...a.lines) - Math.min(...b.lines);
});

if (!rows.length) {
  console.log("No obvious untranslated UI strings found.");
  process.exit(0);
}

console.log(`Found ${rows.length} untranslated UI string candidates:\n`);
for (const row of rows) {
  const lines = [...row.lines].sort((a, b) => a - b).join(",");
  const types = [...row.types].sort().join(",");
  console.log(`${row.file}:${lines} [${types}] ${row.text}`);
}

process.exitCode = 1;
