import React from 'react';

export interface ProgressBarProps {
  /** Progress percentage (0-100) */
  progress: number;
  /** Status text displayed below the bar */
  statusText?: string;
}

const styles = {
  container: {
    width: '100%',
    marginBottom: '12px',
  } as React.CSSProperties,
  barOuter: {
    width: '100%',
    height: '20px',
    backgroundColor: '#e9ecef',
    borderRadius: '4px',
    overflow: 'hidden',
  } as React.CSSProperties,
  barInner: {
    height: '100%',
    backgroundColor: '#0066cc',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as React.CSSProperties,
  barText: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#fff',
  } as React.CSSProperties,
  statusText: {
    fontSize: '13px',
    color: '#666',
    marginTop: '6px',
  } as React.CSSProperties,
};

export function ProgressBar({ progress, statusText }: ProgressBarProps) {
  const clampedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div style={styles.container} role="progressbar" aria-valuenow={clampedProgress} aria-valuemin={0} aria-valuemax={100}>
      <div style={styles.barOuter}>
        <div style={{ ...styles.barInner, width: `${clampedProgress}%` }}>
          {clampedProgress >= 10 && (
            <span style={styles.barText}>{Math.round(clampedProgress)}%</span>
          )}
        </div>
      </div>
      {statusText && <p style={styles.statusText}>{statusText}</p>}
    </div>
  );
}
