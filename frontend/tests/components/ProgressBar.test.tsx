import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProgressBar } from '../../src/components/ProgressBar';

describe('ProgressBar', () => {
  it('renders with correct progress percentage', () => {
    render(<ProgressBar progress={50} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    expect(progressbar).toHaveAttribute('aria-valuemin', '0');
    expect(progressbar).toHaveAttribute('aria-valuemax', '100');
  });

  it('displays percentage text when progress >= 10', () => {
    render(<ProgressBar progress={45} />);

    expect(screen.getByText('45%')).toBeInTheDocument();
  });

  it('does not display percentage text when progress < 10', () => {
    render(<ProgressBar progress={5} />);

    expect(screen.queryByText('5%')).not.toBeInTheDocument();
  });

  it('displays status text when provided', () => {
    render(<ProgressBar progress={30} statusText="Importando produtos..." />);

    expect(screen.getByText('Importando produtos...')).toBeInTheDocument();
  });

  it('does not display status text when not provided', () => {
    const { container } = render(<ProgressBar progress={30} />);

    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it('clamps progress to 0 when negative', () => {
    render(<ProgressBar progress={-10} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '0');
  });

  it('clamps progress to 100 when over 100', () => {
    render(<ProgressBar progress={150} />);

    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
  });
});
