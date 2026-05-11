import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TaxConfigPage } from '../../src/pages/TaxConfigPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
      <TaxConfigPage />
    </MemoryRouter>
  );
}

const storeResponseMEI = {
  data: {
    id: 'store-1',
    name: 'Minha Loja',
    cnpj: '11222333000181',
    taxRegime: 'MEI',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const storeResponseLucroPresumido = {
  data: {
    id: 'store-1',
    name: 'Minha Loja',
    cnpj: '11222333000181',
    taxRegime: 'LUCRO_PRESUMIDO',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const storeResponseSimples = {
  data: {
    id: 'store-1',
    name: 'Minha Loja',
    cnpj: '11222333000181',
    taxRegime: 'SIMPLES_NACIONAL',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const taxNotFoundError = {
  error: { code: 'NOT_FOUND', message: 'Tax config not found' },
};

const existingTaxConfig = {
  data: {
    id: 'tax-1',
    storeId: 'store-1',
    icms: 18,
    pis: 1.65,
    cofins: 7.6,
    irpj: 15,
    csll: 9,
    dasRate: 0,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

describe('TaxConfigPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  it('shows loading state while fetching data', () => {
    // Never resolve the fetch
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows DAS rate field for MEI regime (first setup)', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    // Should NOT show Lucro Presumido fields
    expect(screen.queryByLabelText(/icms/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/pis/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/cofins/i)).not.toBeInTheDocument();
  });

  it('shows DAS rate field for Simples Nacional regime', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseSimples },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    expect(screen.queryByLabelText(/icms/i)).not.toBeInTheDocument();
  });

  it('shows all tax fields for Lucro Presumido regime', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseLucroPresumido },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/icms/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/pis/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cofins/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/irpj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/csll/i)).toBeInTheDocument();
    // Should NOT show DAS field
    expect(screen.queryByLabelText(/alíquota das/i)).not.toBeInTheDocument();
  });

  it('validates rate values are between 0 and 100', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/alíquota das/i), '150');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(screen.getByText(/alíquota deve estar entre 0% e 100%/i)).toBeInTheDocument();
  });

  it('validates negative values are rejected', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/alíquota das/i), '-5');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    expect(screen.getByText(/alíquota deve estar entre 0% e 100%/i)).toBeInTheDocument();
  });

  it('submits valid tax config and shows success message', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError },
      // PUT response
      {
        ok: true,
        body: {
          data: {
            id: 'tax-1',
            storeId: 'store-1',
            icms: 0,
            pis: 0,
            cofins: 0,
            irpj: 0,
            csll: 0,
            dasRate: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/alíquota das/i), '5');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByText(/configuração de impostos salva com sucesso/i)).toBeInTheDocument();
    });
  });

  it('shows "Continuar para Integração" button after first-time save', async () => {
    const user = userEvent.setup();
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError },
      {
        ok: true,
        body: {
          data: {
            id: 'tax-1',
            storeId: 'store-1',
            icms: 0,
            pis: 0,
            cofins: 0,
            irpj: 0,
            csll: 0,
            dasRate: 5,
            createdAt: '2024-01-01T00:00:00Z',
            updatedAt: '2024-01-01T00:00:00Z',
          },
        },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/alíquota das/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/alíquota das/i), '5');
    await user.click(screen.getByRole('button', { name: /salvar/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /continuar para integração/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /continuar para integração/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/integration');
  });

  it('does NOT show continue button when editing existing config', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseLucroPresumido },
      { ok: true, body: existingTaxConfig }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/icms/i)).toBeInTheDocument();
    });

    // Should not show continue button since config already exists
    expect(screen.queryByRole('button', { name: /continuar para integração/i })).not.toBeInTheDocument();
  });

  it('loads existing tax config values into form fields', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseLucroPresumido },
      { ok: true, body: existingTaxConfig }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/icms/i)).toHaveValue('18');
    });

    expect(screen.getByLabelText(/pis/i)).toHaveValue('1.65');
    expect(screen.getByLabelText(/cofins/i)).toHaveValue('7.6');
    expect(screen.getByLabelText(/irpj/i)).toHaveValue('15');
    expect(screen.getByLabelText(/csll/i)).toHaveValue('9');
  });

  it('displays server error when API fails', async () => {
    mockFetchResponses(
      {
        ok: false,
        status: 500,
        body: { error: { code: 'INTERNAL_ERROR', message: 'Erro interno' } },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Erro interno')).toBeInTheDocument();
    });
  });

  it('displays regime label correctly', async () => {
    mockFetchResponses(
      { ok: true, body: storeResponseMEI },
      { ok: false, status: 404, body: taxNotFoundError }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('MEI')).toBeInTheDocument();
    });
  });
});
