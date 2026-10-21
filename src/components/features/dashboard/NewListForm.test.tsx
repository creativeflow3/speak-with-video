// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import { NewListForm } from "./NewListForm";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const fetchMock = mockFetch();
afterEach(() => {
  cleanup();
  refresh.mockReset();
});

const nameInput = () => screen.getByLabelText("New list");

describe("NewListForm", () => {
  it("rejects a blank name without calling the API", async () => {
    render(<NewListForm />);

    await userEvent.type(nameInput(), "   ");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(screen.getByRole("alert")).toHaveTextContent("List name is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("caps input at 100 characters", () => {
    render(<NewListForm />);

    expect(nameInput()).toHaveAttribute("maxLength", "100");
  });

  it("posts the trimmed name, clears the field, and refreshes the page", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
    render(<NewListForm />);

    await userEvent.type(nameInput(), "  Travel ");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Travel" });
    expect(nameInput()).toHaveValue("");
  });

  it("shows the server's error, e.g. a duplicate name", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'You already have a list named "Travel"' }),
    });
    render(<NewListForm />);

    await userEvent.type(nameInput(), "Travel");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(await screen.findByRole("alert")).toHaveTextContent('You already have a list named "Travel"');
    expect(refresh).not.toHaveBeenCalled();
    expect(nameInput()).toHaveValue("Travel");
  });

  it("shows a connection error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<NewListForm />);

    await userEvent.type(nameInput(), "Travel");
    await userEvent.click(screen.getByRole("button", { name: "Create list" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });
});
