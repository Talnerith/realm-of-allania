import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LegalDocs from '@/components/Legal/LegalDocs';

describe('LegalDocs', () => {
  test('opens on Terms of Service by default', () => {
    render(<LegalDocs />);
    expect(screen.getByRole('heading', { level: 2, name: 'Terms of Service' })).toBeInTheDocument();
  });

  test('initialTab opens a specific tab', () => {
    render(<LegalDocs initialTab="cookies" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Cookie Policy' })).toBeInTheDocument();
  });

  test('an unknown initialTab falls back to Terms of Service', () => {
    render(<LegalDocs initialTab="nope" />);
    expect(screen.getByRole('heading', { level: 2, name: 'Terms of Service' })).toBeInTheDocument();
  });

  test('tabs switch and Back calls goBack', () => {
    const goBack = jest.fn();
    render(<LegalDocs goBack={goBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Privacy Policy' }));
    expect(screen.getByRole('heading', { level: 2, name: 'Privacy Policy' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(goBack).toHaveBeenCalled();
  });
});
