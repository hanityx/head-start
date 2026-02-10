import { useEffect, useState } from "react";
import Head from "next/head";
import { SignalSection } from "@/components/sections/SignalSection";
import { NearbySection } from "@/components/sections/NearbySection";
import { DEFAULT_ITST_ID } from "@/lib/defaults";

export default function Home() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);
  const [externalFetchTrigger, setExternalFetchTrigger] = useState(0);
  const [allowAutoNearest, setAllowAutoNearest] = useState(true);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("lastItstId") : null;
    if (!saved) return;
    const trimmed = saved.trim();
    if (!trimmed || trimmed === "0000") return;
    setItstId(trimmed);
    setAllowAutoNearest(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("lastItstId", itstId);
  }, [itstId]);

  const handleItstIdChange = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
  };

  const handleSelectItstIdAndFetch = (value: string) => {
    setItstId(value);
    setAllowAutoNearest(false);
    setExternalFetchTrigger((prev) => prev + 1);
  };

  return (
    <>
      <Head>
        <title>횡단보도/차량 신호 잔여시간 확인</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8">
        <div className="rounded-2xl border border-border/60 bg-card/70 p-5 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                V2X SPaT Monitor
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
                횡단보도/차량 신호 잔여시간 확인
              </h1>
            </div>
            <div className="rounded-full border border-border/60 bg-muted/30 px-3 py-1 text-xs text-muted-foreground">
              실시간/지연 가능
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            서울 T-Data V2X SPaT 기준입니다.
            <b> 통신 상태에 따라 몇 초 지연되거나 값이 잠시 멈춰 보일 수 있습니다.</b>
            <br />
            좌측(모바일은 위)에서 신호를 조회하고, 우측(모바일은 아래)에서 주변 교차로를
            골라 ID를 바로 입력할 수 있습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <SignalSection
            itstId={itstId}
            onItstIdChange={handleItstIdChange}
            defaultItstId={DEFAULT_ITST_ID}
            externalFetchTrigger={externalFetchTrigger}
          />
          <NearbySection
            onSelectItstId={handleSelectItstIdAndFetch}
            autoSelectNearest={allowAutoNearest}
          />
        </div>
      </div>
    </>
  );
}
