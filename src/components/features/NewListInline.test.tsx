// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from "vitest";
import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import { NewListInline } from "./NewListInline";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh, push: vi.fn() }) }));

const fetchMock = mockFetch();
const onCreated = vi.fn();
afterEach(() => {
  cleanup();
  refresh.mockReset();
  onCreated.mockReset();
});

const toggle = () => screen.getByRole("button", { name: "+ New list" });
const nameInput = () => screen.getByLabelText("New list name");

async function openAndType(name: string) {
  render(<NewListInline onCreated={onCreated} />);
  await userEvent.click(toggle());
  await userEvent.type(nameInput(), name);
}

describe("NewListInline", () => {
  it("opens a focused name field, and Escape closes it", async () => {
    render(<NewListInline onCreated={onCreated} />);

    await userEvent.click(toggle());
    expect(nameInput()).toHaveFocus();

    await userEvent.keyboard("{Escape}");
    expect(toggle()).toBeInTheDocument();
  });

  it("closes on Cancel and forgets what was typed", async () => {
    await openAndType("Trav");

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await userEvent.click(toggle());

    expect(nameInput()).toHaveValue("");
  });

  it("rejects a blank name without calling the API", async () => {
    await openAndType("   ");
    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(screen.getByRole("alert")).toHaveTextContent("List name is required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts the name, hands back the created list, and closes", async () => {
    const list = { id: "list-food", name: "Food", isDefault: false };
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ list }) });
    await openAndType(" Food ");

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(list));
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ name: "Food" });
    expect(refresh).toHaveBeenCalled();
    expect(toggle()).toBeInTheDocument();
  });

  it("shows the server's error and stays open", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 409,
      json: () => Promise.resolve({ error: 'You already have a list named "Food"' }),
    });
    await openAndType("Food");

    await userEvent.click(screen.getByRole("button", { name: "Create" }));

    expect(await screen.findByRole("alert")).toHaveTextContent('You already have a list named "Food"');
    expect(onCreated).not.toHaveBeenCalled();
    expect(nameInput()).toHaveValue("Food");
  });
});
