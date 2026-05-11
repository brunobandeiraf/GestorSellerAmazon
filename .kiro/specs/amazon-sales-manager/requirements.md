# Documento de Requisitos

## Introdução

Sistema de gerenciamento de vendas para vendedores da Amazon Brasil. O objetivo é fornecer controle detalhado de margem de lucro, ROI e histórico de vendas em tempo real. O projeto será desenvolvido como MVP em fases incrementais, utilizando Node.js, Express, Prisma, React, Docker e PostgreSQL.

## Glossário

- **Sistema**: Aplicação web de gerenciamento de vendas Amazon Brasil
- **Vendedor**: Usuário proprietário da loja que utiliza o sistema para controlar vendas e margens
- **Loja**: Entidade que representa a conta do vendedor na Amazon Brasil, contendo configurações fiscais
- **Produto**: Item cadastrado na Amazon Brasil vinculado à loja do vendedor
- **Venda**: Transação de venda realizada na Amazon Brasil
- **Preço_de_Compra**: Custo de aquisição do produto pelo vendedor
- **Margem**: Diferença percentual entre o preço de venda e o custo total (compra + impostos + taxas)
- **ROI**: Retorno sobre investimento, calculado como (lucro líquido / custo total) × 100
- **Integração_Amazon**: Conexão via API com a Amazon SP-API para sincronização de dados
- **Imposto**: Configuração tributária aplicada às vendas (ex: Simples Nacional, MEI, Lucro Presumido)
- **Dashboard**: Painel principal do sistema que exibe métricas de vendas em tempo real

## Requisitos

### Requisito 1: Cadastro de Loja

**User Story:** Como vendedor, eu quero cadastrar minha loja no sistema, para que eu possa configurar minha conta e começar a gerenciar minhas vendas.

#### Critérios de Aceitação

1. WHEN o Vendedor submete o formulário de cadastro com nome da loja, THE Sistema SHALL criar a Loja e armazenar os dados no banco de dados
2. WHEN o Vendedor acessa a página de cadastro, THE Sistema SHALL exibir um formulário com os campos: nome da loja, CNPJ e regime tributário
3. IF o Vendedor submete o formulário com campos obrigatórios vazios, THEN THE Sistema SHALL exibir mensagens de validação indicando os campos pendentes
4. IF o Vendedor submete um CNPJ com formato inválido, THEN THE Sistema SHALL exibir uma mensagem de erro informando o formato correto
5. WHEN a Loja é criada com sucesso, THE Sistema SHALL redirecionar o Vendedor para a página de configuração de impostos

### Requisito 2: Configuração de Impostos

**User Story:** Como vendedor, eu quero configurar os impostos aplicáveis às minhas vendas, para que o sistema calcule corretamente minha margem de lucro.

#### Critérios de Aceitação

1. WHEN o Vendedor acessa a configuração de impostos, THE Sistema SHALL exibir as opções de regime tributário: MEI, Simples Nacional e Lucro Presumido
2. WHEN o Vendedor seleciona um regime tributário, THE Sistema SHALL exibir os campos de alíquota correspondentes ao regime selecionado
3. WHEN o Vendedor salva a configuração de impostos, THE Sistema SHALL armazenar as alíquotas vinculadas à Loja
4. IF o Vendedor informa uma alíquota com valor negativo ou acima de 100%, THEN THE Sistema SHALL exibir uma mensagem de erro informando o intervalo válido (0% a 100%)
5. THE Sistema SHALL permitir que o Vendedor atualize a configuração de impostos a qualquer momento

### Requisito 3: Integração com Amazon - Produtos

**User Story:** Como vendedor, eu quero integrar minha conta Amazon ao sistema, para que todos os meus produtos cadastrados sejam importados automaticamente.

#### Critérios de Aceitação

1. WHEN o Vendedor inicia a integração com a Amazon, THE Sistema SHALL solicitar as credenciais de acesso à Amazon SP-API
2. WHEN as credenciais são validadas com sucesso, THE Sistema SHALL buscar todos os produtos cadastrados na conta do Vendedor via Integração_Amazon
3. WHEN os produtos são importados, THE Sistema SHALL armazenar para cada produto: SKU, título, ASIN, preço de venda atual e status
4. WHEN os produtos são importados, THE Sistema SHALL buscar e armazenar as imagens associadas a cada produto
5. IF a conexão com a Amazon SP-API falha, THEN THE Sistema SHALL exibir uma mensagem de erro com detalhes da falha e opção de tentar novamente
6. IF as credenciais fornecidas são inválidas, THEN THE Sistema SHALL informar o Vendedor que as credenciais estão incorretas

### Requisito 4: Cadastro de Preço de Compra

**User Story:** Como vendedor, eu quero informar o preço de compra de cada produto, para que o sistema calcule automaticamente meu lucro e margem.

#### Critérios de Aceitação

1. WHEN o Vendedor acessa a lista de produtos, THE Sistema SHALL exibir todos os produtos importados com campo editável para Preço_de_Compra
2. WHEN o Vendedor informa o Preço_de_Compra de um produto, THE Sistema SHALL calcular e exibir a Margem e o ROI estimados
3. WHEN o Vendedor salva o Preço_de_Compra, THE Sistema SHALL armazenar o valor vinculado ao produto
4. IF o Vendedor informa um Preço_de_Compra com valor negativo, THEN THE Sistema SHALL exibir uma mensagem de erro informando que o valor deve ser positivo
5. THE Sistema SHALL calcular a Margem utilizando a fórmula: ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_venda) × 100
6. THE Sistema SHALL calcular o ROI utilizando a fórmula: ((preço_venda - preço_compra - impostos - taxas_amazon) / preço_compra) × 100

### Requisito 5: Visualização de Vendas em Tempo Real

**User Story:** Como vendedor, eu quero visualizar minhas vendas em tempo real, para que eu possa acompanhar o desempenho da minha loja instantaneamente.

#### Critérios de Aceitação

1. WHEN uma nova Venda é registrada na Amazon, THE Sistema SHALL exibir a venda no Dashboard em até 5 minutos
2. THE Dashboard SHALL exibir para cada venda: data, produto, quantidade, preço de venda, custo, impostos, taxas e lucro líquido
3. THE Dashboard SHALL exibir métricas consolidadas: total de vendas do dia, margem média, ROI médio e faturamento total
4. WHILE o Vendedor está visualizando o Dashboard, THE Sistema SHALL atualizar os dados automaticamente sem necessidade de recarregar a página
5. WHEN o Vendedor aplica um filtro de período, THE Sistema SHALL exibir apenas as vendas dentro do intervalo selecionado

### Requisito 6: Importação de Vendas Históricas

**User Story:** Como vendedor, eu quero importar todas as minhas vendas passadas da Amazon, para que eu tenha um histórico completo desde o início das operações.

#### Critérios de Aceitação

1. WHEN a primeira Integração_Amazon é concluída com sucesso, THE Sistema SHALL iniciar automaticamente a importação de todas as vendas históricas
2. WHILE a importação de vendas históricas está em andamento, THE Sistema SHALL exibir uma barra de progresso indicando o percentual concluído
3. WHEN a importação de vendas históricas é concluída, THE Sistema SHALL notificar o Vendedor e exibir o total de vendas importadas
4. IF a importação de vendas históricas falha parcialmente, THEN THE Sistema SHALL informar quais períodos falharam e oferecer opção de retentar apenas os períodos pendentes
5. THE Sistema SHALL armazenar para cada venda histórica: data, produto, quantidade, preço de venda, taxas da Amazon e status do pedido

### Requisito 7: Infraestrutura e Stack Tecnológica

**User Story:** Como vendedor, eu quero que o sistema seja fácil de instalar e executar localmente, para que eu possa utilizá-lo sem configurações complexas.

#### Critérios de Aceitação

1. THE Sistema SHALL utilizar Docker e Docker Compose para orquestrar todos os serviços (API, banco de dados, frontend)
2. THE Sistema SHALL utilizar PostgreSQL como banco de dados relacional
3. THE Sistema SHALL utilizar Prisma como ORM para acesso ao banco de dados
4. THE Sistema SHALL utilizar Node.js com Express para a API backend
5. THE Sistema SHALL utilizar React para a interface do usuário
6. WHEN o Vendedor executa o comando `docker-compose up`, THE Sistema SHALL inicializar todos os serviços e estar disponível para uso
7. THE Sistema SHALL expor a API na porta 3001 e o frontend na porta 3000
