import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DataSourceBadge } from './DataSourceBadge.js';

describe('DataSourceBadge', () => {
  it('renders Demo data and Derived labels when present', () => {
    const { rerender } = render(<DataSourceBadge label="Demo data" />);
    expect(screen.getByText('Demo data')).toBeInTheDocument();

    rerender(<DataSourceBadge label="Derived from API loans" />);
    expect(screen.getByText('Derived from API loans')).toBeInTheDocument();
  });

  it('renders nothing for API-backed fields without labels', () => {
    const { container } = render(<DataSourceBadge />);
    expect(container).toBeEmptyDOMElement();
  });
});
