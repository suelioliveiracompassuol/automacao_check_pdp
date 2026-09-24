# Configuração de Autenticação para Gerenciamento de SKUs

## Visão Geral

A página de Gerenciar SKUs agora possui um sistema de autenticação baseado em **Firebase Authentication** para restringir o acesso apenas aos membros autorizados da squad.

## Como Funciona

1. **Usuário não autenticado**:
   - A página de SKUs é visível normalmente
   - O botão "Novo SKU" fica desabilitado
   - Os botões de edição e exclusão nos cards ficam desabilitados
   - Aparece uma mensagem informativa: "Você precisa estar logado para gerenciar SKUs. Entre em contato com o administrador para obter as credenciais de acesso."
   - Um formulário de login é exibido no topo da página

2. **Usuário autenticado**:
   - Todos os botões de ação funcionam normalmente
   - Exibe o email do usuário logado com badge "Autenticado"
   - Botão de logout disponível

## Configurar Autenticação no Firebase

### 1. Habilitar Firebase Authentication

1. Acesse [Firebase Console](https://console.firebase.google.com/)
2. Selecione seu projeto (provavelmente "pdp-monitor" ou similar)
3. No menu esquerdo, vá para **Authentication**
4. Clique na aba **Sign-in method**
5. Habilite **Email/Password**:
   - Clique em "Email/Password"
   - Ative a opção "Email/Password"
   - Clique **Save**

### 2. Criar Usuários

Na aba **Users**:

1. Clique em **Add user**
2. Preencha:
   - **Email**: `usuario@nature.com` (ou qualquer email da squad)
   - **Password**: Defina uma senha forte (será enviada ao usuário)
3. Clique **Create user**
4. Repita para cada membro da squad

### 3. Variáveis de Ambiente

Certifique-se que o arquivo `.env.local` contém as variáveis necessárias (estas já devem estar presentes):

```env
NEXT_PUBLIC_FIREBASE_API_KEY=xxx
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=xxx.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=xxx
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=xxx
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=xxx
NEXT_PUBLIC_FIREBASE_APP_ID=xxx
```

## Funcionalidades Implementadas

### Componentes Novos

1. **`AuthContext`** (`src/components/auth-context.tsx`)
   - Gerencia estado de autenticação
   - Fornece hooks `useAuth()` para acessar user, login, logout, error

2. **`AuthLogin`** (`src/components/auth-login.tsx`)
   - Componente de UI para login/logout
   - Exibe formulário de email/senha
   - Mostra email do usuário logado com status

3. **`AuthGuard`** (`src/components/auth-guard.tsx`)
   - Componente para proteger seções da UI
   - Exibe mensagem quando usuário não está autenticado
   - Componente `AuthDisabledButton` para desabilitar botões

### Modificações Existentes

1. **`SkusClient`** (`src/app/skus/skus-client.tsx`)
   - Agora verifica autenticação
   - Desabilita botão "Novo SKU" quando não logado
   - Passa status de autenticação para `SkuList`

2. **`SkuList`** e **`SkuCard`**
   - Aceitam prop `disabled` para controlar estado dos botões
   - Mostram tooltip "Faça login para usar este recurso" quando desabilitado

3. **Página de SKUs** (`src/app/skus/page.tsx`)
   - Envolve `SkusClient` com `AuthProvider`
   - Exibe componente `AuthLogin` no topo

## Segurança

> ⚠️ **Importante**: Este é um sistema de autenticação **básico**. Para produção:
>
> - Considere implementar verificação de permissões no backend (Firestore rules)
> - Use HTTPS em produção
> - Implemente refresh tokens e controle de sessão
> - Adicione autenticação de dois fatores (2FA)
> - Mantenha senhas fortes e rotine-as regularmente

## Troubleshooting

### "Erro ao fazer login"

**Problema**: O usuário vê mensagem de erro na tela de login.

**Soluções**:

- Verifique se o email e senha estão corretos
- Confirme que o usuário foi criado no Firebase Console
- Verifique se Firebase Authentication está habilitado (Sign-in method: Email/Password)

### "Página não carrega"

**Problema**: Ao acessar `/skus`, a página não carrega ou fica travada.

**Soluções**:

- Verifique console do navegador (F12 → Console) para mensagens de erro
- Confirme que variáveis de ambiente estão corretas no `.env.local`
- Restart do desenvolvimento: `pnpm dev`

### Botões ainda habilitados sem login

**Problema**: Usuário não autenticado consegue editar/excluir SKUs.

**Soluções**:

- Adicione validação no backend em `src/lib/sku-data-client.ts`
- Implemente Firestore rules para verificar autenticação
- Verifique se `AuthProvider` está envolvendo `SkusClient`

## Proximos Passos (Melhorias Futuras)

1. **Backend validation**: Adicionar verificação de token JWT nas API routes
2. **Role-based access**: Diferenciar entre "admin" e "user"
3. **Password reset**: Implementar recuperação de senha
4. **Google/GitHub auth**: Permitir login via OAuth
5. **Session persistence**: Manter usuário logado após refresh da página
6. **Activity audit log**: Registrar quem criou/editou/deletou cada SKU

## Referências

- [Firebase Authentication Docs](https://firebase.google.com/docs/auth)
- [Next.js with Firebase](https://nextjs.org/examples/with-firebase)
- [Firebase Console](https://console.firebase.google.com/)
