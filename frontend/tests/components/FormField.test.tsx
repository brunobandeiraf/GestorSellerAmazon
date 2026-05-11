import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { FormField } from '../../src/components/FormField';

describe('FormField', () => {
  it('renders a text input with label', () => {
    render(
      <FormField label="Nome" name="name" value="" onChange={() => {}} />
    );

    expect(screen.getByLabelText('Nome')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('renders a select with options', () => {
    const options = [
      { value: 'a', label: 'Option A' },
      { value: 'b', label: 'Option B' },
    ];

    render(
      <FormField
        label="Escolha"
        name="choice"
        type="select"
        value=""
        onChange={() => {}}
        options={options}
      />
    );

    expect(screen.getByLabelText('Escolha')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText('Option A')).toBeInTheDocument();
    expect(screen.getByText('Option B')).toBeInTheDocument();
  });

  it('displays error message when error prop is provided', () => {
    render(
      <FormField
        label="Nome"
        name="name"
        value=""
        onChange={() => {}}
        error="Campo obrigatório"
      />
    );

    expect(screen.getByText('Campo obrigatório')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <FormField label="Nome" name="name" value="" onChange={onChange} />
    );

    await user.type(screen.getByRole('textbox'), 'a');
    expect(onChange).toHaveBeenCalledWith('a');
  });

  it('shows required indicator when required prop is true', () => {
    render(
      <FormField label="Nome" name="name" value="" onChange={() => {}} required />
    );

    expect(screen.getByText(/nome \*/i)).toBeInTheDocument();
  });

  it('sets aria-invalid when error is present', () => {
    render(
      <FormField
        label="Nome"
        name="name"
        value=""
        onChange={() => {}}
        error="Erro"
      />
    );

    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });
});
