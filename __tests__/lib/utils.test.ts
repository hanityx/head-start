import {
  haversineMeters,
  timingRawToSeconds,
  parseTransmissionTimeMs,
  mergeItems,
  toKstMsString,
  nowKstString,
} from "@/lib/utils";

describe("Utility Functions", () => {
  describe("haversineMeters", () => {
    it("should calculate distance between two coordinates", () => {
      // 임의의 두 지점 거리
      const distance = haversineMeters(37.5665, 126.978, 37.5759, 126.9768);
      expect(distance).toBeGreaterThan(1000);
      expect(distance).toBeLessThan(1200);
    });

    it("should return 0 for same coordinates", () => {
      const distance = haversineMeters(37.5665, 126.978, 37.5665, 126.978);
      expect(distance).toBeCloseTo(0, 1);
    });
  });

  describe("timingRawToSeconds", () => {
    it("should convert raw value to seconds (divide by 10)", () => {
      expect(timingRawToSeconds(100)).toBe(10);
      expect(timingRawToSeconds(55)).toBe(5.5);
      expect(timingRawToSeconds(0)).toBe(0);
    });

    it("should return null for invalid values", () => {
      expect(timingRawToSeconds(null)).toBeNull();
      expect(timingRawToSeconds(undefined)).toBeNull();
      expect(timingRawToSeconds("abc")).toBeNull();
    });
  });

  describe("parseTransmissionTimeMs", () => {
    it("should parse trsmUtcTime", () => {
      const rec = { trsmUtcTime: 1705651200000 };
      expect(parseTransmissionTimeMs(rec)).toBe(1705651200000);
    });

    it("should parse regDt as number", () => {
      const rec = { regDt: 1705651200000 };
      expect(parseTransmissionTimeMs(rec)).toBe(1705651200000);
    });

    it("should parse regDt as ISO string", () => {
      const rec = { regDt: "2024-01-19T00:00:00.000Z" };
      const result = parseTransmissionTimeMs(rec);
      expect(result).toBeGreaterThan(0);
    });

    it("should return 0 for invalid data", () => {
      expect(parseTransmissionTimeMs({})).toBe(0);
      expect(parseTransmissionTimeMs(null)).toBe(0);
    });
  });

  describe("mergeItems", () => {
    it("should merge timing and phase items", () => {
      const timingItems = [
        {
          title: "북측 보행",
          kind: "보행",
          sec: 10.5,
          secAtMsg: 12.0,
          dirCode: "nt",
          movCode: "PdsgRmdrCs",
          key: "ntPdsgRmdrCs",
        },
      ];

      const phaseItems = [
        {
          title: "북측 보행",
          kind: "보행",
          status: "protected-Movement-Allowed",
          dirCode: "nt",
          movCode: "PdsgStatNm",
          key: "ntPdsgStatNm",
        },
      ];

      const result = mergeItems(timingItems, phaseItems);
      expect(result).toHaveLength(1);
      expect(result[0].sec).toBe(10.5);
      expect(result[0].status).toBe("protected-Movement-Allowed");
    });

    it("should prioritize pedestrian items", () => {
      const timingItems = [
        {
          title: "북측 직진",
          kind: "직진",
          sec: 5.0,
          secAtMsg: 5.0,
          dirCode: "nt",
          movCode: "StsgRmdrCs",
          key: "ntStsgRmdrCs",
        },
        {
          title: "북측 보행",
          kind: "보행",
          sec: 15.0,
          secAtMsg: 15.0,
          dirCode: "nt",
          movCode: "PdsgRmdrCs",
          key: "ntPdsgRmdrCs",
        },
      ];

      const result = mergeItems(timingItems, []);
      expect(result[0].kind).toBe("보행");
      expect(result[1].kind).toBe("직진");
    });
  });

  describe("toKstMsString", () => {
    it("should convert epoch ms to KST string", () => {
      const result = toKstMsString(1705651200000);
      expect(result).toContain("2024-01-19");
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
    });

    it("should return null for invalid input", () => {
      expect(toKstMsString(0)).toBeNull();
      expect(toKstMsString(null as any)).toBeNull();
    });
  });

  describe("nowKstString", () => {
    it("should return current time in KST format", () => {
      const result = nowKstString();
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/);
    });

    it("should include milliseconds when requested", () => {
      const result = nowKstString(true);
      expect(result).toMatch(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}/);
    });
  });
});
