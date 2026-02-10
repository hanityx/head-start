import { useEffect, useState } from "react";
import Head from "next/head";
import { SignalSection } from "@/components/sections/SignalSection";
import { NearbySection } from "@/components/sections/NearbySection";
import { DEFAULT_ITST_ID } from "@/lib/defaults";

export default function Home() {
  const [itstId, setItstId] = useState(DEFAULT_ITST_ID);

  useEffect(() => {
    const saved =
      typeof window !== "undefined" ? localStorage.getItem("lastItstId") : null;
    if (!saved) return;
    const trimmed = saved.trim();
    if (!trimmed || trimmed === "0000") return;
    setItstId(trimmed);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem("lastItstId", itstId);
  }, [itstId]);

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
            서울 T-Data V2X SPaT 기준입니다. 실시간이라도 통신 상태에 따라
            <b>몇 초 지연되거나 잠시 값이 멈춰 보일 수 있습니다.</b>
            <br />
            여기서 보이는 시간은 &quot;지금 켜진 신호가 끝날 때까지 남은 시간&quot;입니다.
            <br />
            ID를 직접 입력하거나, 오른쪽에서 가까운 교차로를 선택해 조회할 수 있습니다.
          </p>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <SignalSection
            itstId={itstId}
            onItstIdChange={setItstId}
            defaultItstId={DEFAULT_ITST_ID}
          />
          <NearbySection onSelectItstId={setItstId} />
        </div>
      </div>
    </>
  );
}
