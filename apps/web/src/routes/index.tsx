import { createFileRoute } from "@tanstack/react-router";
import { HomePage } from "#/editor/home";

export const Route = createFileRoute("/")({ component: HomePage });
