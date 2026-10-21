// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { mockFetch } from "@/components/testUtils";
import { PasswordResetButton } from "./PasswordResetButton";

const fetchMock = mockFetch();
afterEach(cleanup);

const button = () => screen.getByRole("button", { name: "Email me a reset link" });

describe("PasswordResetButton", () => {
  it("tells the user to check their inbox once the email is sent", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: () => Promise.resolve({ sent: true }) });
    render(<PasswordResetButton email="a@b.com" />);

    await userEvent.click(button());

    expect(fetchMock).toHaveBeenCalledWith("/api/account/password-reset", { method: "POST" });
    expect(await screen.findByRole("status")).toHaveTextContent("Check your inbox — we sent a link to a@b.com");
  });

  it("shows the server's error, e.g. when rate limited", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 429,
      json: () => Promise.resolve({ error: "Too many requests. Please slow down and try again shortly." }),
    });
    render(<PasswordResetButton email="a@b.com" />);

    await userEvent.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many requests");
    expect(button()).toBeEnabled();
  });

  it("shows a connection error when the request throws", async () => {
    fetchMock.mockRejectedValue(new Error("offline"));
    render(<PasswordResetButton email="a@b.com" />);

    await userEvent.click(button());

    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server");
  });
});
