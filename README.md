# R.U.M.O MVP

Rede Unificada de Monitoramento de Ocorrências para Recife/PE.

## O que foi implementado

- Frontend React + Vite com React Router, Axios, React Query, Leaflet e Recharts.
- Backend FastAPI com JWT, RBAC, CORS, rate limiting simples, logs, healthcheck e tratamento global de erros.
- PostgreSQL + PostGIS via Docker Compose.
- SQLAlchemy + Alembic com tabelas: usuários, bairros, ocorrências, previsões, alertas, fontes e logs.
- Conectores reais:
  - Recife CKAN para arboviroses.
  - INMET para estações/dados meteorológicos.
  - APAC com coleta de links oficiais de monitoramento/boletins quando não há API JSON estável.
  - IBGE para malha geográfica oficial de bairros/setores.
- Pipeline inicial de ML real com pandas, scikit-learn e joblib.

## Executar localmente

```bash
cp .env.example .env
docker compose up --build
```

Frontend: http://localhost:5173
Backend: http://localhost:8000/docs

Usuário inicial:

```text
admin@rumo.local
admin123
```

## Fluxo inicial do MVP

1. Entrar no frontend.
2. Abrir `Operações`.
3. Executar ingestão da malha IBGE.
4. Executar ingestão do Recife CKAN.
5. Treinar o modelo epidemiológico.
6. Abrir o dashboard.

## Observações técnicas

O módulo epidemiológico usa dados históricos reais persistidos. Se ainda não houver volume suficiente para treino supervisionado, o sistema usa fallback estatístico baseado em média móvel real e marca isso na explicabilidade da previsão.

Segurança pública, alagamento e deslizamento estão estruturados na arquitetura, mas dependem de granularidade pública suficiente ou convênio institucional para virar previsão territorial com validade operacional.
