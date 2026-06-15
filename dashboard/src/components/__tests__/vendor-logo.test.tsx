import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { VendorLogo } from "../vendor-logo";

describe("VendorLogo", () => {
  it("renders Natura SVG logo", () => {
    const { container } = render(<VendorLogo vendor="natura" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("renders Avon SVG logo", () => {
    const { container } = render(<VendorLogo vendor="avon" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("handles uppercase vendor name", () => {
    const { container } = render(<VendorLogo vendor="NATURA" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
  });

  it("applies small size scaling", () => {
    const { container } = render(<VendorLogo vendor="natura" size="sm" />);
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg?.getAttribute("width")).toBe("42");
  });

  it("applies default md size scaling", () => {
    const { container } = render(<VendorLogo vendor="natura" size="md" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("70");
  });
});
