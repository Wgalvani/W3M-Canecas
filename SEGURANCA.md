# Segurança e acesso

O app é de uso interno e exige login. Há um único usuário, **Administrador**. A senha é definida por você,
e a redefinição é feita pelo e-mail cadastrado. Não há banco de dados: tudo roda na Vercel.

## Como o acesso funciona

| Camada | Como está protegida |
| --- | --- |
| Senha | Hash **scrypt** (N=2¹⁵, sal aleatório), comparado em tempo constante. A senha em texto nunca é guardada. Mínimo de 12 caracteres, com 3 tipos (minúsculas, maiúsculas, números, símbolos). |
| Sessão | Cookie `__Host-w3m_session` com `HttpOnly`, `Secure` e `SameSite=Lax`, assinado com HMAC-SHA256 (`AUTH_SECRET`). Expira em 12 h. **Trocar a senha derruba todas as sessões abertas.** |
| Rotas | O `src/proxy.ts` barra quem não tem sessão. A página principal ainda faz a verificação completa no servidor. Só `/login`, `/esqueci-senha` e `/redefinir-senha` são públicas. |
| Força bruta | 5 erros por IP a cada 15 min e 20 erros na conta toda a cada 15 min. Cada erro leva uma espera de ~0,6 s, e o scrypt deixa cada tentativa cara. |
| Mensagens | “Usuário ou senha inválidos” sem dizer qual campo errou. Na redefinição, a resposta é sempre a mesma, então a tela não revela qual é o e-mail cadastrado. |
| Redefinição | Link assinado, válido por **30 min** e de **uso único**: ao salvar a nova senha o link deixa de valer. Limite de 3 pedidos por IP por hora e no máximo 1 e-mail a cada 2 min. O endereço do link vem de `APP_URL` e nunca do cabeçalho `Host`. |
| Navegador | CSP com nonce nos scripts, `frame-ancestors 'none'` contra clickjacking, HSTS, `nosniff`, `Referrer-Policy`, `Permissions-Policy` (sem câmera, microfone ou localização), `noindex` e cabeçalho `X-Powered-By` removido. |
| CSRF | Os formulários usam Server Actions (o Next confere a origem) e o cookie `SameSite=Lax`. |
| Imagens | Continuam sendo processadas **só no navegador**: nenhuma imagem sobe para o servidor. |

## Configurar na Vercel (produção)

Cadastre em **Project → Settings → Environment Variables** (ambiente *Production*):

1. **`AUTH_SECRET`**: segredo aleatório. Rode `npm run hash-password -- --secret` para gerar a senha e o segredo juntos.
2. **`ADMIN_PASSWORD_HASH`**: rode `npm run hash-password`, digite a senha (ela não aparece na tela) e copie a linha gerada. Só o *hash* vai para a Vercel.
3. **`ADMIN_EMAIL`** = `welder20bitcoin@gmail.com` e **`ADMIN_USERNAME`** = `Administrador`.
4. **E-mail de redefinição ([Resend](https://resend.com))**: crie uma conta e defina **`RESEND_API_KEY`**.
   Sem domínio próprio verificado, o Resend só entrega para o e-mail dono da conta. Crie a conta com
   `welder20bitcoin@gmail.com` ou verifique um domínio e defina `EMAIL_FROM` (ex.: `W3M Canecas <nao-responda@seudominio.com.br>`).
5. **Gravar a nova senha ao redefinir (Global Config, antigo Edge Config)**:
   - Em **Storage → Create → Global Config**, crie a loja e conecte ao projeto. A Vercel cria `GLOBAL_CONFIG` sozinha
     (projetos antigos podem ter `EDGE_CONFIG`; os dois nomes funcionam).
   - Em **Account Settings → Tokens**, crie um token com acesso ao time do projeto e salve em **`VERCEL_API_TOKEN`**.
     Se o projeto estiver em um time, defina também **`VERCEL_TEAM_ID`**.
6. Publique de novo (*Redeploy*) para valer.

Sem os itens 4 e 5, o login funciona, mas a redefinição por e-mail fica desativada. A tela responde normalmente
e o motivo aparece só nos logs do servidor. Nesse caso, para trocar a senha basta gerar um novo `ADMIN_PASSWORD_HASH`
e publicar de novo.

> A senha salva pela redefinição (Global Config) **tem prioridade** sobre `ADMIN_PASSWORD_HASH`. Para voltar a usar a
> variável, apague o item `admin_password_hash` em **Storage → Global Config**.

### Renovação do token da Vercel (`VERCEL_API_TOKEN`)

O token atual vence em **16/10/2027**. A partir de 30 dias antes, o app mostra um aviso no topo da tela, já com o
passo a passo. O aviso também aparece se o token for revogado. A data é lida da própria Vercel, então o aviso
acompanha qualquer token novo. Se o token vencer, **o login continua funcionando**; só o "Esqueci minha senha" para.

1. Vercel → **Account Settings → Tokens → Create Token**: nome `w3m-canecas-senha`,
   **Scope = WG Solutions' projects** (a conta, **não** o projeto) e **Expiration = 1 Year**. Copie o token.
2. Projeto **w3m-canecas → Settings → Environments → Production → Environment Variables**: edite
   `VERCEL_API_TOKEN`, cole o novo token e marque *Sensitive*.
3. **Deployments → ⋯ → Redeploy** e aguarde ficar *Ready*.
4. Teste o **Esqueci minha senha**.
5. Em **Tokens**, revogue o token antigo (**⋯ → Revoke**).

> Um token com escopo no **projeto** não enxerga o Global Config, que pertence à conta. Nesse caso a gravação da
> senha falha com erro 404 nos logs.

### Recomendado: regra de firewall

O limite de tentativas do app fica na memória de cada instância. A regra abaixo bloqueia na borda da Vercel, antes
de chegar ao app, e vale para todas as instâncias.

1. Projeto **w3m-canecas → Firewall** (menu do topo) → **Configure** (ou **Rules**) → **+ New Rule**.
2. **Name:** `Limitar login e redefinição`.
3. **If** (condições, todas com *AND*):
   - `Request Path` · `Equals` · `/login`. Adicione **OR** para `/esqueci-senha` e `/redefinir-senha`
     (ou use `Matches Expression` com `^/(login|esqueci-senha|redefinir-senha)$`).
   - **AND** `Method` · `Equals` · `POST`.
4. **Then:** **Rate Limit** → *Fixed Window*, **60 s**, **10 requisições**, chave **IP**, ação ao exceder **Deny**
   (ou **Too Many Requests / 429**).
5. **Save Rule** → **Review Changes** → **Publish**.

Para testar, tente entrar 11 vezes em menos de 1 minuto com a senha errada: as tentativas extras são recusadas pela
Vercel. Em **Firewall → Traffic** aparecem as requisições bloqueadas.

Se o plano **Hobby** não oferecer a ação *Rate Limit*, deixe o app cuidar disso (o limite próprio dele já está ativo).
Em caso de ataque, ligue **Firewall → Attack Challenge Mode** temporariamente.

## Desenvolvimento local

`.env.local` (fora do git) já tem `AUTH_SECRET`, usuário e e-mail. Falta a senha: rode `npm run hash-password` e cole o
`ADMIN_PASSWORD_HASH` gerado no `.env.local`. Sem `RESEND_API_KEY`, o link de redefinição aparece no terminal do
`npm run dev`, e a nova senha fica em `.data/` (também fora do git).

## Riscos conhecidos e decisões

- **Um usuário só, sem 2FA.** Para mais pessoas ou mais garantia (2FA, auditoria de acessos), o próximo passo é um
  provedor de identidade (Supabase Auth, Clerk ou Vercel Authentication/SSO).
- **Bloqueio da conta inteira.** Após 20 erros em 15 minutos de qualquer origem, o login fica bloqueado por 15
  minutos, inclusive para você. É a troca por proteção contra ataque distribuído com uma conta só.
- **A redefinição vale o mesmo que a senha.** Quem controlar o e-mail cadastrado consegue trocar a senha. Proteja esse
  e-mail com 2FA.
- **Propagação do Global Config.** Depois de redefinir, a nova senha pode levar alguns segundos para valer em todas as regiões.
- `style-src 'unsafe-inline'` é necessário porque a interface posiciona elementos com estilos inline. Estilo inline não
  executa código; os scripts continuam restritos por nonce.
