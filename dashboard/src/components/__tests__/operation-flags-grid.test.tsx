import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OperationFlagsGrid } from "../operation-flags-grid";
import type { PdpCheckResult } from "@/lib/types";

// Mock radix collapsible
vi.mock("@radix-ui/react-collapsible", () => ({
  Root: ({ children }: React.PropsWithChildren<{ open?: boolean }>) => (
    <div>{children}</div>
  ),
  Trigger: ({
    children,
    ...props
  }: React.PropsWithChildren<
    React.ButtonHTMLAttributes<HTMLButtonElement>
  >) => <button {...props}>{children}</button>,
  Content: ({ children }: React.PropsWithChildren) => <div>{children}</div>,
}));

const resultsWithFlags: PdpCheckResult[] = [
  {
    sku: "SKU-001",
    name: "Product A",
    url: "https://example.com/a",
    vendor: "natura",
    country: "br",
    timestamp: "2024-01-01T00:00:00Z",
    success: true,
    features: [],
    remoteConfigFlags: {
      show_reviews: true,
      product_recommendations: false,
      nullable_flag: null,
      product_reviews: {
        enabled: true,
        count: 10,
        recommendation: {
          enabled: false,
        },
      },
    },
    commerceFeatureFlags: {
      cart_enabled: true,
      some_number: 42,
    },
  },
  {
    sku: "SKU-002",
    name: "Product B",
    url: "https://example.com/b",
    vendor: "avon",
    country: "ar",
    timestamp: "2024-01-01T00:00:00Z",
    success: true,
    features: [],
    remoteConfigFlags: {
      show_reviews: false,
    },
  },
];

const resultsWithoutFlags: PdpCheckResult[] = [
  {
    sku: "SKU-001",
    name: "Product A",
    url: "https://example.com/a",
    vendor: "natura",
    country: "br",
    timestamp: "2024-01-01T00:00:00Z",
    success: true,
    features: [],
  },
];

describe("OperationFlagsGrid", () => {
  it("renders null when no results have flags", () => {
    const { container } = render(
      <OperationFlagsGrid results={resultsWithoutFlags} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders section title when flags exist", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText("Feature Flags por Operação")).toBeInTheDocument();
  });

  it("shows operation count", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText("2 operações")).toBeInTheDocument();
  });

  it("renders flag values", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const flags = screen.getAllByText("show_reviews");
    expect(flags.length).toBeGreaterThanOrEqual(1);
  });

  it("deduplicates operations with same key", () => {
    const duplicateResults = [
      resultsWithFlags[0],
      { ...resultsWithFlags[0], sku: "SKU-003" }, // same vendor+country
    ];
    render(<OperationFlagsGrid results={duplicateResults} />);
    // Should only have 1 operation card
    expect(screen.getByText("1 operações")).toBeInTheDocument();
  });

  it("renders vendor logo and country info", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    // natura / br should be displayed
    const naturaTexts = screen.getAllByText(/natura/);
    expect(naturaTexts.length).toBeGreaterThanOrEqual(1);
  });

  it("renders nested category from RC_CATEGORIES mapping", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    // product_reviews is in RC_CATEGORIES with icon 📝
    expect(screen.getByText(/Reviews \(product_reviews\)/)).toBeInTheDocument();
  });

  it("renders nested-inner flags with dot notation", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    // recommendation.enabled should be rendered as "recommendation.enabled"
    expect(screen.getByText("recommendation.enabled")).toBeInTheDocument();
  });

  it("renders boolean true as checkmark", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const checkmarks = screen.getAllByText("✓");
    expect(checkmarks.length).toBeGreaterThanOrEqual(1);
  });

  it("renders boolean false as X mark", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    const crosses = screen.getAllByText("✗");
    expect(crosses.length).toBeGreaterThanOrEqual(1);
  });

  it("renders number values as string", () => {
    render(<OperationFlagsGrid results={resultsWithFlags} />);
    expect(screen.getByText("42")).toBeInTheDocument();
  });
});
