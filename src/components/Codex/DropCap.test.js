import { render, screen } from '@testing-library/react';
import DropCap, { dropCapLayout } from '@/components/Codex/DropCap';

describe('DropCap', () => {
  it('draws the capital letter, hidden from screen readers', () => {
    const { container } = render(<DropCap letter="b" />);
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(container.firstChild).toHaveAttribute('aria-hidden', 'true');
  });

  it('shrinks wide swash capitals so they stay inside the box', () => {
    const narrow = dropCapLayout('R');
    const wide = dropCapLayout('W');
    expect(wide.size).toBeLessThan(narrow.size);
    // W's ink (147px wide at 100px) fits the 78-unit inner width
    expect((148 * wide.size) / 100).toBeLessThanOrEqual(78.01);
  });

  it('centres the ink horizontally', () => {
    const { size, x } = dropCapLayout('T');
    const k = size / 100;
    const inkLeft = x - 1 * k;
    const inkRight = x + 114 * k;
    expect((inkLeft + inkRight) / 2).toBeCloseTo(50);
  });

  it('falls back for letters it has no measurements for', () => {
    expect(dropCapLayout('É').size).toBeGreaterThan(0);
  });
});
