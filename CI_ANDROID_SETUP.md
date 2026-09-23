# Configuração de CI (GitHub Actions + GitHub Pages) — Web + Android

Guia passo a passo para configurar as variáveis/segredos necessários após a inclusão do
check Android no workflow [.github/workflows/pdp-check.yml](.github/workflows/pdp-check.yml).

## 1. Onde cadastrar cada tipo de valor

O GitHub separa dois tipos de configuração por repositório, ambos em
**Settings → Secrets and variables → Actions**:

- **Secrets** (aba "Secrets"): valores sensíveis (senhas, tokens, chaves privadas). Nunca
  aparecem nos logs do workflow.
- **Variables** (aba "Variables"): valores não sensíveis (flags, listas, nomes de provider).
  Aparecem em texto puro nos logs se ecoados — não usar para credenciais.

O job `monitor` do workflow roda sob o *environment* `github-pages`
(`environment: name: github-pages`). Secrets/variables cadastrados no nível do **repositório**
já ficam disponíveis para esse job automaticamente. Só é necessário usar
**Settings → Environments → github-pages → Add secret/variable** se você quiser um valor
diferente por ambiente (não é o caso aqui) ou se a organização exigir "environment secrets"
por política. Para este projeto, cadastre tudo no nível do repositório.

## 2. Acessando a tela de configuração

1. Abra o repositório no GitHub.
2. Vá em **Settings** (aba do topo do repositório, não a do seu perfil).
3. No menu lateral esquerdo, clique em **Secrets and variables → Actions**.
4. Você verá duas abas: **Secrets** e **Variables**. Use "New repository secret" / "New
   repository variable" conforme a lista abaixo.

## 3. Secrets a cadastrar

### 3.1 Já existentes (Web) — confirme que continuam configurados
| Secret | Descrição |
|---|---|
| `FIREBASE_PROJECT_ID` | Projeto Firebase (Admin SDK) usado para ler SKUs do Firestore |
| `FIREBASE_CLIENT_EMAIL` | E-mail da service account do Firebase Admin |
| `FIREBASE_PRIVATE_KEY` | Chave privada da service account (cole com as quebras de linha `\n` literais) |
| `SMTP_SERVER`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` | Envio de e-mail de alerta |
| `ALERT_EMAIL_TO`, `ALERT_EMAIL_FROM` | Destinatário/remetente do e-mail de alerta |
| `NEXT_PUBLIC_FIREBASE_*` (6 vars) | Config do Firebase client-side usada pelo dashboard (`deploy-dashboard.yml`) |

### 3.2 Novos (Android) — device farm
Escolha **um** provider (`lambdatest` é o default do workflow) e cadastre só o conjunto
correspondente:

| Secret | Quando usar | Onde obter |
|---|---|---|
| `LAMBDATEST_USERNAME` | `DEVICE_FARM_PROVIDER=lambdatest` | LambdaTest → Profile → Access Key |
| `LAMBDATEST_ACCESS_KEY` | idem | idem |
| `LAMBDATEST_APP_ID` | idem | ID `lt://...` retornado ao subir o APK/AAB em [App Automate](https://appautomate.lambdatest.com) ou [App Live](https://applive.lambdatest.com/app) |
| `BROWSERSTACK_USERNAME` | `DEVICE_FARM_PROVIDER=browserstack` | BrowserStack → Account Settings |
| `BROWSERSTACK_ACCESS_KEY` | idem | idem |
| `BROWSERSTACK_APP_ID` | idem | ID `bs://...` retornado ao subir o APK/AAB via [App Automate](https://www.browserstack.com/docs/app-automate) |

### 3.3 Novos (Android) — Firebase Remote Config do app mobile
**Atenção:** este é um projeto Firebase **diferente** do usado pelo Web (`FIREBASE_PROJECT_ID`
acima é do Firestore de relatórios/SKUs; estes abaixo são do app Android em si).

| Secret | Descrição | Onde obter |
|---|---|---|
| `ANDROID_FIREBASE_PROJECT_ID` | `project_id` | `google-services.json` do app (procure o `client[]` do package correto) |
| `ANDROID_FIREBASE_PROJECT_NUMBER` | `project_number` | idem |
| `ANDROID_FIREBASE_API_KEY` | `api_key.current_key` | idem |
| `ANDROID_FIREBASE_APP_ID` | `mobilesdk_app_id` | idem |
| `ANDROID_FIREBASE_PACKAGE_NAME` | `package_name` (ex.: `net.natura.semprepresente`) | idem |
| `ANDROID_FIREBASE_APPS_JSON` | *(opcional)* alternativa multi-app em JSON, tem prioridade sobre as 5 vars acima | montado manualmente — ver formato em [.env.example](.env.example) |

> Essas 4 primeiras identificações (project id/number, api key, app id) são identificadores
> públicos de cliente, já embutidos em todo APK — não são segredo de autenticação, mas ainda
> assim cadastre como *secret* por conveniência/consistência com o restante da config.

### 3.4 Novos (Android) — login (opcional)
| Secret | Descrição |
|---|---|
| `ANDROID_LOGIN_EMAIL` | Conta de teste usada para logar no app antes de checar as PDPs |
| `ANDROID_LOGIN_PASSWORD` | Senha da conta de teste |

Se não configurados, o check roda com sessão anônima (sem login) — não quebra o workflow.

## 4. Variables a cadastrar (não sensíveis)

Na aba **Variables** (mesma tela):

| Variable | Default se ausente | Descrição |
|---|---|---|
| `DEVICE_FARM_PROVIDER` | `lambdatest` | `"lambdatest"` ou `"browserstack"` |
| `ANDROID_SKUS` | *(vazio → todos os SKUs Natura/BR/ecommerce)* | Lista separada por vírgula, ex.: `NATBRA-70983,NATBRA-76420` |
| `ANDROID_CONCURRENCY` | `2` | Sessões de device em paralelo (máx. 5) |

## 5. Configuração do GitHub Pages

O deploy já está configurado via Actions (não via branch `gh-pages`). Confirme em
**Settings → Pages**:

1. **Source**: deve estar em **"GitHub Actions"** (não "Deploy from a branch"). Se estiver
   como branch, troque para "GitHub Actions" — os workflows já usam
   `actions/upload-pages-artifact` + `actions/deploy-pages`, que só funcionam com essa opção.
2. Nenhuma outra configuração de Pages precisa mudar por causa do Android: o
   `deploy-dashboard.yml` já copia todo `docs/reports/*` (web e android) para o build do
   dashboard, e o `pdp-check.yml` publica `docs/` inteiro (`git add -f docs/`), então os
   relatórios Android aparecem automaticamente assim que a pasta `docs/reports/run_android_*`
   existir.
3. Os relatórios Android ficam acessíveis pela rota `/android` do dashboard (ver
   `dashboard/src/app/android/page.tsx`).

## 6. Validando

1. Cadastre pelo menos as secrets/variables da seção 3.2/3.3 (device farm + Firebase Android).
2. Vá em **Actions → PDP Feature Monitor → Run workflow** (trigger manual) para não esperar o
   cron das 8h UTC.
3. Acompanhe os steps **"📱 Run PDP checks (Android)"** e **"📊 Find report directories"** nos
   logs — devem mostrar `android_report_dir` preenchido.
4. Depois do deploy, confira `https://<org>.github.io/<repo>/android` (ou o path configurado)
   para ver o relatório publicado.

## 7. Notas de segurança
- Nunca commitar valores reais de `.env.local`/`.env` — o `.gitignore` já cobre `.env*` e `.tmp/`.
- `ANDROID_FIREBASE_*` são identificadores de cliente (não segredos de autenticação forte), mas
  trate como secret por padrão do repositório.
- Screenshots de debug de falha de login ficam em `.tmp/artifacts/auth/` (gitignored), nunca em
  `docs/` — não expor via Pages.
