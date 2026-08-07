# Publicação gratuita do R.U.M.O

Arquitetura indicada para demonstração e TCC:

- **Frontend:** Render Static Site.
- **Backend:** Render Web Service gratuito.
- **Banco:** Neon PostgreSQL gratuito com PostGIS.

O arquivo `render.yaml` já descreve o frontend e o backend. O plano gratuito é adequado para demonstração, mas o backend pode adormecer após um período sem acesso e levar alguns segundos para responder na primeira chamada.

## 1. Criar o banco no Neon

1. Crie um projeto gratuito no Neon.
2. No SQL Editor, execute `CREATE EXTENSION IF NOT EXISTS postgis;`.
3. Copie a connection string e altere o início de `postgresql://` para `postgresql+psycopg://`.
4. Mantenha `sslmode=require` no final da URL.

Exemplo de formato:

```text
postgresql+psycopg://usuario:senha@host/neondb?sslmode=require
```

## 2. Criar os serviços no Render

1. Envie o repositório para o GitHub.
2. No Render, escolha **New > Blueprint** e selecione o repositório.
3. O Render encontrará o `render.yaml` e pedirá os valores secretos.

Variáveis do serviço `rumo-api`:

```text
DATABASE_URL=<URL do Neon no formato acima>
CORS_ORIGINS=["https://rumo-web.onrender.com"]
ADMIN_EMAIL=<email válido do administrador>
ADMIN_PASSWORD=<senha forte com pelo menos 12 caracteres>
```

Variável do serviço `rumo-web`:

```text
VITE_API_URL=https://rumo-api.onrender.com/api/v1
```

Se o Render alterar o nome de algum serviço, use os endereços que ele fornecer. Depois de mudar `VITE_API_URL`, faça um novo deploy do frontend. Depois de mudar `CORS_ORIGINS`, reinicie o backend.

## 3. Primeira inicialização

Na primeira subida, o comando do backend executa automaticamente:

1. Migrações Alembic.
2. Criação idempotente do administrador.
3. Inicialização do FastAPI.

Verifique:

```text
https://rumo-api.onrender.com/api/v1/health
https://rumo-web.onrender.com/dashboard
```

O redirecionamento de SPA está configurado no Blueprint. Por isso, atualizar diretamente `/dashboard` não deve gerar página 404. O `index.html` também é servido sem cache persistente, enquanto os arquivos versionados de CSS e JavaScript podem usar cache longo.

## Limites importantes

- O Render gratuito pode suspender a API por inatividade, causando uma primeira resposta mais lenta.
- O armazenamento local do backend é efêmero. As previsões e metadados importantes devem ficar no PostgreSQL; arquivos de modelo que precisem sobreviver a novos deploys exigem armazenamento externo.
- A senha e a chave secreta nunca devem ser gravadas no repositório.
- Para uso institucional contínuo, é necessário um plano com disponibilidade, backups e monitoramento compatíveis com o órgão público.
