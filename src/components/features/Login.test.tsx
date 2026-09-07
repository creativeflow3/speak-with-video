// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Login } from "./Login";

afterEach(cleanup);

describe("Login", () => {
  it("renders the app name and tagline", () => {
    render(<Login />);
    expect(screen.getByRole("heading", { name: "Speak With Video" })).toBeInTheDocument();
    expect(
      screen.getByText(/paste a video, then ask how a phrase actually gets used/i),
    ).toBeInTheDocument();
  });

  it("links to Auth0 signup", () => {
    render(<Login />);
    expect(screen.getByRole("link", { name: "Create an account" })).toHaveAttribute(
      "href",
      "/auth/login?screen_hint=signup",
    );
  });

  it("links to Auth0 login", () => {
    render(<Login />);
    expect(screen.getByRole("link", { name: /already have an account\? log in/i })).toHaveAttribute(
      "href",
      "/auth/login",
    );
  });
});
