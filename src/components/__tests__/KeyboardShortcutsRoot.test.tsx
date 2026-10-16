import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import KeyboardShortcutsRoot from '../KeyboardShortcutsRoot';

const KeyboardShortcutsProviderMock = vi.fn(({ children }: { children: React.ReactNode }) => (
  <div data-testid="ks-provider">{children}</div>
));
vi.mock('@/context/KeyboardShortcutsContext', () => ({
  KeyboardShortcutsProvider: (props: any) => KeyboardShortcutsProviderMock(props),
}));

describe('KeyboardShortcutsRoot', () => {
  it('wraps children in the KeyboardShortcutsProvider', () => {
    render(
      <KeyboardShortcutsRoot>
        <span>child content</span>
      </KeyboardShortcutsRoot>
    );
    expect(screen.getByTestId('ks-provider')).toBeInTheDocument();
    expect(screen.getByText('child content')).toBeInTheDocument();
  });
});
