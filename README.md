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
| Card de cupons | Card "economize com cupons" (só com `enable_coupons_pdp` ativa e `couponCenter` não desligado) |
| Módulo de presente | Acordeão "esse pedido é para presente?" com opções de entrega (só com `gift_module_pdp.enabled` e ao menos uma opção web em `enable_module_gift_cart`) |
| i18n | Verificação de internacionalização |

Features desligadas via Firebase Remote Config ou Commerce feature flag aparecem como **desabilitadas** (não contam como falha). Cupons e módulo de presente só existem atrás de flag: se a flag não for capturada no Remote Config, a verificação fica **N/A**.

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

### Execução Local (Android)

Monitora o app nativo Android via WebdriverIO + Appium, em um device farm (LambdaTest App
Automate por padrão, ou BrowserStack/local via `DEVICE_FARM_PROVIDER`). Veja `.env.example` para
a lista completa de variáveis (device farm, concorrência, filtro de SKUs, login, Remote Config).

```bash
# Rodar todas as verificações Android (SKUs Natura/BR/ecommerce por padrão)
npm run check:android

# Filtrar SKUs específicos
ANDROID_SKUS="NATBRA-70983,NATBRA-76420" npm run check:android

# Controlar quantas sessões de device rodam em paralelo (default 2, teto 5)
ANDROID_CONCURRENCY=3 npm run check:android
```

## Scripts Utilitários

| Script | Descrição |
|--------|-----------|
| `extract-feature-flags.ts` | Extrai feature flags do Commerce a partir de `__NEXT_DATA__`, React Fiber, globals e RSC payloads |
| `capture-remote-config.ts` | Intercepta requests do Firebase Remote Config e salva configurações em JSON |

### Imagens de referência das features

O dashboard mostra, ao lado de cada feature da Web, uma imagem de referência do elemento que a checagem procura. As imagens ficam em `dashboard/public/feature-refs/<grupo>/<featureKey>.png`, com um grupo por operação: `natura-br`, `natura-ar`, `natura-latam` (CO/CL/PE/MX, capturado da Colômbia), `avon-br`, `avon-ar`, `avon-mx`, `minha-loja-natura` e `minha-loja-avon`.

```bash
# Captura as imagens que faltam (abre 1 SKU por grupo)
npm run refs:capture

# Só alguns grupos / SKUs, substituindo as imagens existentes
REFS_GROUPS="natura-br,minha-loja-avon" REFS_OVERWRITE=true npm run refs:capture
SKU_FILTER="NATBRA-108403" npm run refs:capture
```

| Variável | Descrição |
|----------|-----------|
| `REFS_GROUPS` | Grupos a capturar (padrão: todos) |
| `SKU_FILTER` | SKUs a usar na captura |
| `REFS_OVERWRITE` | `true` substitui imagens existentes (padrão: mantém, para não sobrescrever prints manuais) |
| `HEADLESS` | `false` abre o browser visível |

Se o WAF bloquear a captura, basta salvar o print manualmente no mesmo caminho. Os alvos de cada feature estão em `src/featureRefs.ts`.

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
│   ├── index.ts              # Orquestrador principal (Web/Playwright)
│   ├── index.android.ts      # Orquestrador Android (WebdriverIO/Appium)
│   ├── deviceSetup.ts        # Criação/encerramento de sessão do device farm
│   ├── androidConcurrency.ts # Chunking de SKUs por sessão / limite de concorrência (Android)
│   ├── reportIndex.ts        # Escrita compartilhada de docs/reports/index.json (Web + Android)
│   ├── browserSetup.ts       # Configuração do Playwright
│   ├── concurrency.ts        # Controle de paralelismo (Web)
│   ├── reporter.ts           # Gerador de relatórios HTML/JSON
│   ├── types.ts              # Tipos TypeScript
│   ├── utils.ts              # Utilitários
│   ├── featureRefs.ts        # Alvos das imagens de referência por feature
│   ├── captureFeatureRefs.ts # Captura das imagens de referência (npm run refs:capture)
│   ├── checks/               # Módulos de verificação (Web)
│   │   ├── configs/          # Configurações por operação
│   │   ├── reviews.ts
│   │   ├── aiReviewSummary.ts
│   │   ├── rating.ts
│   │   ├── ratingConsistency.ts
│   │   ├── media.ts
│   │   ├── addToCart.ts
│   │   ├── favoriteButton.ts
│   │   ├── productVariations.ts
│   │   ├── showcases.ts
│   │   ├── shopTheSet.ts
│   │   ├── contentBanners.ts
│   │   ├── coupons.ts
│   │   ├── giftModule.ts
│   │   ├── i18n.ts
│   │   └── remoteConfig.ts
│   ├── checks-android/       # Módulos de verificação (Android)
│   │   ├── configs/selectors.ts
│   │   ├── login.ts
│   │   ├── addToCart.ts
│   │   ├── showcases.ts
│   │   └── remoteConfig.ts
│   └── tests/                # Testes unitários
├── dashboard/                # Dashboard React (Next.js)
│   ├── public/feature-refs/  # Imagens de referência por grupo de operação
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

Após cada execução, um relatório é gerado em `docs/reports/run_<timestamp>/` (Android: `run_android_<timestamp>/`) e exibido pelo dashboard:

- `report.json` — Dados estruturados
- `screenshots/` — Capturas de tela (fullpage, falhas, evidências)

O dashboard mostra:
- Resumo geral (passou/falhou/erros) por operação
- Status de cada feature por SKU, com imagem de referência (Web)
- Screenshots de evidência
- Links diretos para as PDPs

## Trigger Manual com Filtros

No GitHub Actions → PDP Feature Monitor → Run workflow:

- **Features filter:** lista separada por vírgula (ex: `reviews,rating,media`)
- **Operations filter:** lista separada por vírgula (ex: `natura-BR,avon-BR`)
- **Send email always:** envia e-mail mesmo quando tudo passa

Opção `send_email_always`: envia e-mail mesmo que todas as verificações passem (útil para testes).
