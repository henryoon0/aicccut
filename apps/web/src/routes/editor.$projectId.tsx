/**
 * The editor route. Projects live in localStorage, so booting is client-only:
 * the first render is a neutral "Opening…" on both server and client, an
 * effect seeds the sample projects and loads the document, and only then are
 * the store, time store and transport created.
 *
 * This route owns the pieces that must exist exactly once per project:
 * autosave and the global shortcut listener. The shell below it only reads.
 */
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, createFileRoute } from "@tanstack/react-router";
import {
  EditorProvider,
  TimeStore,
  createEditorStore,
  createTransport,
  documentDuration,
  loadDocument,
  seedIfEmpty,
  useAutosave,
  useCommandContext,
  useEditor,
  useGlobalShortcuts,
  type Document,
  type EditorStore,
} from "#/editor/core";
import { commandToast } from "#/editor/commands";
import { EditorShell } from "#/editor/shell";

export const Route = createFileRoute("/editor/$projectId")({ component: EditorRoute });

type Boot = { status: "loading" } | { status: "missing" } | { status: "ready"; doc: Document };

function Centered({ children }: { children: ReactNode }) {
  return (
    <main className="flex h-dvh w-full flex-col items-center justify-center gap-3 bg-surface-1 text-foreground">{children}</main>
  );
}

/** Inside the provider: autosave, shortcuts, document title, then the shell. */
function EditorSession({ store }: { store: EditorStore }) {
  const ctx = useCommandContext();
  const name = useEditor((s) => s.doc.project.name);
  useAutosave(store);
  useGlobalShortcuts(ctx, { onMessage: commandToast });
  useEffect(() => {
    document.title = `${name} · AiccCut`;
    // Home keeps the plain title; without this the last project name lingers.
    return () => { document.title = "AiccCut"; };
  }, [name]);
  return <EditorShell />;
}

function EditorRoute() {
  const { projectId } = Route.useParams();
  const [boot, setBoot] = useState<Boot>({ status: "loading" });

  useEffect(() => {
    setBoot({ status: "loading" });
    seedIfEmpty();
    const doc = loadDocument(projectId);
    setBoot(doc ? { status: "ready", doc } : { status: "missing" });
  }, [projectId]);

  const doc = boot.status === "ready" ? boot.doc : null;
  const session = useMemo(() => {
    if (!doc) return null;
    const store = createEditorStore(doc);
    const time = new TimeStore(0);
    const transport = createTransport(
      time,
      () => documentDuration(store.getState().doc),
      () => store.getState().doc.project.fps,
    );
    return { store, time, transport };
  }, [doc]);

  useEffect(() => () => session?.transport.dispose(), [session]);

  if (boot.status === "loading") {
    return (
      <Centered>
        <p className="text-[13px] text-muted-foreground">여는 중…</p>
      </Centered>
    );
  }
  if (!session) {
    return (
      <Centered>
        <p className="text-[15px] font-medium">프로젝트를 찾을 수 없습니다</p>
        <p className="text-[13px] text-muted-foreground">이 브라우저에서 삭제되었을 수 있습니다.</p>
        <Link to="/" className="text-[13px] text-foreground underline underline-offset-4 hover:no-underline">
          프로젝트 목록으로
        </Link>
      </Centered>
    );
  }
  return (
    <EditorProvider store={session.store} time={session.time} transport={session.transport}>
      <EditorSession store={session.store} />
    </EditorProvider>
  );
}
