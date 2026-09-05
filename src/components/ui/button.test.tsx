// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Button, buttonClasses } from "./button";

afterEach(cleanup);

describe("Button", () => {
  it("renders children and defaults to the accent variant", () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole("button", { name: "Click me" });
    expect(button).toHaveClass("bg-accent");
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  it("fires onClick when clicked", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClick when disabled", async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Go" }));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("sets aria-pressed to the active state for the pill variant", () => {
    render(
      <Button variant="pill" active>
        Español
      </Button>,
    );
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
  });

  it("omits aria-pressed for the pill variant when active is not provided", () => {
    render(<Button variant="pill">Español</Button>);
    expect(screen.getByRole("button", { name: "Español" })).not.toHaveAttribute("aria-pressed");
  });
});

describe("buttonClasses", () => {
  it.each([
    [true, "border-ink bg-ink text-canvas"],
    [false, "border-line bg-surface text-muted"],
  ])("includes the pill classes for active=%s", (active, expected) => {
    expect(buttonClasses("pill", active)).toContain(expected);
  });

  it("appends the extra className", () => {
    expect(buttonClasses("accent", undefined, "self-start")).toContain("self-start");
  });
});
