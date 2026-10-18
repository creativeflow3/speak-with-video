// @vitest-environment jsdom
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { LegalPage } from "./LegalPage";
import { LEGAL_LAST_UPDATED } from "@/lib/legal";

afterEach(cleanup);

const SECTIONS = [
  { heading: "First Section", body: <p>First body</p> },
  { heading: "Second Section", body: <p>Second body</p> },
];

describe("LegalPage", () => {
  it("renders the title and last-updated date", () => {
    render(<LegalPage title="Privacy Policy" sections={SECTIONS} />);
    expect(screen.getByRole("heading", { level: 1, name: "Privacy Policy" })).toBeInTheDocument();
    expect(screen.getByText(`Last updated ${LEGAL_LAST_UPDATED}`)).toBeInTheDocument();
  });

  it("renders each section heading and body", () => {
    render(<LegalPage title="Privacy Policy" sections={SECTIONS} />);
    expect(screen.getByRole("heading", { level: 2, name: "First Section" })).toBeInTheDocument();
    expect(screen.getByText("Second body")).toBeInTheDocument();
  });

  it("links back to the home page", () => {
    render(<LegalPage title="Privacy Policy" sections={SECTIONS} />);
    expect(screen.getByRole("link", { name: /Back to Speak With Video/ })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
