# Configuração do Backend - TagOnLink

## Variáveis de Ambiente Necessárias

Configure as seguintes variáveis de ambiente no Vercel:

### 1. DATABASE_URL

```
postgresql://neondb_owner:npg_knHqXh5JgwV0@ep-blue-mud-ac929t5x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

### 2. JWT_SECRET

Gere uma chave secreta forte (exemplo):

```
openssl rand -base64 32
```

Ou use qualquer string aleatória longa e segura.

### 3. PORT (opcional)

Padrão: 3000

## Como Configurar no Vercel

1. Acesse o painel do Vercel
2. Vá em **Settings** → **Environment Variables**
3. Adicione as variáveis:
   - `DATABASE_URL` = (sua connection string do Neon)
   - `JWT_SECRET` = (sua chave secreta)

## Testar Conexão Localmente

1. Crie um arquivo `.env` na pasta `tagonlink-backend`:

```env
DATABASE_URL=postgresql://neondb_owner:npg_knHqXh5JgwV0@ep-blue-mud-ac929t5x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
JWT_SECRET=sua_chave_secreta_aqui
```

2. Execute o teste de conexão:

```bash
npm run test-db
```

## Criar Tabelas no Banco

Execute o script SQL `schema.sql` no painel do Neon:

1. Acesse o Neon Dashboard
2. Vá em **SQL Editor**
3. Cole o conteúdo de `schema.sql`
4. Execute

Ou use o script de teste que verifica se as tabelas existem.

## Verificar se Está Funcionando

Acesse: `https://tagonlink-backend.vercel.app/api/health`

Deve retornar:

```json
{
  "status": "ok",
  "database": "connected",
  "timestamp": "..."
}
```
