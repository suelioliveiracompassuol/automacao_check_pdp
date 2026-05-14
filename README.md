# PDP Feature Monitor

Automação para monitorar features/seções das páginas de produto (PDP) do site Natura/Avon.

## Features Monitoradas

| Feature | Descrição |
|---------|-----------|
| Avaliações | Seção de reviews (apenas Natura) |
| Vitrine "Mais produtos da marca" | Carrossel de produtos da mesma marca |
| Vitrine "Achamos que você vai gostar" | Carrossel de recomendações |
| Imagens | Carrossel/galeria de imagens |
| Preço e desconto | Informação de preço |
| Simulação de frete | Campo de CEP |
| Nota/Rating | Estrelas/avaliação |

## Execução Local

```bash
# Instalar dependências
npm install

# Instalar browsers do Playwright
npx playwright install chromium

# Rodar verificações
npm run check

# Rodar com browser visível (para debug)
npm run check:headed
```

## Configuração

### SKUs Monitorados

Edite `src/config.ts` para adicionar/remover SKUs:

```typescript
export const SKUS: SkuConfig[] = [
  {
    sku: 'NATBRA-169786',
    name: 'Kaiak Ultra Masculino 100ml',
    vendor: 'natura',
    country: 'BR',
    expectedFeatures: ['olfactiveNotes', 'usageTips'], // features específicas esperadas
  },
  // ...
];
```

### GitHub Actions

O workflow roda automaticamente às 5h (BRT) todos os dias.

**Secrets necessários** (configurar em Settings → Secrets):

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
│   ├── config.ts       # SKUs, domínios, seletores
│   ├── index.ts        # Orquestrador principal
│   ├── reporter.ts     # Gerador de relatórios
│   ├── types.ts        # Tipos TypeScript
│   └── checks/         # Módulos de verificação
│       ├── reviews.ts
│       ├── showcases.ts
│       ├── media.ts
│       ├── pricing.ts
│       ├── shipping.ts
│       └── rating.ts
├── reports/            # Relatórios gerados (gitignore)
├── playwright.config.ts
└── package.json
```

## Relatórios

Após cada execução, um relatório HTML é gerado em `reports/run_<timestamp>/report.html`.

O relatório inclui:
- Resumo geral (passou/falhou/erros)
- Status de cada feature por SKU
- Screenshots de falhas
- Links para as PDPs

## Trigger Manual

No GitHub Actions, vá em Actions → PDP Feature Monitor → Run workflow.

Opção `send_email_always`: envia e-mail mesmo que todas as verificações passem (útil para testes).
