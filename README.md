# PDP Feature Monitor

Automação para monitorar features e seções das páginas de produto (PDP) dos sites Natura e Avon em múltiplos países.

## Operações Monitoradas

| Marca | País | Tipo |
|-------|------|------|
| Natura | BR, AR, CL, CO, MX, PE | E-commerce |
| Natura | BR | Social Commerce (Minha Loja) |
| Avon | BR | E-commerce + Social Commerce |
| Avon | AR, MX | E-commerce |

## Features Verificadas

| Feature | Descrição |
|---------|-----------|
| Reviews | Seção de avaliações (filtros, fotos, ordenação) |
| AI Review Summary | Resumo gerado por IA das avaliações |
| Rating | Estrelas/nota do produto |
| Rating Consistency | Validação de consistência entre rating e reviews |
| Imagens | Carrossel/galeria de imagens |
<!-- | Preço e desconto | Informação de preço e promoções |
| Simulação de frete | Campo de CEP e cálculo de entrega | -->
| Adicionar ao carrinho | Botão de compra |
| Favoritar | Botão de favoritar produto |
| Variações | Seletor de variações do produto |
| Vitrines | Carrosseis "Mais da marca" e "Recomendações" |
| Shop the Set | Compre junto / kit |
| Banners de conteúdo | Banners informativos na PDP |
| i18n | Verificação de internacionalização |

## Execução Local

```bash
# Instalar dependências
npm install

# Instalar browsers do Playwright
npx playwright install chromium firefox --with-deps

# Rodar todas as verificações
npm run check

# Rodar com browser visível (para debug)
npm run check:headed

# Rodar em modo smoke (rápido, menos SKUs)
npm run check:smoke
```

### Filtros por feature ou operação

```bash
# Filtrar features específicas
FEATURES_FILTER="reviews,rating" npm run check

# Filtrar operações específicas
OPERATIONS_FILTER="natura-BR,avon-BR" npm run check
```

## Scripts Utilitários

| Script | Descrição |
|--------|-----------|
| `extract-feature-flags.ts` | Extrai feature flags do Commerce a partir de `__NEXT_DATA__`, React Fiber, globals e RSC payloads |
| `capture-remote-config.ts` | Intercepta requests do Firebase Remote Config e salva configurações em JSON |

## Dashboard (React/Next.js)

O projeto inclui um dashboard interativo em `dashboard/` construído com Next.js 15, React 19, Tailwind CSS e Radix UI.

```bash
cd dashboard
npm install
npm run dev    # Desenvolvimento local
npm run build  # Build para produção
```

O dashboard exibe os relatórios gerados e é publicado automaticamente no GitHub Pages.

## GitHub Actions

O projeto possui dois workflows independentes:

### `pdp-check.yml` — PDP Feature Monitor

Executa as verificações das PDPs e publica os relatórios.

- **Schedule:** diariamente às 8:00 UTC (5:00 BRT)
- **Manual:** Actions → PDP Feature Monitor → Run workflow
- **Filtros:** permite filtrar features e operações no trigger manual

### `deploy-dashboard.yml` — Deploy Dashboard

Faz build e deploy do dashboard React no GitHub Pages.

- **Manual:** Actions → Deploy Dashboard → Run workflow
- **Automático:** roda após o PDP Feature Monitor completar

### Secrets necessários

Configurar em Settings → Secrets and variables → Actions:

| Secret | Descrição |
|--------|-----------|
| `SMTP_SERVER` | Servidor SMTP (ex: smtp.gmail.com) |
| `SMTP_PORT` | Porta SMTP (ex: 587) |
| `SMTP_USERNAME` | Usuário SMTP |
| `SMTP_PASSWORD` | Senha SMTP / App Password |
| `ALERT_EMAIL_TO` | E-mail(s) para receber alertas |
| `ALERT_EMAIL_FROM` | E-mail remetente |

## Estrutura do Projeto

```
├── src/
│   ├── index.ts              # Orquestrador principal
│   ├── browserSetup.ts       # Configuração do Playwright
│   ├── concurrency.ts        # Controle de paralelismo
│   ├── reporter.ts           # Gerador de relatórios HTML/JSON
│   ├── types.ts              # Tipos TypeScript
│   ├── utils.ts              # Utilitários
│   ├── checks/               # Módulos de verificação
│   │   ├── configs/          # Configurações por operação
│   │   ├── reviews.ts
│   │   ├── aiReviewSummary.ts
│   │   ├── rating.ts
│   │   ├── ratingConsistency.ts
│   │   ├── media.ts
│   │   ├── pricing.ts
│   │   ├── shipping.ts
│   │   ├── addToCart.ts
│   │   ├── favoriteButton.ts
│   │   ├── productVariations.ts
│   │   ├── showcases.ts
│   │   ├── shopTheSet.ts
│   │   ├── contentBanners.ts
│   │   ├── i18n.ts
│   │   └── remoteConfig.ts
│   └── tests/                # Testes unitários
├── dashboard/                # Dashboard React (Next.js)
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   └── lib/
│   └── package.json
├── docs/                     # GitHub Pages (relatórios publicados)
│   └── reports/
├── reports/                  # Relatórios locais
├── .github/workflows/
│   ├── pdp-check.yml         # Workflow de monitoramento
│   └── deploy-dashboard.yml  # Workflow do dashboard
├── extract-feature-flags.ts  # Extrator de feature flags
├── capture-remote-config.ts  # Captura de Remote Config
├── playwright.config.ts
└── package.json
```

## Relatórios

Após cada execução, um relatório é gerado em `docs/reports/run_<timestamp>/`:

- `report.html` — Relatório visual completo
- `report.json` — Dados estruturados
- `screenshots/` — Capturas de tela (fullpage, falhas, evidências)

O relatório inclui:
- Resumo geral (passou/falhou/erros) por operação
- Status de cada feature por SKU
- Screenshots de evidência
- Links diretos para as PDPs

## Trigger Manual com Filtros

No GitHub Actions → PDP Feature Monitor → Run workflow:

- **Features filter:** lista separada por vírgula (ex: `reviews,rating,media`)
- **Operations filter:** lista separada por vírgula (ex: `natura-BR,avon-BR`)
- **Send email always:** envia e-mail mesmo quando tudo passa

Opção `send_email_always`: envia e-mail mesmo que todas as verificações passem (útil para testes).
