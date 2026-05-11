import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { ProductsPage } from '../../src/pages/ProductsPage';

function mockFetchResponses(...responses: Array<{ ok: boolean; status?: number; body: unknown }>) {
  const fetchMock = vi.spyOn(globalThis, 'fetch');
  for (const resp of responses) {
    fetchMock.mockResolvedValueOnce({
      ok: resp.ok,
      status: resp.status ?? (resp.ok ? 200 : 500),
      json: async () => resp.body,
    } as Response);
  }
  return fetchMock;
}

function renderPage() {
  return render(
    <MemoryRouter>
      <ProductsPage />
    </MemoryRouter>
  );
}

const sampleProducts = [
  {
    id: 'prod-1',
    sku: 'SKU-001',
    asin: 'B000000001',
    title: 'Produto Teste 1',
    imageUrl: 'https://example.com/img1.jpg',
    sellingPrice: 99.9,
    costPrice: 45.0,
    status: 'ACTIVE',
    margin: 25.5,
    roi: 55.2,
    amazonFee: 14.99,
  },
  {
    id: 'prod-2',
    sku: 'SKU-002',
    asin: 'B000000002',
    title: 'Produto Teste 2',
    imageUrl: null,
    sellingPrice: 150.0,
    costPrice: null,
    status: 'INACTIVE',
    margin: null,
    roi: null,
    amazonFee: 22.5,
  },
];

describe('ProductsPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('shows loading state while fetching products', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText(/carregando produtos/i)).toBeInTheDocument();
  });

  it('shows error message when fetch fails', async () => {
    mockFetchResponses({
      ok: false,
      status: 500,
      body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno do servidor' } },
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/erro interno do servidor/i)).toBeInTheDocument();
    });
  });

  it('shows empty state when no products exist', async () => {
    mockFetchResponses({ ok: true, body: { data: [] } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/nenhum produto encontrado/i)).toBeInTheDocument();
    });
  });

  it('renders product list with all fields', async () => {
    mockFetchResponses({ ok: true, body: { data: sampleProducts } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 1')).toBeInTheDocument();
    });

    // Check product 1 details
    expect(screen.getByText(/SKU-001/)).toBeInTheDocument();
    expect(screen.getByText(/B000000001/)).toBeInTheDocument();
    expect(screen.getByText('R$ 99,90')).toBeInTheDocument();
    expect(screen.getByText('25.5%')).toBeInTheDocument();
    expect(screen.getByText('55.2%')).toBeInTheDocument();
    expect(screen.getByText('Ativo')).toBeInTheDocument();

    // Check product 2 details
    expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    expect(screen.getByText(/SKU-002/)).toBeInTheDocument();
    expect(screen.getByText('R$ 150,00')).toBeInTheDocument();
    expect(screen.getByText('Inativo')).toBeInTheDocument();
  });

  it('shows editable cost price input with existing value', async () => {
    mockFetchResponses({ ok: true, body: { data: sampleProducts } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 1')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    // First product should have its cost price pre-filled
    expect(inputs[0]).toHaveValue('45');
    // Second product should be empty
    expect(inputs[1]).toHaveValue('');
  });

  it('validates cost price must be positive', async () => {
    const user = userEvent.setup();
    mockFetchResponses({ ok: true, body: { data: sampleProducts } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    });

    const inputs = screen.getAllByRole('textbox');
    await user.clear(inputs[1]);
    await user.type(inputs[1], '0');

    // Click save for product 2
    const saveButtons = screen.getAllByRole('button', { name: /salvar/i });
    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/preço de compra deve ser positivo/i)).toBeInTheDocument();
    });
  });

  it('validates cost price cannot be empty', async () => {
    const user = userEvent.setup();
    mockFetchResponses({ ok: true, body: { data: sampleProducts } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    });

    // Click save for product 2 without entering a value
    const saveButtons = screen.getAllByRole('button', { name: /salvar/i });
    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/preço de compra é obrigatório/i)).toBeInTheDocument();
    });
  });

  it('saves cost price and updates margin/ROI', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchResponses(
      { ok: true, body: { data: sampleProducts } }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    });

    // Mock the PUT response
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          ...sampleProducts[1],
          costPrice: 80,
          margin: 18.3,
          roi: 34.4,
        },
      }),
    } as Response);

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[1], '80');

    const saveButtons = screen.getAllByRole('button', { name: /salvar/i });
    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(screen.getByText('18.3%')).toBeInTheDocument();
      expect(screen.getByText('34.4%')).toBeInTheDocument();
    });
  });

  it('saves cost price on Enter key press', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchResponses(
      { ok: true, body: { data: sampleProducts } }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          ...sampleProducts[1],
          costPrice: 60,
          margin: 22.0,
          roi: 45.0,
        },
      }),
    } as Response);

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[1], '60');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(screen.getByText('22.0%')).toBeInTheDocument();
    });
  });

  it('shows error when save fails', async () => {
    const user = userEvent.setup();
    const fetchMock = mockFetchResponses(
      { ok: true, body: { data: sampleProducts } }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Produto Teste 2')).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: { code: 'INTERNAL_ERROR', message: 'Server error' },
      }),
    } as Response);

    const inputs = screen.getAllByRole('textbox');
    await user.type(inputs[1], '50');

    const saveButtons = screen.getAllByRole('button', { name: /salvar/i });
    await user.click(saveButtons[1]);

    await waitFor(() => {
      expect(screen.getByText(/erro ao salvar/i)).toBeInTheDocument();
    });
  });

  it('displays negative margin/ROI in red', async () => {
    const productsWithNegative = [
      {
        ...sampleProducts[0],
        margin: -5.2,
        roi: -10.1,
      },
    ];
    mockFetchResponses({ ok: true, body: { data: productsWithNegative } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('-5.2%')).toBeInTheDocument();
      expect(screen.getByText('-10.1%')).toBeInTheDocument();
    });

    // Check that negative values have red color
    const marginEl = screen.getByText('-5.2%');
    expect(marginEl).toHaveStyle({ color: '#dc2626' });

    const roiEl = screen.getByText('-10.1%');
    expect(roiEl).toHaveStyle({ color: '#dc2626' });
  });

  it('displays positive margin/ROI in green', async () => {
    mockFetchResponses({ ok: true, body: { data: sampleProducts } });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('25.5%')).toBeInTheDocument();
    });

    const marginEl = screen.getByText('25.5%');
    expect(marginEl).toHaveStyle({ color: '#16a34a' });
  });
});
