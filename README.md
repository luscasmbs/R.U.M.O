# R.U.M.O

Rede Unificada de Monitoramento de Ocorrências para Recife/PE.

## Visão do produto

O R.U.M.O é uma plataforma de inteligência territorial baseada em dados públicos. Ela consolida ocorrências epidemiológicas, território, clima e monitoramento hídrico para apoiar prevenção, planejamento e resposta do poder público.

## O que foi implementado

- Frontend React + Vite com React Router, Axios, React Query, Leaflet e Recharts.
- Dashboard com KPIs, filtros, séries temporais, composição de ocorrências, mapa com camadas, ranking territorial e alertas acionáveis.
- Página de previsões com score, probabilidade, confiança, fatores contribuintes, métricas AUC/precisão/recall/F1 e histórico.
- Backend FastAPI com JWT, RBAC, CORS, rate limiting, healthcheck e tratamento global de erros.
- PostgreSQL + PostGIS via Docker Compose e migrações Alembic.
- Conectores para Portal de Dados Abertos do Recife, INMET, APAC e IBGE, além do contrato de integração preparado para DATASUS.
- Pipeline de ML epidemiológico com Random Forest, fallback estatístico por média móvel e explicabilidade persistida.
- Registro de fontes, versionamento de modelo e auditoria de ingestões/treinos.
- Catálogo demonstrativo no frontend usando o mesmo contrato dos dados reais para desenvolvimento sem as APIs disponíveis.

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

## Fluxo inicial

1. Entrar no frontend.
2. Abrir `Operações` e executar a malha IBGE.
3. Executar a carga do Recife CKAN e registrar INMET/APAC/DATASUS.
4. Treinar o modelo epidemiológico.
5. Consultar `Dashboard` e `Previsões`.

## Contrato de dados

O contrato principal usa `contract_version`, `filters`, `metrics`, `geojson`, `top_neighborhoods`, `time_series`, `category_breakdown`, `model` e `alerts`. O frontend sinaliza quando está no modo demonstração; os dados demonstrativos não são apresentados como dados oficiais.

DATASUS possui um adaptador pronto para o esquema de notificações, mas a carga produtiva depende do dataset epidemiológico oficial escolhido (TabNet, arquivo ou fluxo institucional). APAC permanece em monitoramento de links oficiais enquanto não houver endpoint JSON público estável.

## Limitações conhecidas

O desempenho depende da qualidade, periodicidade e granularidade das fontes públicas. Subnotificação e atraso de atualização podem afetar o risco estimado. Alagamentos, deslizamentos e segurança já têm módulos na arquitetura e na interface, mas ainda dependem de bases territoriais públicas suficientes ou de convênio institucional para previsão operacional.
