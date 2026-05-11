import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ProgressBar } from '../components/ProgressBar';
import { get, post, ApiError } from '../services/api';
import { ApiResponse, Integration, IntegrationStatus, SyncProgress } from '../types';

const styles = {
  container: {
    maxWidth: '600px',
  } as React.CSSProperties,
  title: {
    fontSize: '24px',
    fontWeight: 700,
    marginBottom: '8px',
    color: '#1a1a1a',
  } as React.CSSProperties,
  subtitle: {
    fontSize: '14px',
    color: '#666',
    marginBottom: '24px',
  } as React.CSSProperties,
  card: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px',
    textAlign: 'center' as const,
  } as React.CSSProperties,
  section: {
    backgroundColor: '#fff',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
    padding: '24px',
    marginBottom: '24px',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#1a1a1a',
  } as React.CSSProperties,
  connectButton: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '10px',
    padding: '14px 28px',
    fontSize: '16px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#ff9900',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    textDecoration: 'none',
    marginTop: '16px',
  } as React.CSSProperties,
  connectButtonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  buttonSecondary: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#0066cc',
    backgroundColor: '#fff',
    border: '1px solid #0066cc',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
  } as React.CSSProperties,
  buttonSuccess: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#16a34a',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
  } as React.CSSProperties,
  buttonWarning: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#d97706',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '12px',
  } as React.CSSProperties,
  serverError: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    color: '#dc3545',
    fontSize: '13px',
  } as React.CSSProperties,
  successMessage: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#f0fdf4',
    border: '1px solid #bbf7d0',
    borderRadius: '4px',
    color: '#16a34a',
    fontSize: '13px',
  } as React.CSSProperties,
  warningMessage: {
    padding: '12px',
    marginBottom: '16px',
    backgroundColor: '#fffbeb',
    border: '1px solid #fde68a',
    borderRadius: '4px',
    color: '#92400e',
    fontSize: '13px',
  } as React.CSSProperties,
  statusBadge: {
    display: 'inline-block',
    padding: '6px 14px',
    borderRadius: '12px',
    fontSize: '13px',
    fontWeight: 600,
    marginBottom: '16px',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#666',
    fontSize: '14px',
  } as React.CSSProperties,
  infoText: {
    fontSize: '14px',
    color: '#6b7280',
    lineHeight: 1.6,
    marginBottom: '16px',
  } as React.CSSProperties,
  credentialInfo: {
    fontSize: '13px',
    color: '#6b7280',
    backgroundColor: '#f9fafb',
    padding: '12px',
    borderRadius: '6px',
    marginTop: '12px',
    textAlign: 'left' as const,
  } as React.CSSProperties,
};

const STATUS_STYLES: Record<IntegrationStatus, React.CSSProperties> = {
  PENDING: { backgroundColor: '#fef9c3', color: '#a16207', border: '1px solid #fde047' },
  ACTIVE: { backgroundColor: '#dcfce7', color: '#16a34a', border: '1px solid #86efac' },
  ERROR: { backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' },
};

const STATUS_LABELS: Record<IntegrationStatus, string> = {
  PENDING: 'Pendente',
  ACTIVE: 'Conectado',
  ERROR: 'Erro',
};

export function IntegrationPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<Integration | null>(null);
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);

  // Products sync state
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncComplete, setSyncComplete] = useState(false);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sales history sync state
  const [salesProgress, setSalesProgress] = useState<SyncProgress | null>(null);
  const [isSyncingSales, setIsSyncingSales] = useState(false);
  const [salesSyncComplete, setSalesSyncComplete] = useState(false);
  const [salesPartial, setSalesPartial] = useState(false);
  const salesPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check URL params for OAuth callback results
  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');

    if (connected === 'true') {
      setSuccessMessage('Conta Amazon conectada com sucesso! Seus produtos e vendas serão importados automaticamente.');
    } else if (error) {
      const errorMessages: Record<string, string> = {
        no_code: 'Autorização não foi concedida pela Amazon.',
        token_exchange_failed: 'Falha ao obter token de acesso. Verifique as credenciais do app.',
        no_store: 'Cadastre a loja antes de conectar a Amazon.',
        callback_failed: 'Erro durante a autorização. Tente novamente.',
      };
      setServerError(errorMessages[error] || 'Erro desconhecido durante a autorização.');
    }
  }, [searchParams]);

  // Load integration status
  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await get<ApiResponse<Integration | null>>('/api/integration/status');
        setIntegration(response.data);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) {
          setIntegration(null);
        } else if (err instanceof ApiError) {
          setServerError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }
    loadStatus();
  }, []);

  // Check sales progress when connected
  useEffect(() => {
    if (integration?.status === 'ACTIVE') {
      checkSalesProgress();
    }
  }, [integration]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
      if (salesPollIntervalRef.current) clearInterval(salesPollIntervalRef.current);
    };
  }, []);

  function checkSalesProgress() {
    get<ApiResponse<SyncProgress | null>>('/api/integration/sync/progress?type=SALES_HISTORY')
      .then((response) => {
        if (!response.data) return;
        setSalesProgress(response.data);
        if (response.data.status === 'IN_PROGRESS') {
          setIsSyncingSales(true);
          pollSalesProgress();
        } else if (response.data.status === 'COMPLETED') {
          setSalesSyncComplete(true);
        } else if (response.data.status === 'PARTIAL') {
          setSalesPartial(true);
        }
      })
      .catch(() => {});
  }

  async function handleConnectAmazon() {
    setIsConnecting(true);
    setServerError('');
    try {
      const response = await get<ApiResponse<{ authUrl: string }>>('/api/integration/auth-url');
      // Redirect user to Amazon authorization page
      window.location.href = response.data.authUrl;
    } catch (err) {
      setIsConnecting(false);
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao iniciar conexão com a Amazon.');
      }
    }
  }

  const pollProgress = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await get<ApiResponse<SyncProgress>>('/api/integration/sync/progress?type=PRODUCTS');
        setSyncProgress(response.data);
        if (response.data.status === 'COMPLETED') {
          setIsSyncing(false);
          setSyncComplete(true);
          clearInterval(pollIntervalRef.current!);
        } else if (response.data.status === 'FAILED') {
          setIsSyncing(false);
          setServerError(response.data.errorMessage || 'Erro na importação de produtos.');
          clearInterval(pollIntervalRef.current!);
        }
      } catch {}
    }, 3000);
  }, []);

  const pollSalesProgress = useCallback(() => {
    if (salesPollIntervalRef.current) clearInterval(salesPollIntervalRef.current);
    salesPollIntervalRef.current = setInterval(async () => {
      try {
        const response = await get<ApiResponse<SyncProgress>>('/api/integration/sync/progress?type=SALES_HISTORY');
        setSalesProgress(response.data);
        if (response.data.status === 'COMPLETED') {
          setIsSyncingSales(false);
          setSalesSyncComplete(true);
          clearInterval(salesPollIntervalRef.current!);
        } else if (response.data.status === 'FAILED') {
          setIsSyncingSales(false);
          setServerError(response.data.errorMessage || 'Erro na importação de vendas.');
          clearInterval(salesPollIntervalRef.current!);
        } else if (response.data.status === 'PARTIAL') {
          setIsSyncingSales(false);
          setSalesPartial(true);
          clearInterval(salesPollIntervalRef.current!);
        }
      } catch {}
    }, 3000);
  }, []);

  async function handleImportProducts() {
    setServerError('');
    setSyncComplete(false);
    setIsSyncing(true);
    try {
      await post('/api/integration/sync/products', {});
      pollProgress();
    } catch (err) {
      setIsSyncing(false);
      if (err instanceof ApiError) setServerError(err.message);
    }
  }

  async function handleImportSales() {
    setServerError('');
    setSalesSyncComplete(false);
    setSalesPartial(false);
    setIsSyncingSales(true);
    try {
      await post('/api/integration/sync/sales', {});
      pollSalesProgress();
    } catch (err) {
      setIsSyncingSales(false);
      if (err instanceof ApiError) setServerError(err.message);
    }
  }

  if (loading) {
    return <div style={styles.loading}>Carregando integração...</div>;
  }

  const isConnected = integration?.status === 'ACTIVE';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Integração Amazon</h1>
      <p style={styles.subtitle}>
        Conecte sua conta Amazon Seller Central para importar produtos e vendas automaticamente.
      </p>

      {serverError && <div style={styles.serverError} role="alert">{serverError}</div>}
      {successMessage && <div style={styles.successMessage} role="status">{successMessage}</div>}

      {/* Status Badge */}
      {integration && (
        <span style={{ ...styles.statusBadge, ...STATUS_STYLES[integration.status] }}>
          {STATUS_LABELS[integration.status]}
        </span>
      )}

      {integration?.status === 'ERROR' && integration.lastError && (
        <div style={styles.serverError}>Último erro: {integration.lastError}</div>
      )}

      {/* Connect Section - shown when not connected */}
      {!isConnected && (
        <div style={styles.card}>
          <p style={styles.infoText}>
            Clique no botão abaixo para autorizar o acesso à sua conta Amazon Seller Central.
            Você será redirecionado para a Amazon para conceder permissão.
          </p>

          <button
            onClick={handleConnectAmazon}
            disabled={isConnecting}
            style={isConnecting ? { ...styles.connectButton, ...styles.connectButtonDisabled } : styles.connectButton}
          >
            🔗 {isConnecting ? 'Redirecionando...' : 'Conectar com Amazon'}
          </button>

          <div style={styles.credentialInfo}>
            <strong>Como funciona:</strong><br />
            1. Você será redirecionado para o Amazon Seller Central<br />
            2. Autorize o aplicativo "Amazon Sales Manager"<br />
            3. Será redirecionado de volta automaticamente<br />
            4. Seus produtos e vendas serão importados
          </div>
        </div>
      )}

      {/* Connected - Show sync options */}
      {isConnected && (
        <>
          {/* Products Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Importação de Produtos</h2>

            {isSyncing && syncProgress && (
              <ProgressBar
                progress={syncProgress.progress}
                statusText={
                  syncProgress.processedItems != null && syncProgress.totalItems != null
                    ? `Importando... ${syncProgress.processedItems} de ${syncProgress.totalItems} produtos`
                    : `Importando... ${Math.round(syncProgress.progress)}%`
                }
              />
            )}

            {isSyncing && !syncProgress && (
              <ProgressBar progress={0} statusText="Iniciando importação..." />
            )}

            {syncComplete && (
              <>
                <ProgressBar
                  progress={100}
                  statusText={syncProgress?.processedItems ? `${syncProgress.processedItems} produtos importados!` : 'Importação concluída!'}
                />
                <button type="button" onClick={() => navigate('/products')} style={styles.buttonSuccess}>
                  Ir para Produtos
                </button>
              </>
            )}

            {!isSyncing && !syncComplete && (
              <button type="button" onClick={handleImportProducts} style={styles.buttonSecondary}>
                Importar Produtos
              </button>
            )}
          </div>

          {/* Sales History Section */}
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Vendas Históricas</h2>

            {isSyncingSales && salesProgress && (
              <ProgressBar
                progress={salesProgress.progress}
                statusText={
                  salesProgress.processedItems != null && salesProgress.totalItems != null
                    ? `Importando... ${salesProgress.processedItems} de ${salesProgress.totalItems} períodos`
                    : `Importando... ${Math.round(salesProgress.progress)}%`
                }
              />
            )}

            {isSyncingSales && !salesProgress && (
              <ProgressBar progress={0} statusText="Iniciando importação de vendas..." />
            )}

            {salesSyncComplete && !salesPartial && (
              <div style={styles.successMessage}>Importação de vendas históricas concluída!</div>
            )}

            {salesPartial && (
              <>
                <div style={styles.warningMessage}>Importação parcial: alguns períodos falharam.</div>
                <button type="button" onClick={handleImportSales} style={styles.buttonWarning}>
                  Retentar períodos com falha
                </button>
              </>
            )}

            {!isSyncingSales && !salesSyncComplete && !salesPartial && (
              <button type="button" onClick={handleImportSales} style={styles.buttonSecondary}>
                Importar Vendas Históricas
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
