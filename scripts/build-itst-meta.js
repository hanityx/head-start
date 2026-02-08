const fs = require("fs");
const path = require("path");

const sourcePath = path.join(process.cwd(), "data", "data.json");
const targetPath = path.join(process.cwd(), "data", "itst-meta.json");

function toFiniteOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function build() {
  const raw = fs.readFileSync(sourcePath, "utf8");
  const source = JSON.parse(raw);
  if (!Array.isArray(source)) {
    throw new Error("data/data.json is not an array");
  }

  const compact = source
    .filter((row) => row && typeof row === "object" && "itstId" in row)
    .map((row) => ({
      itstId: String(row.itstId),
      itstNm: typeof row.itstNm === "string" ? row.itstNm : null,
      lat: toFiniteOrNull(row.mapCtptIntLat ?? row.lat),
      lon: toFiniteOrNull(row.mapCtptIntLot ?? row.lon),
    }));

  fs.writeFileSync(targetPath, `${JSON.stringify(compact)}\n`);
  const fromKb = Math.round(Buffer.byteLength(raw, "utf8") / 1024);
  const toKb = Math.round(
    Buffer.byteLength(JSON.stringify(compact), "utf8") / 1024
  );
  console.log(
    `[build-itst-meta] rows=${compact.length} size=${fromKb}KB -> ${toKb}KB`
  );
}

build();
