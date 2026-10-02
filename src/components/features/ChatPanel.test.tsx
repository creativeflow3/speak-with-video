// @vitest-environment jsdom
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { sseEvent } from "@/lib/utils";
import { mockFetch } from "@/components/testUtils";
import { ChatPanel } from "./ChatPanel";

const fetchMock = mockFetch();
const encoder = new TextEncoder();

const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

beforeAll(() => {
  // jsdom attempts a real page navigation on <a>.click() with an href set,
  // which it doesn't support and logs as an error — stub it out for downloads.
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
});

afterAll(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:mock-url");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  URL.createObjectURL = originalCreateObjectURL;
  URL.revokeObjectURL = originalRevokeObjectURL;
});

function streamOf(...chunks: string[]) {
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i]));
      i += 1;
    },
  });
}

async function sendQuery(query: string) {
  fireEvent.change(screen.getByPlaceholderText('Try: "vale la pena"'), { target: { value: query } });
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
}

describe("ChatPanel", () => {
  it("shows a placeholder prompt when there are no messages yet", () => {
    render(<ChatPanel />);
    expect(screen.getByText(/Try asking/i)).toBeInTheDocument();
  });

  it("streams the assistant reply and renders both messages", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: streamOf(sseEvent("text", { text: "Hola" }), sseEvent("text", { text: " qué tal" })),
    });
    render(<ChatPanel />);

    await sendQuery("vale la pena");

    expect(screen.getByText("vale la pena")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hola qué tal")).toBeInTheDocument());
    expect(screen.getByPlaceholderText('Try: "vale la pena"')).toHaveValue("");
  });

  it("renders YouTube URLs in the assistant reply as links that open in a new tab", async () => {
    const url = "https://youtu.be/dQw4w9WgXcQ?t=42";
    fetchMock.mockResolvedValue({
      ok: true,
      body: streamOf(sseEvent("text", { text: `It means worth it. Watch ${url}` })),
    });
    render(<ChatPanel />);

    await sendQuery("vale la pena");

    const link = await screen.findByRole("link", { name: url });
    expect(link).toHaveAttribute("href", url);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("does not submit an empty or whitespace-only message", async () => {
    render(<ChatPanel />);
    fireEvent.change(screen.getByPlaceholderText('Try: "vale la pena"'), { target: { value: "   " } });
    await userEvent.click(screen.getByRole("button", { name: /send/i }));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    [
      "a 429 response",
      { ok: false, status: 429, json: () => Promise.resolve({}) },
      "You're sending messages too quickly. Wait a bit and try again.",
    ],
    [
      "a non-429 failure",
      { ok: false, status: 500, json: () => Promise.resolve({ error: "Server exploded" }) },
      "Server exploded",
    ],
  ])("shows an error message on %s", async (_, response, expectedText) => {
    fetchMock.mockResolvedValue(response);
    render(<ChatPanel />);

    await sendQuery("hola");

    await waitFor(() => expect(screen.getByText(expectedText)).toBeInTheDocument());
  });

  it("shows a generic error message when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<ChatPanel />);

    await sendQuery("hola");

    await waitFor(() =>
      expect(
        screen.getByText("Something went wrong reaching the server. Try sending that again."),
      ).toBeInTheDocument(),
    );
  });

  it("renders an export button for a CSV event and downloads it on click", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      body: streamOf(
        sseEvent("text", { text: "Here you go" }),
        sseEvent("anki_csv", { csv: "front,back\nhola,hi", cardCount: 1 }),
      ),
    });
    render(<ChatPanel />);

    await sendQuery("hola");

    const exportButton = await screen.findByRole("button", { name: "↓ Export 1 cards to Anki" });
    await userEvent.click(exportButton);

    expect(URL.createObjectURL).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });

  it("disables the send button while a request is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<ChatPanel />);

    await sendQuery("hola");

    expect(screen.getByRole("button", { name: "…" })).toBeDisabled();

    resolveFetch({ ok: true, body: streamOf() });
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled());
  });

  it("shows a thinking indicator before anything has streamed", async () => {
    fetchMock.mockReturnValue(new Promise(() => {}));
    render(<ChatPanel />);

    await sendQuery("hola");

    expect(screen.getByRole("status")).toHaveTextContent("Thinking…");
  });

  it("shows the running tool's status, then replaces it with the streamed reply", async () => {
    let push!: (chunk: string) => void;
    let finish!: () => void;
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        push = (chunk) => controller.enqueue(encoder.encode(chunk));
        finish = () => controller.close();
      },
    });
    fetchMock.mockResolvedValue({ ok: true, body });
    render(<ChatPanel />);

    await sendQuery("vale la pena");
    push(sseEvent("status", { tool: "search_rag" }));
    expect(await screen.findByRole("status")).toHaveTextContent("Searching your videos…");

    push(sseEvent("text", { text: "Here are examples" }));
    expect(await screen.findByText("Here are examples")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();

    finish();
    await waitFor(() => expect(screen.getByRole("button", { name: "Send" })).not.toBeDisabled());
  });
});
