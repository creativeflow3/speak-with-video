// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { Footer } from "./Footer";

afterEach(cleanup);

describe("Footer", () => {
  it("links to the privacy policy", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Privacy" })).toHaveAttribute("href", "/privacy");
  });

  it("links to the terms of use", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Terms" })).toHaveAttribute("href", "/terms");
  });

  it("links to the contact email", () => {
    render(<Footer />);
    expect(screen.getByRole("link", { name: "Contact" })).toHaveAttribute(
      "href",
      "mailto:info@jmwebpros.com",
    );
  });
});
