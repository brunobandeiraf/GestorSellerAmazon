import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import React from 'react';

function SampleComponent({ text }: { text: string }) {
  return <div role="heading">{text}</div>;
}

describe('Frontend Test Setup Verification', () => {
  it('should render a component with React Testing Library', () => {
    render(<SampleComponent text="Hello Test" />);
    expect(screen.getByRole('heading')).toHaveTextContent('Hello Test');
  });

  it('should support basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('hello').toContain('ell');
  });
});
