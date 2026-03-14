/**
 * lib/utils.ts — barrel re-export
 * 실제 구현은 도메인별 파일에 있습니다:
 *   lib/geo.ts        — 지리 계산 (Haversine, 방위각)
 *   lib/time.ts       — KST 시간 포맷
 *   lib/spat-utils.ts — SPaT 도메인 파싱 + 타입
 *   lib/fetch-utils.ts — HTTP 유틸리티
 */

export * from "@/lib/geo";
export * from "@/lib/time";
export * from "@/lib/spat-utils";
export * from "@/lib/fetch-utils";
