import { render, screen, fireEvent } from '@testing-library/react';
import AccountName from '@/components/AccountName';

describe('AccountName', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the author name and email', () => {
    render(<AccountName name="Verif" email="v@example.com" onEdit={jest.fn()} />);
    expect(screen.getByText('Verif')).toBeInTheDocument();
    expect(screen.getByText('v@example.com')).toBeInTheDocument();
  });

  it('shows the picture over the initial when there is one', () => {
    const { container } = render(<AccountName name="Verif" avatar={{ url: '/images/a.webp', position: 'center' }} onEdit={jest.fn()} />);
    expect(container.querySelector('img')).toHaveAttribute('src', '/images/a.webp');
    expect(screen.getByText('V')).toBeInTheDocument();
  });

  it('renders no image without a picture', () => {
    const { container } = render(<AccountName name="Verif" avatar={{ url: '', position: 'center' }} onEdit={jest.fn()} />);
    expect(container.querySelector('img')).toBeNull();
  });

  it('opens the profile editor', () => {
    const onEdit = jest.fn();
    render(<AccountName name="Verif" onEdit={onEdit} />);
    fireEvent.click(screen.getByRole('button', { name: 'Edit author profile' }));
    expect(onEdit).toHaveBeenCalled();
  });
});
