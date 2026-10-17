import React from 'react';
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Hero from '@/components/Hero';

describe('Hero snapshots', () => {
  it('matches the landing page hero section', () => {
    const { asFragment } = render(<Hero />);

    expect(asFragment()).toMatchSnapshot();
  });
});
