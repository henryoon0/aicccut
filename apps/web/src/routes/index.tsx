import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#/editor/home";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { new?: number } => ({
    new: search.new === 1 || search.new === "1" ? 1 : undefined,
  }),
  component: HomePage,
});
