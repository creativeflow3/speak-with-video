// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { AppShell } from "./AppShell";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

afterEach(cleanup);

describe("AppShell", () => {
  it("greets the user and offers Log out", () => {
    render(<AppShell displayName="Ada Lovelace">page</AppShell>);

    expect(screen.getByText("Welcome, Ada Lovelace")).toBeInTheDocument();
    for (const link of screen.getAllByRole("link", { name: "Log out" })) {
      expect(link).toHaveAttribute("href", "/auth/logout");
    }
  });

  it("renders the nav and the page, with no Dashboard label", () => {
    render(<AppShell displayName="Ada Lovelace">page body</AppShell>);

    expect(screen.getAllByRole("link", { name: "Find a Phrase" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("main")).toHaveTextContent("page body");
    expect(screen.queryByText("Dashboard")).not.toBeInTheDocument();
  });
});
