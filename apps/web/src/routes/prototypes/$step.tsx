import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ProtoPicker } from "#/prototypes/ProtoPicker";
import { STEPS, getStep, loadStepVariants } from "#/prototypes/registry";
import type { StepModule } from "#/prototypes/types";
import { useChoices, useProtoTheme } from "#/prototypes/choices";

export const Route = createFileRoute("/prototypes/$step")({
  validateSearch: (search: Record<string, unknown>): { v?: number } => ({
    v: typeof search.v === "string" || typeof search.v === "number" ? Number(search.v) || 1 : 1,
  }),
  loader: ({ params }) => {
    const step = getStep(params.step);
    if (!step) throw notFound();
    return { step };
  },
  component: StepHarness,
});

function StepHarness() {
  const { step } = Route.useLoaderData();
  const { v = 1 } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { choices, choose, setNote } = useChoices();
  const { theme, setTheme } = useProtoTheme(step.theme);

  const [mod, setMod] = useState<StepModule | null | undefined>(undefined);
  const [mountKey, setMountKey] = useState(0);
  const [showInfo, setShowInfo] = useState(true);

  useEffect(() => {
    let alive = true;
    setMod(undefined);
    loadStepVariants(step.slug).then((m) => {
      if (alive) setMod(m);
    });
    return () => {
      alive = false;
    };
  }, [step.slug]);

  const variants = mod?.variants ?? [];
  const active = Math.min(Math.max(v - 1, 0), Math.max(variants.length - 1, 0));
  const current = variants[active];
  const names = useMemo(() => variants.map((x) => x.name), [variants]);

  const select = useCallback(
    (i: number) => {
      navigate({ search: { v: i + 1 }, replace: true });
      setMountKey((k) => k + 1);
    },
    [navigate],
  );
  const replay = useCallback(() => setMountKey((k) => k + 1), []);

  const idx = STEPS.findIndex((s) => s.slug === step.slug);
  const prev = STEPS[idx - 1];
  const next = STEPS[idx + 1];
  const chosen = choices[step.slug];
  const isChosen = chosen?.variant === current?.name;

  return (
    <div className="flex h-dvh flex-col bg-surface-1 text-foreground">
      <header className="z-10 flex h-12 shrink-0 items-center gap-3 border-b border-border bg-surface-2 px-3 text-sm">
        <Link to="/prototypes" className="rounded-md px-2 py-1 text-muted-foreground hover:bg-hover hover:text-foreground">
          ← 목록
        </Link>
        <div className="flex items-center gap-2">
          <span className="grid size-6 place-items-center rounded-full bg-surface-5 text-[11px] font-medium tabular-nums text-muted-foreground">{step.order}</span>
          <span className="font-medium">{step.title}</span>
        </div>
        <button
          type="button"
          onClick={() => setShowInfo((s) => !s)}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-hover hover:text-foreground"
        >
          {showInfo ? "설명 숨기기" : "설명 보기"}
        </button>
        <div className="ml-auto flex items-center gap-2">
          {current && (
            <button
              type="button"
              onClick={() => choose(step.slug, current.name, active)}
              className={
                isChosen
                  ? "rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white"
                  : "rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background hover:opacity-90"
              }
            >
              {isChosen ? `✓ ${current.name} 선택됨` : `이 시안 선택 · ${current.name}`}
            </button>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-hover"
            aria-label="테마 전환"
          >
            {theme === "dark" ? "☾" : "☀"}
          </button>
          <nav className="flex items-center gap-1 text-xs">
            {prev ? (
              <Link to="/prototypes/$step" params={{ step: prev.slug }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-hover hover:text-foreground">
                ← {prev.order}
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/40">←</span>
            )}
            {next ? (
              <Link to="/prototypes/$step" params={{ step: next.slug }} className="rounded-md px-2 py-1 text-muted-foreground hover:bg-hover hover:text-foreground">
                {next.order} →
              </Link>
            ) : (
              <span className="px-2 py-1 text-muted-foreground/40">→</span>
            )}
          </nav>
        </div>
      </header>

      {showInfo && (
        <div className="z-10 flex shrink-0 flex-wrap items-baseline gap-x-6 gap-y-1 border-b border-border bg-surface-2/80 px-4 py-2 text-xs">
          <p className="text-muted-foreground">
            <span className="font-medium text-foreground">결정할 것</span> {step.decision}
          </p>
          {current && (
            <>
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">{current.name}</span> {current.axis}
              </p>
              <p className="text-muted-foreground">
                <span className="text-emerald-600 dark:text-emerald-400">이럴 때</span> {current.when}
              </p>
              <p className="text-muted-foreground">
                <span className="text-amber-600 dark:text-amber-400">대신</span> {current.cost}
              </p>
            </>
          )}
          {chosen && (
            <label className="ml-auto flex items-center gap-2 text-muted-foreground">
              메모
              <input
                defaultValue={chosen.note ?? ""}
                onBlur={(e) => setNote(step.slug, e.currentTarget.value)}
                placeholder="예: 3번 트랙 헤더 + 2번 클립 모양"
                className="w-64 rounded-md border border-border bg-transparent px-2 py-1 text-xs outline-none placeholder:text-muted-foreground/60 focus:border-foreground/40"
              />
            </label>
          )}
        </div>
      )}

      <div id="stage" className="relative min-h-0 flex-1 overflow-hidden">
        {mod === undefined && <Centered>불러오는 중…</Centered>}
        {mod === null && <Centered>이 단계의 시안이 아직 준비되지 않았습니다.</Centered>}
        {current && (
          <div key={`${step.slug}-${active}-${mountKey}`} className="absolute inset-0">
            <current.component />
          </div>
        )}
      </div>

      {names.length > 0 && (
        <ProtoPicker
          names={names}
          active={active}
          onSelect={select}
          onReplay={replay}
          hasMotion={current?.hasMotion ?? true}
          position={current?.pickerPosition ?? "bottom"}
        />
      )}
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="grid h-full place-items-center text-sm text-muted-foreground">{children}</div>;
}
