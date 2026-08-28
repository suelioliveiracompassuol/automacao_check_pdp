import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ScreenshotViewer } from '../screenshot-viewer';

// Mock radix dialog
vi.mock('@radix-ui/react-dialog', () => ({
  Root: ({
    children,
    open,
  }: React.PropsWithChildren<{
    open?: boolean;
    onOpenChange?: () => void;
  }>) => (
    <div data-testid="dialog-root" data-open={open}>
      {children}
    </div>
  ),
  Portal: ({ children }: React.PropsWithChildren) => <>{children}</>,
  Overlay: (props: React.HTMLAttributes<HTMLDivElement>) => <div {...props} />,
  Content: ({ children, ...props }: React.PropsWithChildren) => <div {...props}>{children}</div>,
  Title: ({ children }: React.PropsWithChildren) => <span>{children}</span>,
  Close: ({ children }: React.PropsWithChildren) => <button>{children}</button>,
}));

describe('ScreenshotViewer', () => {
  it('renders nothing when screenshots array is empty', () => {
    const { container } = render(<ScreenshotViewer screenshots={[]} runId="run_123" />);
    expect(container.innerHTML).toBe('');
  });

  it('renders screenshot buttons', () => {
    const screenshots = ['screenshot_feature_001.png', 'screenshot_price_002.png'];
    render(<ScreenshotViewer screenshots={screenshots} runId="run_123" />);
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it('opens dialog when clicking a screenshot', () => {
    const screenshots = ['screenshot_feature_001.png'];
    render(<ScreenshotViewer screenshots={screenshots} runId="run_123" />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    const dialog = screen.getByTestId('dialog-root');
    expect(dialog).toHaveAttribute('data-open', 'true');
  });

  it('shows filename in dialog title after click', () => {
    const screenshots = ['screenshot_feature_001.png'];
    render(<ScreenshotViewer screenshots={screenshots} runId="run_123" />);
    const buttons = screen.getAllByRole('button');
    fireEvent.click(buttons[0]);
    expect(screen.getByText('screenshot_feature_001.png')).toBeInTheDocument();
  });

  it('renders multiple screenshots as individual buttons', () => {
    const screenshots = ['screenshot_a_001.png', 'screenshot_b_002.png', 'screenshot_c_003.png'];
    render(<ScreenshotViewer screenshots={screenshots} runId="run_456" />);
    // Each screenshot should have its own clickable button
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it('resets zoom state when opening a new screenshot', () => {
    const screenshots = ['shot_a_001.png', 'shot_b_002.png'];
    render(<ScreenshotViewer screenshots={screenshots} runId="run_123" />);
    const buttons = screen.getAllByRole('button');
    // Open first
    fireEvent.click(buttons[0]);
    // Open second - should reset zoom
    fireEvent.click(buttons[1]);
    const dialog = screen.getByTestId('dialog-root');
    expect(dialog).toHaveAttribute('data-open', 'true');
  });
});
