# Plano de Implementação: Amazon Sales Manager

## Visão Geral

Implementação incremental do sistema de gerenciamento de vendas Amazon Brasil, seguindo a arquitetura full-stack containerizada com Docker Compose (React + Express + PostgreSQL). Cada tarefa constrói sobre as anteriores, garantindo que não haja código órfão.

## Tarefas

- [x] 1. Configurar infraestrutura e estrutura do projeto
  - [x] 1.1 Criar estrutura de diretórios do monorepo com `api/` e `frontend/`
    - Criar `api/package.json` com dependências: express, prisma, @prisma/client, node-cron, amazon-sp-api, zod
    - Criar `api/tsconfig.json` configurado para Node.js 20
    - Criar `frontend/package.json` com dependências: react, react-dom, react-router-dom, vite
    - Criar `frontend/tsconfig.json` e `frontend/vite.config.ts`
    - _Requisitos: 7.4, 7.5_

  - [x] 1.2 Criar Docker Compose e Dockerfiles
    - Criar `docker-compose.yml` com serviços: api (porta 3001), frontend (porta 3000), db (PostgreSQL 16, porta 5432)
    - Criar `api/Dockerfile` (Node 20, build TypeScript)
    - Criar `frontend/Dockerfile` (Node 20, Vite dev server)
    - Configurar variáveis de ambiente (DATABASE_URL, portas)
    - _Requisitos: 7.1, 7.6, 7.7_

  - [x] 1.3 Configurar Prisma e schema do banco de dados
    - Criar `api/prisma/schema.prisma` com todos os modelos: Store, TaxConfig, Integration, Product, Sale, SyncJob
    - Criar enums: TaxRegime, IntegrationStatus, ProductStatus, SyncType, SyncStatus
    - Configurar relações e índices conforme design
    - Gerar migration inicial
    - _Requisitos: 7.2, 7.3_

  - [x] 1.4 Criar entry point da API com Express e estrutura base
    - Criar `api/src/server.ts` com setup Express, CORS, JSON parser
    - Criar `api/src/utils/errors.ts` com classes de erro (ValidationError, NotFoundError, IntegrationError)
    - Criar middleware global de tratamento de erros com formato JSON padronizado
    - Criar `api/src/types/index.ts` com tipos TypeScript compartilhados
    - _Requisitos: 7.4_

  - [x] 1.5 Configurar framework de testes
    - Configurar Jest no backend (`api/jest.config.ts`) com suporte a TypeScript
    - Instalar fast-check para testes de propriedade
    - Configurar Vitest no frontend (`frontend/vitest.config.ts`)
    - _Requisitos: 7.4, 7.5_

- [x] 2. Implementar cadastro de loja e validações
  - [x] 2.1 Criar validadores de CNPJ e campos obrigatórios
    - Implementar `api/src/utils/validators.ts` com função `validateCNPJ` (14 dígitos, verificadores)
    - Implementar validação de campos obrigatórios (nome não vazio, max 200 chars)
    - Implementar validação de regime tributário (enum válido)
    - _Requisitos: 1.3, 1.4_

  - [ ]* 2.2 Escrever teste de propriedade para validação de CNPJ
    - **Propriedade 2: Validação de dados da loja rejeita entradas inválidas**
    - **Valida: Requisitos 1.3, 1.4**

  - [x] 2.3 Implementar store.service.ts e store.routes.ts
    - Criar `api/src/services/store.service.ts` com métodos: create, getStore, update
    - Criar `api/src/routes/store.routes.ts` com endpoints: GET /api/store, POST /api/store, PUT /api/store
    - Integrar validações antes de persistir
    - _Requisitos: 1.1, 1.2_

  - [ ]* 2.4 Escrever teste de propriedade para round-trip de loja
    - **Propriedade 1: Round-trip de criação de loja**
    - **Valida: Requisitos 1.1**

  - [x] 2.5 Implementar página de cadastro de loja no frontend
    - Criar `frontend/src/pages/SetupStorePage.tsx` com formulário (nome, CNPJ, regime tributário)
    - Criar `frontend/src/components/FormField.tsx` reutilizável
    - Criar `frontend/src/services/api.ts` (fetch wrapper com base URL configurável)
    - Implementar validação client-side e exibição de erros do backend
    - Redirecionar para configuração de impostos após sucesso
    - _Requisitos: 1.2, 1.3, 1.4, 1.5_

- [x] 3. Implementar configuração de impostos
  - [x] 3.1 Criar tax.service.ts e tax.routes.ts
    - Implementar `api/src/services/tax.service.ts` com métodos: getTaxConfig, saveTaxConfig
    - Implementar validação de alíquotas (0 ≤ valor ≤ 100)
    - Criar `api/src/routes/tax.routes.ts` com endpoints: GET /api/store/tax, PUT /api/store/tax
    - Exibir campos conforme regime: MEI/Simples → dasRate; Lucro Presumido → icms, pis, cofins, irpj, csll
    - _Requisitos: 2.1, 2.2, 2.3, 2.5_

  - [ ]* 3.2 Escrever teste de propriedade para round-trip de impostos
    - **Propriedade 3: Round-trip de configuração de impostos**
    - **Valida: Requisitos 2.3**

  - [ ]* 3.3 Escrever teste de propriedade para validação de alíquotas
    - **Propriedade 4: Validação de alíquotas rejeita valores fora do intervalo**
    - **Valida: Requisitos 2.4**

  - [x] 3.4 Implementar página de configuração de impostos no frontend
    - Criar `frontend/src/pages/TaxConfigPage.tsx`
    - Exibir campos dinâmicos conforme regime tributário selecionado
    - Implementar validação client-side (0-100%)
    - Permitir atualização a qualquer momento via sidebar
    - _Requisitos: 2.1, 2.2, 2.4, 2.5_

- [x] 4. Checkpoint - Verificar infraestrutura base
  - Garantir que todos os testes passam, docker-compose sobe corretamente, e o fluxo loja → impostos funciona. Perguntar ao usuário se há dúvidas.

- [x] 5. Implementar integração com Amazon SP-API
  - [x] 5.1 Criar amazon.service.ts com conexão e importação de produtos
    - Implementar `api/src/services/amazon.service.ts` usando pacote `amazon-sp-api`
    - Implementar método `testConnection` para validar credenciais
    - Implementar método `importProducts` via Reports API (GET_MERCHANT_LISTINGS_ALL_DATA)
    - Implementar busca de imagens via Catalog Items API
    - Implementar retry com backoff exponencial para rate limits
    - _Requisitos: 3.1, 3.2, 3.4, 3.5, 3.6_

  - [x] 5.2 Criar integration.routes.ts e product.routes.ts
    - Criar `api/src/routes/integration.routes.ts` com endpoints: POST /api/integration/connect, GET /api/integration/status, POST /api/integration/sync/products, GET /api/integration/sync/progress
    - Criar `api/src/services/product.service.ts` com métodos: listProducts, getProduct, updateCostPrice
    - Criar `api/src/routes/product.routes.ts` com endpoints: GET /api/products, GET /api/products/:id, PUT /api/products/:id/cost
    - _Requisitos: 3.2, 3.3, 4.1_

  - [ ]* 5.3 Escrever teste de propriedade para importação de produtos
    - **Propriedade 5: Importação de produtos preserva todos os campos obrigatórios**
    - **Valida: Requisitos 3.3**

  - [x] 5.4 Implementar página de integração no frontend
    - Criar `frontend/src/pages/IntegrationPage.tsx` com formulário de credenciais SP-API
    - Exibir status da conexão (PENDING, ACTIVE, ERROR)
    - Implementar botão de teste de conexão com feedback visual
    - Exibir progresso de importação de produtos com `ProgressBar`
    - Criar `frontend/src/components/ProgressBar.tsx`
    - _Requisitos: 3.1, 3.5, 3.6_

- [x] 6. Implementar gestão de preço de compra e cálculos de margem/ROI
  - [x] 6.1 Criar margin.service.ts com fórmulas de cálculo
    - Implementar `api/src/services/margin.service.ts`
    - Implementar cálculo de alíquota total por regime (MEI/Simples → dasRate; Lucro Presumido → soma individual)
    - Implementar fórmula de margem: ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_venda) × 100
    - Implementar fórmula de ROI: ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_compra) × 100
    - Implementar recálculo ao salvar costPrice e ao atualizar impostos
    - _Requisitos: 4.2, 4.3, 4.5, 4.6_

  - [ ]* 6.2 Escrever teste de propriedade para cálculos de margem e ROI
    - **Propriedade 6: Cálculos de margem e ROI seguem as fórmulas definidas**
    - **Valida: Requisitos 4.2, 4.3, 4.5, 4.6**

  - [x] 6.3 Integrar cálculos no endpoint de atualização de preço de compra
    - Atualizar `PUT /api/products/:id/cost` para chamar margin.service após salvar costPrice
    - Validar que preço de compra é positivo (> 0)
    - Retornar produto atualizado com margem e ROI calculados
    - _Requisitos: 4.1, 4.3, 4.4_

  - [x] 6.4 Implementar página de produtos no frontend
    - Criar `frontend/src/pages/ProductsPage.tsx` com lista de produtos
    - Criar `frontend/src/components/ProductList.tsx` com campo editável para preço de compra
    - Exibir margem e ROI calculados em tempo real após salvar
    - Exibir imagem, título, SKU, ASIN, preço de venda, status
    - Validação client-side (valor positivo)
    - _Requisitos: 4.1, 4.2, 4.4_

- [x] 7. Checkpoint - Verificar integração e cálculos
  - Garantir que todos os testes passam, importação de produtos funciona, e cálculos de margem/ROI estão corretos. Perguntar ao usuário se há dúvidas.

- [x] 8. Implementar dashboard de vendas em tempo real
  - [x] 8.1 Criar sync.job.ts para sincronização automática de vendas
    - Implementar `api/src/jobs/sync.job.ts` com node-cron (a cada 5 minutos)
    - Buscar vendas das últimas 6 horas via Orders API
    - Fazer upsert por amazonOrderId para evitar duplicatas
    - Calcular métricas financeiras (lucro, margem, ROI) para cada venda importada
    - Atualizar lastSyncAt na integração
    - _Requisitos: 5.1_

  - [x] 8.2 Criar dashboard.service.ts e dashboard.routes.ts
    - Implementar `api/src/services/dashboard.service.ts` com métricas consolidadas
    - Calcular: total de vendas, faturamento total, margem média, ROI médio
    - Suportar filtro por período (startDate, endDate)
    - Criar `api/src/routes/dashboard.routes.ts` com endpoint: GET /api/dashboard
    - _Requisitos: 5.2, 5.3, 5.5_

  - [x] 8.3 Criar sale.service.ts e sale.routes.ts
    - Implementar `api/src/services/sale.service.ts` com métodos: listSales (com filtro de período), getSale
    - Criar `api/src/routes/sale.routes.ts` com endpoints: GET /api/sales, GET /api/sales/:id
    - Implementar filtro por intervalo de datas (inclusive)
    - _Requisitos: 5.2, 5.5_

  - [ ]* 8.4 Escrever teste de propriedade para métricas do dashboard
    - **Propriedade 7: Métricas do dashboard são agregações corretas**
    - **Valida: Requisitos 5.3**

  - [ ]* 8.5 Escrever teste de propriedade para filtro de período
    - **Propriedade 8: Filtro de período retorna apenas vendas dentro do intervalo**
    - **Valida: Requisitos 5.5**

  - [x] 8.6 Implementar dashboard no frontend
    - Criar `frontend/src/pages/DashboardPage.tsx` com métricas consolidadas
    - Criar `frontend/src/components/MetricCard.tsx` para exibir cada métrica
    - Criar `frontend/src/components/SalesTable.tsx` com lista de vendas recentes
    - Criar `frontend/src/components/DateRangeFilter.tsx` para filtro de período
    - Implementar hook `frontend/src/hooks/usePolling.ts` (polling a cada 60s, pausa com Page Visibility API)
    - _Requisitos: 5.2, 5.3, 5.4, 5.5_

- [x] 9. Implementar importação de vendas históricas
  - [x] 9.1 Implementar importação em lotes no amazon.service.ts
    - Adicionar método `importHistoricalSales` ao amazon.service.ts
    - Implementar importação em lotes de 30 dias via Orders API com paginação
    - Criar/atualizar SyncJob com progresso (0-100%)
    - Tratar falhas parciais: marcar como PARTIAL, registrar períodos com falha
    - Calcular métricas financeiras para cada venda importada
    - _Requisitos: 6.1, 6.4, 6.5_

  - [x] 9.2 Criar endpoints de importação histórica e progresso
    - Implementar POST /api/integration/sync/sales para disparar importação
    - Implementar GET /api/integration/sync/progress para consultar progresso
    - Iniciar importação automaticamente após primeira integração bem-sucedida
    - _Requisitos: 6.1, 6.2, 6.3_

  - [x] 9.3 Implementar feedback de importação no frontend
    - Atualizar `IntegrationPage.tsx` com barra de progresso para vendas históricas
    - Exibir notificação ao concluir importação com total de vendas importadas
    - Exibir opção de retentar períodos com falha
    - _Requisitos: 6.2, 6.3, 6.4_

- [x] 10. Integração final e navegação
  - [x] 10.1 Implementar layout, sidebar e roteamento
    - Criar `frontend/src/components/Layout.tsx` com sidebar de navegação
    - Criar `frontend/src/components/Sidebar.tsx` com links para todas as páginas
    - Configurar React Router com fluxo: verificar loja → setup ou dashboard
    - Criar `frontend/src/hooks/useStore.ts` para verificar existência da loja
    - Criar `frontend/src/hooks/useApi.ts` como wrapper para chamadas HTTP
    - _Requisitos: 1.5, 7.5_

  - [x] 10.2 Criar página de histórico de vendas
    - Criar `frontend/src/pages/SalesHistoryPage.tsx` com tabela paginada
    - Reutilizar `SalesTable` e `DateRangeFilter`
    - Exibir detalhes por venda: data, produto, quantidade, preço, custo, impostos, taxas, lucro
    - _Requisitos: 5.2, 6.5_

  - [x] 10.3 Registrar todas as rotas no server.ts e finalizar wiring
    - Importar e registrar todos os route files no Express
    - Inicializar cron job de sincronização no startup
    - Garantir que Prisma Client é inicializado corretamente
    - Testar docker-compose up com todos os serviços funcionando
    - _Requisitos: 7.4, 7.6_

- [x] 11. Checkpoint final - Validação completa
  - Garantir que todos os testes passam, docker-compose sobe todos os serviços, fluxo completo funciona (setup → integração → dashboard). Perguntar ao usuário se há dúvidas.

## Notas

- Tarefas marcadas com `*` são opcionais e podem ser puladas para um MVP mais rápido
- Cada tarefa referencia requisitos específicos para rastreabilidade
- Checkpoints garantem validação incremental
- Testes de propriedade validam propriedades universais de corretude
- Testes unitários validam exemplos específicos e edge cases
- A linguagem de implementação é TypeScript tanto no backend quanto no frontend
