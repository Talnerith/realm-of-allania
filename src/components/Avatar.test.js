import { render, screen } from '@testing-library/react';
import Avatar from '@/components/Avatar';

describe('Avatar', () => {
  it('shows a hosted picture over the initial', () => {
    const { container } = render(<Avatar name="corian" imageUrl="/images/a.webp" imagePosition="20% 10%" />);
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(container.querySelector('img')).toHaveStyle({ objectPosition: '20% 10%' });
  });

  it('shows only the initial for missing or outside images', () => {
    const { container, rerender } = render(<Avatar name="Verif" imageUrl="" />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<Avatar name="Verif" imageUrl="https://example.com/x.jpg" />);
    expect(container.querySelector('img')).toBeNull();
    rerender(<Avatar />);
    expect(screen.getByText('?')).toBeInTheDocument();
  });
});
