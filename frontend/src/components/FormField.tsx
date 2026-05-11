import React from 'react';

export interface FormFieldProps {
  label: string;
  name: string;
  type?: 'text' | 'select';
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
  required?: boolean;
}

const styles = {
  container: {
    marginBottom: '16px',
  } as React.CSSProperties,
  label: {
    display: 'block',
    marginBottom: '4px',
    fontWeight: 600,
    fontSize: '14px',
    color: '#333',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '8px 12px',
    fontSize: '14px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  inputError: {
    borderColor: '#dc3545',
  } as React.CSSProperties,
  error: {
    color: '#dc3545',
    fontSize: '12px',
    marginTop: '4px',
  } as React.CSSProperties,
};

export function FormField({
  label,
  name,
  type = 'text',
  value,
  onChange,
  error,
  placeholder,
  options,
  required,
}: FormFieldProps) {
  const inputStyle = error
    ? { ...styles.input, ...styles.inputError }
    : styles.input;

  return (
    <div style={styles.container}>
      <label htmlFor={name} style={styles.label}>
        {label}
        {required && ' *'}
      </label>
      {type === 'select' && options ? (
        <select
          id={name}
          name={name}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        >
          <option value="">Selecione...</option>
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={name}
          name={name}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          style={inputStyle}
          aria-invalid={!!error}
          aria-describedby={error ? `${name}-error` : undefined}
        />
      )}
      {error && (
        <p id={`${name}-error`} style={styles.error} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
