# Amazon Sales Manager

Sistema de gerenciamento de vendas para vendedores da Amazon Brasil. Controle margem de lucro, ROI e acompanhe vendas em tempo real.

## Stack Tecnológica

- **Backend:** Node.js, Express, TypeScript, Prisma
- **Frontend:** React, Vite, TypeScript
- **Banco de Dados:** PostgreSQL 16
- **Infraestrutura:** Docker, Docker Compose

## Pré-requisitos

- [Docker](https://docs.docker.com/get-docker/) e Docker Compose instalados
- [Node.js 20+](https://nodejs.org/) (para desenvolvimento local sem Docker)

## Como Rodar

### Com Docker (recomendado)

```bash
docker-compose up
```

Os serviços estarão disponíveis em:
- **Frontend:** http://localhost:3000
- **API:** http://localhost:3001
- **PostgreSQL:** localhost:5432

### Desenvolvimento Local (sem Docker)

1. Suba o PostgreSQL (ou use o Docker apenas para o banco):

```bash
docker-compose up db
```

2. Instale as dependências:

```bash
cd api && npm install
cd ../frontend && npm install
```

3. Configure o banco de dados:

```bash
cd api
npx prisma migrate dev
npx prisma generate
```

4. Inicie a API:

```bash
cd api
npm run dev
```

5. Inicie o frontend:

```bash
cd frontend
npm run dev
```

## Estrutura do Projeto

```
├── api/                    # Backend (Express + Prisma)
│   ├── src/
│   │   ├── server.ts       # Entry point
│   │   ├── routes/         # Endpoints REST
│   │   ├── services/       # Lógica de negócio
│   │   ├── jobs/           # Cron jobs (sync vendas)
│   │   ├── middleware/     # Error handler
│   │   ├── utils/          # Validadores, erros
│   │   └── types/          # Tipos TypeScript
│   ├── prisma/
│   │   └── schema.prisma   # Modelos do banco
│   ├── tests/              # Testes (Jest + fast-check)
│   └── Dockerfile
├── frontend/               # Frontend (React + Vite)
│   ├── src/
│   │   ├── pages/          # Páginas da aplicação
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── hooks/          # Custom hooks
│   │   ├── services/       # Cliente HTTP
│   │   └── types/          # Tipos TypeScript
│   ├── tests/              # Testes (Vitest)
│   └── Dockerfile
├── docker-compose.yml
└── README.md
```

## Funcionalidades

### 1. Cadastro de Loja
- Registro com nome, CNPJ e regime tributário
- Validação completa de CNPJ (dígitos verificadores)
- Suporte a MEI, Simples Nacional e Lucro Presumido

### 2. Configuração de Impostos
- Alíquotas dinâmicas por regime tributário
- MEI/Simples: alíquota DAS única
- Lucro Presumido: ICMS, PIS, COFINS, IRPJ, CSLL

### 3. Integração Amazon SP-API
- Conexão via credenciais SP-API
- Importação automática de produtos e imagens
- Teste de conexão com feedback visual

### 4. Gestão de Preço de Compra
- Preço de compra editável por produto
- Cálculo automático de margem e ROI
- Fórmulas:
  - Margem = ((venda - compra - impostos - taxas) / venda) × 100
  - ROI = ((venda - compra - impostos - taxas) / compra) × 100

### 5. Dashboard em Tempo Real
- Métricas consolidadas: vendas, faturamento, margem média, ROI médio
- Tabela de vendas recentes
- Filtro por período
- Atualização automática a cada 60 segundos

### 6. Sincronização de Vendas
- Cron job a cada 5 minutos busca novas vendas
- Importação de vendas históricas (último ano) em lotes de 30 dias
- Progresso visual com barra de progresso
- Retry automático para falhas parciais

## API Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| GET | `/api/health` | Health check |
| GET | `/api/store` | Dados da loja |
| POST | `/api/store` | Criar loja |
| PUT | `/api/store` | Atualizar loja |
| GET | `/api/store/tax` | Configuração de impostos |
| PUT | `/api/store/tax` | Salvar impostos |
| GET | `/api/products` | Listar produtos |
| PUT | `/api/products/:id/cost` | Atualizar preço de compra |
| GET | `/api/dashboard` | Métricas do dashboard |
| GET | `/api/sales` | Listar vendas |
| POST | `/api/integration/connect` | Conectar Amazon |
| GET | `/api/integration/status` | Status da integração |
| POST | `/api/integration/sync/products` | Importar produtos |
| POST | `/api/integration/sync/sales` | Importar vendas históricas |
| GET | `/api/integration/sync/progress` | Progresso da importação |

## Testes

```bash
# Backend
cd api
npm test

# Frontend
cd frontend
npm test
```

## Variáveis de Ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `DATABASE_URL` | `postgresql://postgres:postgres@localhost:5432/amazon_sales` | URL do PostgreSQL |
| `PORT` | `3001` | Porta da API |
| `NODE_ENV` | `development` | Ambiente |
| `VITE_API_URL` | `` (vazio, usa proxy) | URL da API para o frontend |

## Licença

Projeto privado - uso pessoal.
