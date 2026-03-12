#!/usr/bin/env node
/**
 * scripts/fetch-bearings.js
 *
 * data/data.json의 모든 교차로에 대해 OSM Overpass에서 도로 각도(bearings)를
 * 한 번만 다운받아 lib/bearing-cache.json에 저장합니다.
 *
 * Usage: node scripts/fetch-bearings.js
 * 중간에 중단하면 다음 실행 시 이미 완료된 항목은 건너뜁니다 (resume).
 */

const fs = require("fs");
const path = require("path");

const DATA_PATH = path.join(process.cwd(), "data", "data.json");
const CACHE_PATH = path.join(process.cwd(), "lib", "bearing-cache.json");

const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.ru/api/interpreter",
];

const DELAY_MS = 1200; // 서버 부하 방지

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeBearing(lat1, lon1, lat2, lon2) {
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const l1 = (lat1 * Math.PI) / 180;
  const l2 = (lat2 * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(l2);
  const x =
    Math.cos(l1) * Math.sin(l2) - Math.sin(l1) * Math.cos(l2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function extractBearings(way, cLat, cLon) {
  const g = way.geometry;
  if (g.length < 2) return [];
  let minDist = Infinity,
    ci = 0;
  for (let i = 0; i < g.length; i++) {
    const d = haversineMeters(cLat, cLon, g[i].lat, g[i].lon);
    if (d < minDist) {
      minDist = d;
      ci = i;
    }
  }
  const bearings = [];
  if (ci > 0)
    bearings.push(computeBearing(cLat, cLon, g[ci - 1].lat, g[ci - 1].lon));
  if (ci < g.length - 1)
    bearings.push(computeBearing(cLat, cLon, g[ci + 1].lat, g[ci + 1].lon));
  return bearings;
}

function clusterBearings(raw, thresh = 22) {
  if (!raw.length) return [];
  const sorted = [...raw].sort((a, b) => a - b);
  const clusters = [[sorted[0]]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] <= thresh) {
      clusters[clusters.length - 1].push(sorted[i]);
    } else {
      clusters.push([sorted[i]]);
    }
  }
  if (clusters.length > 1) {
    const first = clusters[0][0];
    const last = clusters[clusters.length - 1].at(-1);
    if (first + 360 - last <= thresh) {
      const merged = [...clusters.pop(), ...clusters[0].map((b) => b + 360)];
      clusters[0] = merged;
    }
  }
  return clusters
    .map((c) => Math.round(c.reduce((s, b) => s + b, 0) / c.length) % 360)
    .sort((a, b) => a - b)
    .slice(0, 6);
}

async function fetchBearings(lat, lon) {
  const query = `[out:json][timeout:15];
way(around:60,${lat},${lon})["highway"~"^(trunk|primary|secondary|tertiary|unclassified|residential)$"];
out geom;`;

  for (const mirror of OVERPASS_MIRRORS) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 14000);
    try {
      const resp = await fetch(mirror, {
        method: "POST",
        body: query,
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        signal: controller.signal,
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      const ways = data.elements.filter(
        (e) => e.type === "way" && e.geometry?.length > 1,
      );
      const allBearings = [];
      for (const way of ways)
        allBearings.push(...extractBearings(way, lat, lon));
      clearTimeout(t);
      return clusterBearings(allBearings);
    } catch (e) {
      clearTimeout(t);
      process.stderr.write(`  mirror ${mirror} failed: ${e.message}\n`);
    }
  }
  return null; // 모든 미러 실패
}

async function main() {
  const intersections = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));

  // 기존 캐시 로드 (resume 지원)
  let cache = {};
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
  }

  const todo = intersections.filter((r) => !(r.itstId in cache));
  const total = intersections.length;
  const done = total - todo.length;

  console.log(`전체: ${total}개 | 완료: ${done}개 | 남은: ${todo.length}개`);
  if (todo.length === 0) {
    console.log("이미 완료됐습니다.");
    return;
  }

  let success = 0,
    fail = 0;

  for (let i = 0; i < todo.length; i++) {
    const { itstId, itstNm, mapCtptIntLat: lat, mapCtptIntLot: lon } = todo[i];
    process.stdout.write(
      `[${done + i + 1}/${total}] ${itstNm} (${itstId})... `,
    );

    const bearings = await fetchBearings(lat, lon);

    if (bearings !== null) {
      cache[itstId] = bearings;
      success++;
      process.stdout.write(`✓ [${bearings.join(", ")}]\n`);
    } else {
      cache[itstId] = []; // 빈 배열로 기록 (재시도 방지)
      fail++;
      process.stdout.write(`✗ (모든 미러 실패 — 빈 배열 저장)\n`);
    }

    // 진행상황 저장
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2), "utf8");

    // 마지막 항목이 아니면 딜레이
    if (i < todo.length - 1) await sleep(DELAY_MS);
  }

  console.log(`\n완료: ${success}개 성공, ${fail}개 실패`);
  console.log(`저장됨: ${CACHE_PATH}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
