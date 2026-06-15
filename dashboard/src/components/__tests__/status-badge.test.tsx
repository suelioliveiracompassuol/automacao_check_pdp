import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { StatusBadge } from "../status-badge";
import type { Status } from "@/lib/types";

describe("StatusBadge", () => {
  it("renders 'Passou' label for pass status", () => {
    render(<StatusBadge status="pass" />);
    expect(screen.getByText("Passou")).toBeInTheDocument();
  });

  it("renders 'Falhou' label for fail status", () => {
    render(<StatusBadge status="fail" />);
    expect(screen.getByText("Falhou")).toBeInTheDocument();
  });

  it("renders 'Erro' label for error status", () => {
    render(<StatusBadge status="error" />);
    expect(screen.getByText("Erro")).toBeInTheDocument();
  });

  it("renders 'Alerta' label for warning status", () => {
    render(<StatusBadge status="warning" />);
    expect(screen.getByText("Alerta")).toBeInTheDocument();
  });

  it("renders 'Off' label for disabled status", () => {
    render(<StatusBadge status="disabled" />);
    expect(screen.getByText("Off")).toBeInTheDocument();
  });

  it("renders 'N/A' label for na status", () => {
    render(<StatusBadge status="na" />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("falls back to N/A for unknown status", () => {
    render(<StatusBadge status={"unknown" as Status} />);
    expect(screen.getByText("N/A")).toBeInTheDocument();
  });

  it("applies custom className", () => {
    const { container } = render(
      <StatusBadge status="pass" className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
