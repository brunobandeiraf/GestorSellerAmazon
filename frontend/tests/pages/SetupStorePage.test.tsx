import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SetupStorePage } from '../../src/pages/SetupStorePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function renderPage() {
  return render(
    <MemoryRouter>
      <SetupStorePage />
    </MemoryRouter>
  );
}

describe('SetupStorePage', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    vi.restoreAllMocks();
  });

  it('renders the form with all required fields', () => {
    renderPage();

    expect(screen.getByLabelText(/nome da loja/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cnpj/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/regime tributário/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cadastrar loja/i })).toBeInTheDocument();
  });

  it('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(screen.getByRole('button', { name: /cadastrar loja/i }));

    expect(screen.getByText('Nome da loja é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('CNPJ é obrigatório')).toBeInTheDocument();
    expect(screen.getByText('Regime tributário é obrigatório')).toBeInTheDocument();
  });

  it('shows error for invalid CNPJ format', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(screen.getByLabelText(/nome da loja/i), 'Minha Loja');
    await user.type(screen.getByLabelText(/cnpj/i), '12345678901234');
    await user.selectOptions(screen.getByLabelText(/regime tributário/i), 'MEI');
    await user.click(screen.getByRole('button', { name: /cadastrar loja/i }));

    expect(screen.getByText(/cnpj inválido/i)).toBeInTheDocument();
  });

  it('applies CNPJ mask while typing', async () => {
    const user = userEvent.setup();
    renderPage();

    const cnpjInput = screen.getByLabelText(/cnpj/i);
    await user.type(cnpjInput, '11222333000181');

    expect(cnpjInput).toHaveValue('11.222.333/0001-81');
  });

  it('submits form successfully and navigates to /tax-config', async () => {
    const user = userEvent.setup();
    // Valid CNPJ: 11.222.333/0001-81
    const mockResponse = {
      data: {
        id: '123',
        name: 'Minha Loja',
        cnpj: '11222333000181',
        taxRegime: 'MEI',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      },
    };

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    } as Response);

    renderPage();

    await user.type(screen.getByLabelText(/nome da loja/i), 'Minha Loja');
    await user.type(screen.getByLabelText(/cnpj/i), '11222333000181');
    await user.selectOptions(screen.getByLabelText(/regime tributário/i), 'MEI');
    await user.click(screen.getByRole('button', { name: /cadastrar loja/i }));

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/tax-config');
    });
  });

  it('displays backend validation errors per field', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos',
          details: [
            { field: 'cnpj', message: 'CNPJ já cadastrado no sistema' },
          ],
        },
      }),
    } as Response);

    renderPage();

    await user.type(screen.getByLabelText(/nome da loja/i), 'Minha Loja');
    await user.type(screen.getByLabelText(/cnpj/i), '11222333000181');
    await user.selectOptions(screen.getByLabelText(/regime tributário/i), 'MEI');
    await user.click(screen.getByRole('button', { name: /cadastrar loja/i }));

    await waitFor(() => {
      expect(screen.getByText('CNPJ já cadastrado no sistema')).toBeInTheDocument();
    });
  });

  it('displays generic server error message', async () => {
    const user = userEvent.setup();

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Erro interno do servidor',
        },
      }),
    } as Response);

    renderPage();

    await user.type(screen.getByLabelText(/nome da loja/i), 'Minha Loja');
    await user.type(screen.getByLabelText(/cnpj/i), '11222333000181');
    await user.selectOptions(screen.getByLabelText(/regime tributário/i), 'MEI');
    await user.click(screen.getByRole('button', { name: /cadastrar loja/i }));

    await waitFor(() => {
      expect(screen.getByText('Erro interno do servidor')).toBeInTheDocument();
    });
  });

  it('shows regime tributário options: MEI, Simples Nacional, Lucro Presumido', () => {
    renderPage();

    const select = screen.getByLabelText(/regime tributário/i);
    expect(select).toBeInTheDocument();

    const options = select.querySelectorAll('option');
    const optionTexts = Array.from(options).map((o) => o.textContent);
    expect(optionTexts).toContain('MEI');
    expect(optionTexts).toContain('Simples Nacional');
    expect(optionTexts).toContain('Lucro Presumido');
  });
});
