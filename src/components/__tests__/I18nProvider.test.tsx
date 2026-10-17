import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import I18nProvider from '../I18nProvider';

describe('I18nProvider', () => {
  it('renders children wrapped in the i18next provider', () => {
    render(
      <I18nProvider>
        <span>hello world</span>
      </I18nProvider>
    );
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });
});
