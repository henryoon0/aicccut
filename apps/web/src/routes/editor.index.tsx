/** `/editor` with no project: nothing to open, so point back to the gallery. */
import { Link, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/editor/")({ component: NoProject });

function NoProject() {
  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-surface-1 text-foreground">
      <p className="text-[15px] font-medium">프로젝트를 선택하세요</p>
      <Link to="/" className="text-[13px] text-foreground underline underline-offset-4 hover:no-underline">
        프로젝트 목록으로
      </Link>
    </main>
  );
}
