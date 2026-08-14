# Infisical Raycast — autenticação por Access Token direto

## Objetivo

Transformar o fork da extensão Infisical para Raycast para usar um único Access Token de Machine Identity via Token Auth. A extensão deve enviar esse token diretamente nas chamadas da API, sem Universal Auth, cache de token derivado, renovação, ou login.

## Escopo

- Manter os comandos atuais de projetos e segredos.
- Trocar as preferências `Client ID`, `Client Secret` e `Disable Token Verification` por uma preferência obrigatória `Access Token` do tipo `password`.
- Manter `Site URL` e `Organization ID`.
- Configurar o SDK e o cliente HTTP com `Authorization: Bearer <accessToken>`.
- Validar o token por uma chamada já necessária para carregar a lista de projetos.
- Em `401`, orientar que o token está expirado, revogado ou inválido e oferecer abrir as preferências.
- Em `403`, informar que a Machine Identity não tem a permissão necessária.

## Fora de escopo

- Universal Auth, Client ID, Client Secret e renovação de credenciais.
- Tokens de sessão de usuários humanos.
- Operações de IAM, membros, roles, billing, IdP ou Instance Admin.
- Criação ou rotação automática de tokens.

## Arquitetura

O manifesto define `accessToken` como preferência segura. O módulo de autenticação lê a preferência e a aplica ao `InfisicalSDK` uma vez por execução. O helper HTTP reutiliza o mesmo token para os endpoints REST. O valor do token nunca é persistido em `LocalStorage`, exibido, registrado ou acrescentado a mensagens de erro.

```text
Raycast Preferences (password: accessToken)
              |
              v
      infisical.auth().accessToken(accessToken)
              |
              +--> SDK: secrets CRUD
              |
              +--> fetch: Authorization: Bearer <accessToken>
```

## Fluxos de erro

- Sem token: erro de preferência obrigatória do Raycast.
- `401`: "Access Token inválido, expirado ou revogado." Ação para abrir preferências.
- `403`: "A Machine Identity não tem permissão para este recurso." Ação para abrir preferências.
- Demais falhas de rede/API: manter a mensagem sanitizada; nunca incluir request headers, preferência ou corpo completo de resposta.

## Segurança e operação

- O token deve ser de uma Machine Identity exclusiva ao Raycast, com o menor conjunto de projetos/roles possível.
- A instância Infisical define a duração real do token. O fork não faz nem simula renovação.
- Usar HTTPS para a URL da instância.
- Rodar testes em um projeto não produtivo, cobrindo token válido, token inválido/revogado e falta de permissão.

## Critérios de aceite

1. A extensão inicia com `Site URL`, `Organization ID` e `Access Token`, sem Client ID/Secret.
2. Não há referência a `universalAuth`, `renew`, `disableTokenVerification` ou `LocalStorage` de token no fluxo de autenticação.
3. Projetos e segredos continuam a usar o token configurado diretamente.
4. Erros 401/403 são compreensíveis e não expõem segredos.
