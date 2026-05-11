import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { IntegrationPage } from '../../src/pages/IntegrationPage';

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
      <IntegrationPage />
    </MemoryRouter>
  );
}

const integrationNotFound = {
  error: { code: 'NOT_FOUND', message: 'Integration not found' },
};

const integrationActive = {
  data: {
    id: 'int-1',
    storeId: 'store-1',
    status: 'ACTIVE',
    lastSyncAt: '2024-01-01T00:00:00Z',
    lastError: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const integrationError = {
  data: {
    id: 'int-1',
    storeId: 'store-1',
    status: 'ERROR',
    lastSyncAt: null,
    lastError: 'Invalid credentials',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

const integrationPending = {
  data: {
    id: 'int-1',
    storeId: 'store-1',
    status: 'PENDING',
    lastSyncAt: null,
    lastError: null,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  },
};

describe('IntegrationPage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows loading state while fetching status', () => {
    vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));
    renderPage();

    expect(screen.getByText(/carregando/i)).toBeInTheDocument();
  });

  it('shows credentials form when no integration exists', async () => {
    mockFetchResponses({ ok: false, status: 404, body: integrationNotFound });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/client secret/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/refresh token/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aws access key id/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/aws secret access key/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/role arn/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /conectar e testar/i })).toBeInTheDocument();
  });

  it('validates all required fields', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchResponses({ ok: false, status: 404, body: integrationNotFound });

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /conectar e testar/i }));

    expect(screen.getByText(/client id é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/client secret é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/refresh token é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/aws access key id é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/aws secret access key é obrigatório/i)).toBeInTheDocument();
    expect(screen.getByText(/role arn é obrigatório/i)).toBeInTheDocument();
  });

  it('submits credentials and shows success on ACTIVE status', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchResponses(
      { ok: false, status: 404, body: integrationNotFound },
      { ok: true, body: integrationActive }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/client id/i), 'test-client-id');
    await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
    await user.type(screen.getByLabelText(/refresh token/i), 'test-token');
    await user.type(screen.getByLabelText(/aws access key id/i), 'AKIATEST');
    await user.type(screen.getByLabelText(/aws secret access key/i), 'secret-key');
    await user.type(screen.getByLabelText(/role arn/i), 'arn:aws:iam::123:role/Test');

    await user.click(screen.getByRole('button', { name: /conectar e testar/i }));

    await waitFor(() => {
      expect(screen.getByText(/conexão realizada com sucesso/i)).toBeInTheDocument();
    });

    // Should show ACTIVE badge
    expect(screen.getByText('Conectado')).toBeInTheDocument();
  });

  it('shows ACTIVE status badge and import button when connected', async () => {
    mockFetchResponses(
      { ok: true, body: integrationActive },
      // Sales progress check (returns null - no sales sync yet)
      { ok: true, body: { data: null } }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Conectado')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /importar produtos/i })).toBeInTheDocument();
  });

  it('shows ERROR status badge with last error message', async () => {
    mockFetchResponses({ ok: true, body: integrationError });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Erro')).toBeInTheDocument();
    });

    expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    // Should still show the form for retry
    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
  });

  it('shows PENDING status badge and form', async () => {
    mockFetchResponses({ ok: true, body: integrationPending });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText('Pendente')).toBeInTheDocument();
    });

    expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
  });

  it('shows server error when connection fails', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockFetchResponses(
      { ok: false, status: 404, body: integrationNotFound },
      {
        ok: false,
        status: 502,
        body: { error: { code: 'INTEGRATION_ERROR', message: 'Falha ao conectar com Amazon SP-API' } },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText(/client id/i)).toBeInTheDocument();
    });

    await user.type(screen.getByLabelText(/client id/i), 'test-client-id');
    await user.type(screen.getByLabelText(/client secret/i), 'test-secret');
    await user.type(screen.getByLabelText(/refresh token/i), 'test-token');
    await user.type(screen.getByLabelText(/aws access key id/i), 'AKIATEST');
    await user.type(screen.getByLabelText(/aws secret access key/i), 'secret-key');
    await user.type(screen.getByLabelText(/role arn/i), 'arn:aws:iam::123:role/Test');

    await user.click(screen.getByRole('button', { name: /conectar e testar/i }));

    await waitFor(() => {
      expect(screen.getByText(/falha ao conectar com amazon sp-api/i)).toBeInTheDocument();
    });
  });

  it('triggers product import and shows progress bar', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = mockFetchResponses(
      { ok: true, body: integrationActive },
      // Sales progress check (returns null - no sales sync yet)
      { ok: true, body: { data: null } },
      // POST sync/products response
      {
        ok: true,
        body: {
          data: {
            id: 'sync-1',
            type: 'PRODUCTS',
            status: 'IN_PROGRESS',
            progress: 0,
            totalItems: 50,
            processedItems: 0,
            errorMessage: null,
          },
        },
      },
      // First poll response
      {
        ok: true,
        body: {
          data: {
            id: 'sync-1',
            type: 'PRODUCTS',
            status: 'IN_PROGRESS',
            progress: 50,
            totalItems: 50,
            processedItems: 25,
            errorMessage: null,
          },
        },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar produtos/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /importar produtos/i }));

    // Should show progress bar
    await waitFor(() => {
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    // Advance timer to trigger poll
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.getByText(/25 de 50 produtos/i)).toBeInTheDocument();
    });

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'sync-1',
          type: 'PRODUCTS',
          status: 'COMPLETED',
          progress: 100,
          totalItems: 50,
          processedItems: 50,
          errorMessage: null,
        },
      }),
    } as Response);

    // Advance timer for next poll
    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.getByText(/importação concluída/i)).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: /ir para produtos/i })).toBeInTheDocument();
  });

  it('navigates to /products when "Ir para Produtos" is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const fetchMock = mockFetchResponses(
      { ok: true, body: integrationActive },
      // Sales progress check (returns null - no sales sync yet)
      { ok: true, body: { data: null } },
      {
        ok: true,
        body: {
          data: {
            id: 'sync-1',
            type: 'PRODUCTS',
            status: 'IN_PROGRESS',
            progress: 0,
            totalItems: 10,
            processedItems: 0,
            errorMessage: null,
          },
        },
      }
    );

    renderPage();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importar produtos/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /importar produtos/i }));

    // Mock completed poll
    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        data: {
          id: 'sync-1',
          type: 'PRODUCTS',
          status: 'COMPLETED',
          progress: 100,
          totalItems: 10,
          processedItems: 10,
          errorMessage: null,
        },
      }),
    } as Response);

    await act(async () => {
      vi.advanceTimersByTime(3000);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /ir para produtos/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /ir para produtos/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/products');
  });
});
