import fs from "fs";
import path from "path";
import { logDebug, logWarn } from "@/lib/logger";

export type ItstMeta = {
  itstNm: string | null;
  lat: number | null;
  lon: number | null;
};

type ItstRow = {
  itstId?: string | number;
  itstNm?: string | null;
  mapCtptIntLat?: number | string | null;
  mapCtptIntLot?: number | string | null;
  lat?: number | string | null;
  lon?: number | string | null;
};

let cached: Map<string, ItstMeta> | null = null;
const DATA_CANDIDATES = ["itst-meta.json", "data.json"];

export function loadItstMeta(): Map<string, ItstMeta> {
  if (cached) return cached;

  let map = new Map<string, ItstMeta>();
  try {
    const arr = readMetaArray();
    if (Array.isArray(arr)) {
      map = new Map(
        arr
          .filter(
            (r): r is ItstRow =>
              !!r && typeof r === "object" && "itstId" in (r as ItstRow)
          )
          .map((r) => {
            const latRaw = r.mapCtptIntLat ?? r.lat;
            const lonRaw = r.mapCtptIntLot ?? r.lon;
            const lat = Number(latRaw);
            const lon = Number(lonRaw);
            return [
              String(r.itstId),
              {
                itstNm: r.itstNm ?? null,
                lat: Number.isFinite(lat) ? lat : null,
                lon: Number.isFinite(lon) ? lon : null,
              },
            ];
          })
      );
    }
    logDebug(`loaded itst meta map size=${map.size}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    logWarn(`WARN itst meta not loaded: ${msg}`);
  }

  cached = map;
  return map;
}

function readMetaArray(): unknown {
  const basePath = path.join(process.cwd(), "data");
  let lastError: unknown = null;

  for (const fileName of DATA_CANDIDATES) {
    const filePath = path.join(basePath, fileName);
    try {
      const text = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(text) as unknown;
      logDebug(`loaded meta source=${fileName} bytes=${text.length}`);
      return parsed;
    } catch (e: unknown) {
      lastError = e;
    }
  }

  throw lastError ?? new Error("no meta source file");
}
