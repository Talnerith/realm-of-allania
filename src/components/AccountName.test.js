import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import AccountName from '@/components/AccountName';

describe('AccountName', () => {
  beforeEach(() => jest.clearAllMocks());

  it('shows the author name and email', () => {
    render(<AccountName name="Verif" email="v@example.com" onSave={jest.fn()} />);
    expect(screen.getByText('Verif')).toBeInTheDocument();
    expect(screen.getByText('v@example.com')).toBeInTheDocument();
    expect(screen.queryByLabelText('Author name')).not.toBeInTheDocument();
  });

  it('saves a new name', async () => {
    const onSave = jest.fn().mockResolvedValue();
    render(<AccountName name="Verif" email="v@example.com" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change author name' }));
    const input = screen.getByLabelText('Author name');
    expect(input).toHaveValue('Verif');
    fireEvent.change(input, { target: { value: 'Talnerith' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).toHaveBeenCalledWith('Talnerith');
    await waitFor(() => expect(screen.queryByLabelText('Author name')).not.toBeInTheDocument());
  });

  it('closes without saving when the name is unchanged', () => {
    const onSave = jest.fn();
    render(<AccountName name="Verif" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change author name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Author name')).not.toBeInTheDocument();
  });

  it('keeps the editor open with the error when saving fails', async () => {
    const onSave = jest.fn().mockRejectedValue(new Error('Names need at least 2 characters.'));
    render(<AccountName name="Verif" onSave={onSave} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change author name' }));
    fireEvent.change(screen.getByLabelText('Author name'), { target: { value: 'J' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Names need at least 2 characters.');
    expect(screen.getByLabelText('Author name')).toBeInTheDocument();
  });

  it('cancels editing', () => {
    render(<AccountName name="Verif" onSave={jest.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Change author name' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByText('Verif')).toBeInTheDocument();
  });
});
