import Head from "next/head";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const QUICK_START_STEPS = [
  {
    title: "교차로 ID 입력 또는 주변 교차로 선택",
    detail:
      "메인 화면의 입력창에 교차로 ID를 직접 넣거나, 주변 교차로 목록에서 원하는 교차로를 선택합니다.",
  },
  {
    title: "조회 버튼으로 현재 상태 확인",
    detail:
      "조회 버튼을 누르면 해당 교차로의 신호 상태(정지/진행/주의 진행)와 잔여시간이 표시됩니다.",
  },
  {
    title: "자동 갱신 켜기",
    detail:
      "고정해서 볼 교차로를 정했다면 자동 갱신을 켜서 주기적으로 최신 값을 확인합니다.",
  },
  {
    title: "주변 교차로로 빠르게 전환",
    detail:
      "교차로를 바꿔 보고 싶을 때는 주변 교차로 목록에서 바로 선택해 입력과 조회를 줄일 수 있습니다.",
  },
] as const;

export default function GuidePage() {
  return (
    <>
      <Head>
        <title>사용자 가이드 | 횡단보도/차량 신호 잔여시간 확인</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main className="mx-auto max-w-3xl px-4 pb-14 pt-8">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              User Guide
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              사용자 가이드
            </h1>
          </div>
          <Button asChild variant="outline">
            <Link href="/">메인으로 이동</Link>
          </Button>
        </header>

        <Card className="mt-6">
          <CardHeader>
            <Badge variant="secondary" className="w-fit">
              처음 30초 사용법
            </Badge>
            <CardTitle className="mt-3 text-xl">처음 접속하면 이렇게 시작하세요</CardTitle>
            <CardDescription>
              첫 화면에서 무엇을 눌러야 하는지, 30초 안에 끝나는 최소 동선만 정리했습니다.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="space-y-4">
              {QUICK_START_STEPS.map((step, index) => (
                <li key={step.title} className="rounded-xl border border-border/70 bg-muted/20 p-4">
                  <p className="text-sm font-semibold text-foreground">
                    {index + 1}. {step.title}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{step.detail}</p>
                </li>
              ))}
            </ol>

            <p className="mt-5 text-sm text-muted-foreground">
              실시간 데이터도 통신 상태에 따라 몇 초 지연되거나 값이 잠시 멈춰 보일 수 있습니다.
            </p>
          </CardContent>
        </Card>
      </main>
    </>
  );
}
