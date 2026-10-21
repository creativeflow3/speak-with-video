// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { render, screen, cleanup, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { usePathname } from "next/navigation";
import { DashboardNavLinks, MobileNav } from "./DashboardNav";

vi.mock("next/navigation", () => ({ usePathname: vi.fn() }));

const menuButton = () => screen.getByRole("button", { name: /menu/i });
const drawer = () => document.getElementById("dashboard-drawer")!;

beforeEach(() => vi.mocked(usePathname).mockReturnValue("/dashboard/lists"));
afterEach(cleanup);

describe("DashboardNavLinks", () => {
  it("marks the current section with aria-current, including its sub-pages", () => {
    vi.mocked(usePathname).mockReturnValue("/dashboard/lists/abc");
    render(<DashboardNavLinks />);

    expect(screen.getByRole("link", { name: "Lists" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Videos" })).not.toHaveAttribute("aria-current");
  });

  it("links back to Find a phrase", () => {
    render(<DashboardNavLinks />);

    expect(screen.getByRole("link", { name: "← Back to Find a phrase" })).toHaveAttribute("href", "/");
  });
});

describe("MobileNav", () => {
  it("starts closed, with the drawer inert", () => {
    render(<MobileNav />);

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(drawer()).toHaveAttribute("inert");
  });

  it("opens and closes from the hamburger button, locking page scroll while open", async () => {
    render(<MobileNav />);

    await userEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "true");
    expect(menuButton()).toHaveAccessibleName("Close menu");
    expect(drawer()).not.toHaveAttribute("inert");
    expect(document.body.style.overflow).toBe("hidden");

    await userEvent.click(menuButton());
    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes on Escape and returns focus to the hamburger", async () => {
    render(<MobileNav />);
    await userEvent.click(menuButton());

    await userEvent.keyboard("{Escape}");

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
    expect(menuButton()).toHaveFocus();
  });

  it("closes when a link is followed", async () => {
    render(<MobileNav />);
    await userEvent.click(menuButton());
    // jsdom can't perform the real page navigation a link click triggers.
    drawer().addEventListener("click", (e) => e.preventDefault());

    await userEvent.click(within(drawer()).getByRole("link", { name: "Videos" }));

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes when the route changes underneath it (e.g. browser back)", async () => {
    const { rerender } = render(<MobileNav />);
    await userEvent.click(menuButton());

    vi.mocked(usePathname).mockReturnValue("/dashboard/account");
    rerender(<MobileNav />);

    expect(menuButton()).toHaveAttribute("aria-expanded", "false");
  });
});
