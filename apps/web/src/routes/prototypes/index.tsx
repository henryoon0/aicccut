import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { STEPS, hasStepModule } from "#/prototypes/registry";
import { useChoices, useProtoTheme } from "#/prototypes/choices";

export const Route = createFileRoute("/prototypes/")({ component: PrototypesIndex });

function PrototypesIndex() {
  const { choices, clear } = useChoices();
  const { theme, setTheme } = useProtoTheme("dark");
  const [copied, setCopied] = useState(false);
  const done = STEPS.filter((s) => choices[s.slug]).length;

  const exportText = STEPS.map((s) => {
    const c = choices[s.slug];
    return `${s.order}. ${s.title} → ${c ? `${c.variant} (#${c.index + 1})${c.note ? ` · ${c.note}` : ""}` : "미선택"}`;
  }).join("\n");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(exportText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked; the text is visible below */
    }
  };

  return (
    <main className="min-h-dvh bg-surface-1 text-foreground">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <header className="mb-10 flex items-start justify-between gap-6">
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">OpenCut · UI 시안 갤러리</p>
            <h1 className="font-sans text-2xl font-semibold tracking-tight">단계별로 시안을 고르세요</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              단계마다 서로 다른 방향의 시안 5개가 있습니다. 화면 아래 픽커나 숫자 키 1~5로 넘겨 보고,
              마음에 드는 시안에서 <strong className="text-foreground">이 시안 선택</strong>을 누르세요. 선택은 이 브라우저에 저장됩니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="shrink-0 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-hover"
          >
            {theme === "dark" ? "라이트로 보기" : "다크로 보기"}
          </button>
        </header>

        <div className="mb-6 flex items-center justify-between rounded-xl bg-surface-3 px-4 py-3 shadow-surface-2">
          <div className="text-sm">
            <span className="font-medium tabular-nums">{done}</span>
            <span className="text-muted-foreground"> / {STEPS.length} 단계 선택 완료</span>
          </div>
          <div className="h-1.5 w-40 overflow-hidden rounded-full bg-surface-5">
            <div className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out" style={{ width: `${(done / STEPS.length) * 100}%` }} />
          </div>
        </div>

        <ol className="flex flex-col gap-2">
          {STEPS.map((step) => {
            const c = choices[step.slug];
            const ready = hasStepModule(step.slug);
            return (
              <li key={step.slug}>
                <Link
                  to="/prototypes/$step"
                  params={{ step: step.slug }}
                  className="group flex items-center gap-4 rounded-xl bg-surface-3 px-4 py-3.5 shadow-surface-1 transition-colors hover:bg-surface-4"
                >
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-5 text-xs font-medium tabular-nums text-muted-foreground">
                    {step.order}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{step.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{step.decision}</span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    {!ready ? (
                      <span className="text-muted-foreground">준비 중</span>
                    ) : c ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 px-2.5 py-1 font-medium">
                        <span className="size-1.5 rounded-full bg-emerald-500" />
                        {c.variant}
                      </span>
                    ) : (
                      <span className="text-muted-foreground group-hover:text-foreground">시안 5개 보기 →</span>
                    )}
                  </span>
                </Link>
                {c && (
                  <div className="-mt-1 flex justify-end px-4 pb-1">
                    <button type="button" onClick={() => clear(step.slug)} className="text-[11px] text-muted-foreground hover:text-foreground">
                      선택 취소
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ol>

        <section className="mt-12 rounded-xl bg-surface-3 p-5 shadow-surface-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-medium">선택 결과 (복사해서 전달)</h2>
            <button
              type="button"
              onClick={copy}
              className="rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
            >
              {copied ? "복사됨" : "복사"}
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs leading-6 text-muted-foreground">{exportText}</pre>
        </section>
      </div>
    </main>
  );
}
