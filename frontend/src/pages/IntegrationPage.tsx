import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { FormField } from '../components/FormField';
import { ProgressBar } from '../components/ProgressBar';
import { get, post, ApiError } from '../services/api';
import { ApiResponse, Integration, IntegrationInput, IntegrationStatus, SyncProgress } from '../types';

interface FormErrors {
  clientId?: string;
  clientSecret?: string;
  refreshToken?: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
  roleArn?: string;
}

/** Parsed error message for PARTIAL status */
interface PartialErrorInfo {
  message: string;
  failedBatches: Array<{ startDate: string; endDate: string; error: string }>;
  totalImported: number;
}

/** Parsed completion info */
interface CompletionInfo {
  totalImported: number;
}

const styles = {
  container: {
    maxWidth: '560px',
    margin: '40px auto',
    padding: '32px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
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
  button: {
    width: '100%',
    padding: '10px 16px',
    fontSize: '14px',
    fontWeight: 600,
    color: '#fff',
    backgroundColor: '#0066cc',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '8px',
  } as React.CSSProperties,
  buttonDisabled: {
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
    padding: '4px 10px',
    borderRadius: '12px',
    fontSize: '12px',
    fontWeight: 600,
    marginBottom: '16px',
  } as React.CSSProperties,
  section: {
    marginTop: '24px',
    padding: '20px',
    backgroundColor: '#f9fafb',
    borderRadius: '8px',
    border: '1px solid #e5e7eb',
  } as React.CSSProperties,
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 600,
    marginBottom: '12px',
    color: '#1a1a1a',
  } as React.CSSProperties,
  loading: {
    textAlign: 'center' as const,
    padding: '60px 20px',
    color: '#666',
    fontSize: '14px',
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
  const [loading, setLoading] = useState(true);
  const [integration, setIntegration] = useState<Integration | null>(null);

  // Form fields
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [refreshToken, setRefreshToken] = useState('');
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('');
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('');
  const [roleArn, setRoleArn] = useState('');

  const [errors, setErrors] = useState<FormErrors>({});
  const [serverError, setServerError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [salesPartialInfo, setSalesPartialInfo] = useState<PartialErrorInfo | null>(null);
  const [salesTotalImported, setSalesTotalImported] = useState<number | null>(null);
  const salesPollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load existing integration status
  useEffect(() => {
    async function loadStatus() {
      try {
        const response = await get<ApiResponse<Integration>>('/api/integration/status');
        setIntegration(response.data);
      } catch (err) {
        if (err instanceof ApiError && err.statusCode === 404) {
          setIntegration(null);
        } else if (err instanceof ApiError) {
          setServerError(err.message);
        } else {
          setServerError('Erro ao carregar status da integração.');
        }
      } finally {
        setLoading(false);
      }
    }

    loadStatus();
  }, []);

  // Check sales history progress on mount (if integration is active)
  useEffect(() => {
    if (integration?.status === 'ACTIVE') {
      checkSalesProgress();
    }
  }, [integration]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
      if (salesPollIntervalRef.current) {
        clearInterval(salesPollIntervalRef.current);
      }
    };
  }, []);

  function checkSalesProgress() {
    get<ApiResponse<SyncProgress | null>>('/api/integration/sync/progress?type=SALES_HISTORY')
      .then((response) => {
        const progress = response.data;
        if (!progress) return;

        setSalesProgress(progress);

        if (progress.status === 'IN_PROGRESS') {
          setIsSyncingSales(true);
          pollSalesProgress();
        } else if (progress.status === 'COMPLETED') {
          setSalesSyncComplete(true);
          parseSalesCompletionInfo(progress);
        } else if (progress.status === 'PARTIAL') {
          setSalesPartial(true);
          parseSalesPartialInfo(progress);
        }
      })
      .catch(() => {
        // Silently ignore
      });
  }

  function parseSalesCompletionInfo(progress: SyncProgress) {
    try {
      if (progress.errorMessage) {
        const info: CompletionInfo = JSON.parse(progress.errorMessage);
        setSalesTotalImported(info.totalImported);
      }
    } catch {
      // errorMessage might not be JSON for completed jobs
    }
  }

  function parseSalesPartialInfo(progress: SyncProgress) {
    try {
      if (progress.errorMessage) {
        const info: PartialErrorInfo = JSON.parse(progress.errorMessage);
        setSalesPartialInfo(info);
        setSalesTotalImported(info.totalImported);
      }
    } catch {
      // Fallback if errorMessage is not JSON
    }
  }

  const pollProgress = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
    }

    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await get<ApiResponse<SyncProgress>>('/api/integration/sync/progress?type=PRODUCTS');
        const progress = response.data;
        setSyncProgress(progress);

        if (progress.status === 'COMPLETED') {
          setIsSyncing(false);
          setSyncComplete(true);
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        } else if (progress.status === 'FAILED') {
          setIsSyncing(false);
          setServerError(progress.errorMessage || 'Erro durante a importação de produtos.');
          if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);
  }, []);

  const pollSalesProgress = useCallback(() => {
    if (salesPollIntervalRef.current) {
      clearInterval(salesPollIntervalRef.current);
    }

    salesPollIntervalRef.current = setInterval(async () => {
      try {
        const response = await get<ApiResponse<SyncProgress>>('/api/integration/sync/progress?type=SALES_HISTORY');
        const progress = response.data;
        setSalesProgress(progress);

        if (progress.status === 'COMPLETED') {
          setIsSyncingSales(false);
          setSalesSyncComplete(true);
          parseSalesCompletionInfo(progress);
          if (salesPollIntervalRef.current) {
            clearInterval(salesPollIntervalRef.current);
            salesPollIntervalRef.current = null;
          }
        } else if (progress.status === 'FAILED') {
          setIsSyncingSales(false);
          setServerError(progress.errorMessage || 'Erro durante a importação de vendas históricas.');
          if (salesPollIntervalRef.current) {
            clearInterval(salesPollIntervalRef.current);
            salesPollIntervalRef.current = null;
          }
        } else if (progress.status === 'PARTIAL') {
          setIsSyncingSales(false);
          setSalesPartial(true);
          parseSalesPartialInfo(progress);
          if (salesPollIntervalRef.current) {
            clearInterval(salesPollIntervalRef.current);
            salesPollIntervalRef.current = null;
          }
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);
  }, []);

  function validateForm(): FormErrors {
    const formErrors: FormErrors = {};

    if (!clientId.trim()) formErrors.clientId = 'Client ID é obrigatório';
    if (!clientSecret.trim()) formErrors.clientSecret = 'Client Secret é obrigatório';
    if (!refreshToken.trim()) formErrors.refreshToken = 'Refresh Token é obrigatório';
    if (!awsAccessKeyId.trim()) formErrors.awsAccessKeyId = 'AWS Access Key ID é obrigatório';
    if (!awsSecretAccessKey.trim()) formErrors.awsSecretAccessKey = 'AWS Secret Access Key é obrigatório';
    if (!roleArn.trim()) formErrors.roleArn = 'Role ARN é obrigatório';

    return formErrors;
  }

  async function handleConnect(e: React.FormEvent) {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    const formErrors = validateForm();
    setErrors(formErrors);

    if (Object.keys(formErrors).length > 0) {
      return;
    }

    setIsSubmitting(true);

    try {
      const payload: IntegrationInput = {
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        refreshToken: refreshToken.trim(),
        awsAccessKeyId: awsAccessKeyId.trim(),
        awsSecretAccessKey: awsSecretAccessKey.trim(),
        roleArn: roleArn.trim(),
      };

      const response = await post<ApiResponse<Integration>>('/api/integration/connect', payload);
      setIntegration(response.data);
      setSuccessMessage('Conexão realizada com sucesso!');

      // If connection is active, start polling for sales history progress
      // (the backend auto-triggers importHistoricalSales after connect)
      if (response.data.status === 'ACTIVE') {
        setIsSyncingSales(true);
        // Small delay to let the backend create the SyncJob
        setTimeout(() => {
          pollSalesProgress();
        }, 2000);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.details && err.details.length > 0) {
          const fieldErrors: FormErrors = {};
          for (const detail of err.details) {
            const key = detail.field as keyof FormErrors;
            if (key in formErrors) {
              fieldErrors[key] = detail.message;
            }
          }
          if (Object.keys(fieldErrors).length > 0) {
            setErrors(fieldErrors);
          } else {
            setServerError(err.message);
          }
        } else {
          setServerError(err.message);
        }
      } else {
        setServerError('Erro ao conectar com o servidor. Tente novamente.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleImportProducts() {
    setServerError('');
    setSyncComplete(false);
    setIsSyncing(true);

    try {
      await post<ApiResponse<SyncProgress>>('/api/integration/sync/products', {});
      pollProgress();
    } catch (err) {
      setIsSyncing(false);
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao iniciar importação de produtos.');
      }
    }
  }

  async function handleImportSales() {
    setServerError('');
    setSalesSyncComplete(false);
    setSalesPartial(false);
    setSalesPartialInfo(null);
    setSalesTotalImported(null);
    setIsSyncingSales(true);

    try {
      await post('/api/integration/sync/sales', {});
      pollSalesProgress();
    } catch (err) {
      setIsSyncingSales(false);
      if (err instanceof ApiError) {
        setServerError(err.message);
      } else {
        setServerError('Erro ao iniciar importação de vendas históricas.');
      }
    }
  }

  function handleGoToProducts() {
    navigate('/products');
  }

  if (loading) {
    return (
      <div style={styles.loading}>
        <p>Carregando integração...</p>
      </div>
    );
  }

  const isConnected = integration?.status === 'ACTIVE';

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Integração Amazon SP-API</h1>
      <p style={styles.subtitle}>
        Conecte sua conta Amazon para importar produtos e sincronizar vendas.
      </p>

      {serverError && (
        <div style={styles.serverError} role="alert">
          {serverError}
        </div>
      )}

      {successMessage && (
        <div style={styles.successMessage} role="status">
          {successMessage}
        </div>
      )}

      {/* Connection Status Badge */}
      {integration && (
        <span style={{ ...styles.statusBadge, ...STATUS_STYLES[integration.status] }}>
          {STATUS_LABELS[integration.status]}
        </span>
      )}

      {integration?.status === 'ERROR' && integration.lastError && (
        <div style={styles.serverError} role="alert">
          Último erro: {integration.lastError}
        </div>
      )}

      {/* Credentials Form */}
      {(!integration || integration.status === 'ERROR' || integration.status === 'PENDING') && (
        <form onSubmit={handleConnect} noValidate>
          <FormField
            label="Client ID"
            name="clientId"
            value={clientId}
            onChange={setClientId}
            error={errors.clientId}
            placeholder="amzn1.application-oa2-client.xxx"
            required
          />
          <FormField
            label="Client Secret"
            name="clientSecret"
            value={clientSecret}
            onChange={setClientSecret}
            error={errors.clientSecret}
            placeholder="Seu Client Secret"
            required
          />
          <FormField
            label="Refresh Token"
            name="refreshToken"
            value={refreshToken}
            onChange={setRefreshToken}
            error={errors.refreshToken}
            placeholder="Atzr|xxx"
            required
          />
          <FormField
            label="AWS Access Key ID"
            name="awsAccessKeyId"
            value={awsAccessKeyId}
            onChange={setAwsAccessKeyId}
            error={errors.awsAccessKeyId}
            placeholder="AKIAIOSFODNN7EXAMPLE"
            required
          />
          <FormField
            label="AWS Secret Access Key"
            name="awsSecretAccessKey"
            value={awsSecretAccessKey}
            onChange={setAwsSecretAccessKey}
            error={errors.awsSecretAccessKey}
            placeholder="Sua AWS Secret Access Key"
            required
          />
          <FormField
            label="Role ARN"
            name="roleArn"
            value={roleArn}
            onChange={setRoleArn}
            error={errors.roleArn}
            placeholder="arn:aws:iam::123456789012:role/SellingPartnerRole"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            style={
              isSubmitting
                ? { ...styles.button, ...styles.buttonDisabled }
                : styles.button
            }
          >
            {isSubmitting ? 'Testando conexão...' : 'Conectar e Testar'}
          </button>
        </form>
      )}

      {/* Sync Section - shown after successful connection */}
      {isConnected && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Importação de Produtos</h2>

          {/* Import progress */}
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
            <ProgressBar
              progress={0}
              statusText="Iniciando importação..."
            />
          )}

          {/* Import complete */}
          {syncComplete && syncProgress && (
            <>
              <ProgressBar
                progress={100}
                statusText={
                  syncProgress.processedItems != null
                    ? `Importação concluída! ${syncProgress.processedItems} produtos importados.`
                    : 'Importação concluída!'
                }
              />
              <button
                type="button"
                onClick={handleGoToProducts}
                style={styles.buttonSuccess}
              >
                Ir para Produtos
              </button>
            </>
          )}

          {/* Import button - shown when not syncing and not complete */}
          {!isSyncing && !syncComplete && (
            <button
              type="button"
              onClick={handleImportProducts}
              style={styles.buttonSecondary}
            >
              Importar Produtos
            </button>
          )}
        </div>
      )}

      {/* Sales History Section - shown after successful connection */}
      {isConnected && (
        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Vendas Históricas</h2>

          {/* Sales import in progress */}
          {isSyncingSales && salesProgress && (
            <ProgressBar
              progress={salesProgress.progress}
              statusText={
                salesProgress.processedItems != null && salesProgress.totalItems != null
                  ? `Importando vendas... ${salesProgress.processedItems} de ${salesProgress.totalItems} períodos processados`
                  : `Importando vendas... ${Math.round(salesProgress.progress)}%`
              }
            />
          )}

          {isSyncingSales && !salesProgress && (
            <ProgressBar
              progress={0}
              statusText="Iniciando importação de vendas históricas..."
            />
          )}

          {/* Sales import complete */}
          {salesSyncComplete && !salesPartial && (
            <div style={styles.successMessage} role="status">
              {salesTotalImported != null
                ? `Importação concluída! ${salesTotalImported} vendas importadas.`
                : 'Importação de vendas históricas concluída!'}
            </div>
          )}

          {/* Sales import partial - some batches failed */}
          {salesPartial && (
            <>
              <div style={styles.warningMessage} role="alert">
                {salesPartialInfo
                  ? `${salesPartialInfo.message}. ${salesPartialInfo.totalImported} vendas importadas com sucesso.`
                  : 'Importação parcial: alguns períodos falharam.'}
              </div>
              <button
                type="button"
                onClick={handleImportSales}
                style={styles.buttonWarning}
              >
                Retentar períodos com falha
              </button>
            </>
          )}

          {/* Import sales button - shown when not syncing and not complete/partial */}
          {!isSyncingSales && !salesSyncComplete && !salesPartial && (
            <button
              type="button"
              onClick={handleImportSales}
              style={styles.buttonSecondary}
            >
              Importar Vendas Históricas
            </button>
          )}
        </div>
      )}
    </div>
  );
}
