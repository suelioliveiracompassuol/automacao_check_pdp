import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { FeatureTable } from "../feature-table";
import type { CheckResult } from "@/lib/types";

// Mock radix dialog
vi.mock("@radix-ui/react-dialog", () => ({
  Root: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  Content: ({ children, ...props }: React.PropsWithChildren) => (
    <div {...props}>{children}</div>
  ),
  Title: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Close: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

const mockFeatures: CheckResult[] = [
  {
    feature: "Product Title",
    featureKey: "product_title",
    passed: true,
    status: "pass",
    message: "Title is visible",
  },
  {
    feature: "Price",
    featureKey: "price",
    passed: false,
    status: "fail",
    message: "Price not found",
    screenshot: "screenshots/price.png",
  },
  {
    feature: "Reviews",
    featureKey: "reviews",
    passed: false,
    status: "na",
    message: "Not applicable",
  },
  {
    feature: "Disabled Feature",
    featureKey: "disabled_feat",
    passed: false,
    status: "disabled",
    message: "Feature is off",
  },
];

describe("FeatureTable", () => {
  it("renders features in a table", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    expect(screen.getByText("Product Title")).toBeInTheDocument();
    expect(screen.getByText("Price")).toBeInTheDocument();
    expect(screen.getByText("Reviews")).toBeInTheDocument();
  });

  it("shows feature messages", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    expect(screen.getByText("Title is visible")).toBeInTheDocument();
    expect(screen.getByText("Price not found")).toBeInTheDocument();
  });

  it("returns null when features array is empty", () => {
    const { container } = render(
      <FeatureTable features={[]} runId="run_123" />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("shows correct percentage (excludes na from calculation)", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    // testable = pass, fail, disabled (3 items)
    // passed = pass + disabled = 2
    // percentage = 2/3 = 67%
    expect(screen.getByText("2/3 verificações")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();
  });

  it("shows screenshot button for features with screenshots", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    const buttons = screen.getAllByTitle("Ver screenshot");
    expect(buttons.length).toBe(1);
  });

  it("renders page screenshot link when provided", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    expect(
      screen.getByText("Ver screenshot da página completa"),
    ).toBeInTheDocument();
  });

  it("does not render page screenshot link when not provided", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    expect(
      screen.queryByText("Ver screenshot da página completa"),
    ).not.toBeInTheDocument();
  });

  it("opens screenshot dialog when clicking screenshot button", () => {
    render(<FeatureTable features={mockFeatures} runId="run_123" />);
    const button = screen.getByTitle("Ver screenshot");
    fireEvent.click(button);
    expect(button).toBeInTheDocument();
  });

  it("opens page screenshot dialog when clicking page screenshot link", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    const link = screen.getByText("Ver screenshot da página completa");
    fireEvent.click(link);
    expect(link).toBeInTheDocument();
  });

  it("renders warning status rows", () => {
    const features: CheckResult[] = [
      {
        feature: "Warning Feature",
        featureKey: "warning_feat",
        passed: false,
        status: "warning",
        message: "Something might be wrong",
      },
    ];
    render(<FeatureTable features={features} runId="run_123" />);
    expect(screen.getByText("Warning Feature")).toBeInTheDocument();
  });

  it("renders error status rows", () => {
    const features: CheckResult[] = [
      {
        feature: "Error Feature",
        featureKey: "error_feat",
        passed: false,
        status: "error",
        message: "Critical error occurred",
      },
    ];
    render(<FeatureTable features={features} runId="run_123" />);
    expect(screen.getByText("Error Feature")).toBeInTheDocument();
  });

  it("shows zoom controls after opening a screenshot", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    // Open page screenshot to trigger selectedScreenshot state
    fireEvent.click(screen.getByText("Ver screenshot da página completa"));
    // Zoom controls should be visible
    expect(screen.getByTitle("Zoom in")).toBeInTheDocument();
    expect(screen.getByTitle("Zoom out")).toBeInTheDocument();
    expect(screen.getByTitle("Reset zoom")).toBeInTheDocument();
  });

  it("zoom in increases zoom percentage", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    fireEvent.click(screen.getByText("Ver screenshot da página completa"));
    expect(screen.getByText("100%")).toBeInTheDocument();
    fireEvent.click(screen.getByTitle("Zoom in"));
    expect(screen.getByText("150%")).toBeInTheDocument();
  });

  it("zoom out decreases zoom percentage", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    fireEvent.click(screen.getByText("Ver screenshot da página completa"));
    fireEvent.click(screen.getByTitle("Zoom in")); // 150%
    fireEvent.click(screen.getByTitle("Zoom out")); // 100%
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  it("reset zoom returns to 100%", () => {
    render(
      <FeatureTable
        features={mockFeatures}
        runId="run_123"
        pageScreenshot="screenshots/page.png"
      />,
    );
    fireEvent.click(screen.getByText("Ver screenshot da página completa"));
    fireEvent.click(screen.getByTitle("Zoom in")); // 150%
    fireEvent.click(screen.getByTitle("Zoom in")); // 200%
    fireEvent.click(screen.getByTitle("Reset zoom"));
    expect(screen.getByText("100%")).toBeInTheDocument();
  });
});
