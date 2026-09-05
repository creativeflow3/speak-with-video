// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import { IngestForm } from "./IngestForm";

const fetchMock = mockFetch();

afterEach(cleanup);

function jsonResponse(body: unknown, ok = true) {
  return { ok, json: () => Promise.resolve(body) };
}

async function fillAndSubmit(url = "https://www.youtube.com/watch?v=abc123") {
  fireEvent.change(screen.getByLabelText("YouTube URL"), { target: { value: url } });
  await userEvent.click(screen.getByRole("button", { name: /add video/i }));
}

describe("IngestForm", () => {
  it("defaults to Spanish selected", () => {
    render(<IngestForm />);
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Português" })).toHaveAttribute("aria-pressed", "false");
  });

  it("switches the selected language on click", async () => {
    render(<IngestForm />);
    await userEvent.click(screen.getByRole("button", { name: "Português" }));
    expect(screen.getByRole("button", { name: "Português" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Español" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows a success message and clears the input after a new video is added", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ status: "created", title: "Great Video", chunkCount: 12 }),
    );
    render(<IngestForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(
      'Added "Great Video" — 12 phrases indexed.',
    );
    expect(screen.getByLabelText("YouTube URL")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ingest",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it.each([
    [
      "an already-ingested video",
      () => jsonResponse({ status: "already_ingested", video: { title: "Old Video" } }),
      'Already added: "Old Video"',
    ],
    [
      "a server error",
      () => jsonResponse({ error: "Invalid YouTube URL" }, false),
      "Invalid YouTube URL",
    ],
  ])("shows a status message for %s", async (_, response, expectedText) => {
    fetchMock.mockResolvedValue(response());
    render(<IngestForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(expectedText);
  });

  it("shows a network error message when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("network down"));
    render(<IngestForm />);

    await fillAndSubmit();

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Network error — the video wasn't added. Try again.",
    );
  });

  it("disables the submit button while the request is in flight", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    fetchMock.mockReturnValue(
      new Promise((resolve) => {
        resolveFetch = resolve;
      }),
    );
    render(<IngestForm />);

    await fillAndSubmit();

    const submitButton = screen.getByRole("button", { name: /adding/i });
    expect(submitButton).toBeDisabled();

    resolveFetch(jsonResponse({ status: "created", title: "Video", chunkCount: 1 }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Add video" })).not.toBeDisabled());
  });
});
