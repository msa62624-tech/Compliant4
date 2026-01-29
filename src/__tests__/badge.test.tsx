import { describe, test, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/badge';

describe('Badge Component', () => {
  test('renders badge with text', () => {
    render(<Badge>Test Badge</Badge>);
    expect(screen.getByText('Test Badge')).toBeInTheDocument();
  });

  test('applies default variant', () => {
    const { container } = render(<Badge>Default</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-primary');
  });

  test('applies secondary variant', () => {
    const { container } = render(<Badge variant="secondary">Secondary</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-secondary');
  });

  test('applies destructive variant', () => {
    const { container } = render(<Badge variant="destructive">Destructive</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('bg-destructive');
  });

  test('applies outline variant', () => {
    const { container } = render(<Badge variant="outline">Outline</Badge>);
    const badge = container.firstChild;
    expect(badge).toHaveClass('border');
  });
});
