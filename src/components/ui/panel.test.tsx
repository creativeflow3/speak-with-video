// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { FormEvent } from "react";
import { Panel } from "./panel";

afterEach(cleanup);

describe("Panel", () => {
  it("renders children inside a div by default", () => {
    render(<Panel>Hello</Panel>);
    const el = screen.getByText("Hello");
    expect(el.tagName).toBe("DIV");
  });

  it("merges the provided className with the base panel classes", () => {
    render(<Panel className="extra-class">Hello</Panel>);
    const el = screen.getByText("Hello");
    expect(el).toHaveClass("rounded-2xl", "extra-class");
  });

  it("renders as a form and fires onSubmit when as='form'", async () => {
    const onSubmit = vi.fn((e: FormEvent<HTMLFormElement>) => e.preventDefault());
    render(
      <Panel as="form" onSubmit={onSubmit}>
        <button type="submit">Submit</button>
      </Panel>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });
});
