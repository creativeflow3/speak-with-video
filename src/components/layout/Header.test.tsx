// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Header } from "./Header";

afterEach(cleanup);

describe("Header", () => {
  it("greets the user by display name", () => {
    render(<Header displayName="Ada Lovelace" />);
    expect(screen.getByText("Welcome, Ada Lovelace")).toBeInTheDocument();
  });

  it("links to Auth0 logout", () => {
    render(<Header displayName="Ada Lovelace" />);
    expect(screen.getByRole("link", { name: "Log out" })).toHaveAttribute(
      "href",
      "/auth/logout",
    );
  });

  it("renders the app name", () => {
    render(<Header displayName="Ada Lovelace" />);
    expect(screen.getByRole("heading", { name: "Speak With Video" })).toBeInTheDocument();
  });
});
