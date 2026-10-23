// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Pagination } from "./pagination";

afterEach(cleanup);

const button = (name: string) => screen.getByRole("button", { name });

describe("Pagination", () => {
  it("renders nothing for a single page", () => {
    const { container } = render(<Pagination page={1} totalPages={1} onPageChange={vi.fn()} />);

    expect(container).toBeEmptyDOMElement();
  });

  it("marks the current page and disables Prev on the first page", () => {
    render(<Pagination page={1} totalPages={3} onPageChange={vi.fn()} />);

    expect(button("Page 1")).toHaveAttribute("aria-current", "page");
    expect(button("Page 2")).not.toHaveAttribute("aria-current");
    expect(button("← Prev")).toBeDisabled();
    expect(button("Next →")).toBeEnabled();
  });

  it("disables Next on the last page", () => {
    render(<Pagination page={3} totalPages={3} onPageChange={vi.fn()} />);

    expect(button("Next →")).toBeDisabled();
  });

  it("collapses distant pages into an ellipsis", () => {
    render(<Pagination page={6} totalPages={12} onPageChange={vi.fn()} />);

    expect(screen.queryByRole("button", { name: "Page 3" })).not.toBeInTheDocument();
    expect(screen.getAllByText("…")).toHaveLength(2);
  });

  it("reports the page chosen by number, Prev, or Next", async () => {
    const onPageChange = vi.fn();
    render(<Pagination page={2} totalPages={5} onPageChange={onPageChange} />);

    await userEvent.click(button("Page 4"));
    await userEvent.click(button("← Prev"));
    await userEvent.click(button("Next →"));

    expect(onPageChange.mock.calls).toEqual([[4], [1], [3]]);
  });
});
