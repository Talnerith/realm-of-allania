import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { CONTACT_EMAIL } from '@/lib/constants';

const loadFooter = (patreonUrl) => {
  jest.resetModules();
  if (patreonUrl) process.env.NEXT_PUBLIC_PATREON_URL = patreonUrl;
  else delete process.env.NEXT_PUBLIC_PATREON_URL;
  return require('@/components/SiteFooter').default;
};

describe('SiteFooter', () => {
  const original = process.env.NEXT_PUBLIC_PATREON_URL;
  afterEach(() => {
    if (original === undefined) delete process.env.NEXT_PUBLIC_PATREON_URL;
    else process.env.NEXT_PUBLIC_PATREON_URL = original;
  });

  test('legal links open their tab', () => {
    const SiteFooter = loadFooter();
    const onOpenLegal = jest.fn();
    render(<SiteFooter onOpenLegal={onOpenLegal} />);
    fireEvent.click(screen.getByRole('button', { name: 'Terms of Service' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cookie Policy' }));
    expect(onOpenLegal.mock.calls).toEqual([['tos'], ['cookies']]);
  });

  test('shows the contact address', () => {
    const SiteFooter = loadFooter();
    render(<SiteFooter />);
    expect(screen.getByRole('link', { name: CONTACT_EMAIL })).toHaveAttribute('href', `mailto:${CONTACT_EMAIL}`);
  });

  test('hides the Patreon section until its URL is set', () => {
    const SiteFooter = loadFooter();
    render(<SiteFooter />);
    expect(screen.queryByText('Support the Realm')).not.toBeInTheDocument();
  });

  test('links to Patreon in a new tab when the URL is set', () => {
    const SiteFooter = loadFooter('https://www.patreon.com/example');
    render(<SiteFooter />);
    const link = screen.getByRole('link', { name: /Support us on Patreon/ });
    expect(link).toHaveAttribute('href', 'https://www.patreon.com/example');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });
});
