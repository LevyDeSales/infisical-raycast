# Relatório de decisão: autenticação do fork Infisical para Raycast

**Data:** 2026-08-13  
**Decisão em análise:** substituir (ou complementar) o Universal Auth da extensão Raycast por um token de acesso com privilégios administrativos.

## Resumo executivo

O fork é tecnicamente viável com dois tipos de credencial:

1. **Token Auth de uma Machine Identity**: token bearer criado para uma identidade de máquina.
2. **JWT de sessão de uma conta humana**: token de acesso da sessão de um usuário, que o CLI consegue exibir.

Porém, `IAM Admin` é uma **permissão**, não uma categoria de token. Um token de Machine Identity com `Organization Admin` e o JWT de uma conta humana `Organization Admin` podem ambos chamar a API com privilégios administrativos. Em ambos os casos, o token é um bearer token: quem o copiar pode reutilizá-lo enquanto estiver válido.

**Recomendação:** não lançar um fork que aceite uma conta humana Admin nem uma Machine Identity Admin/Instance Admin como configuração padrão. Para o caso de uso atual — consultar e administrar segredos no Raycast — adotar apenas uma **Machine Identity exclusiva para o Raycast**, sem privilégio de organização e adicionada somente aos projetos necessários com papel personalizado mínimo. Preferir Universal Auth com segredo de curta duração; oferecer Token Auth direto somente como modo avançado, limitado à identidade dedicada, com avisos e controles explícitos.

Se o requisito for realmente administrar IAM, membros, roles, IdP, billing ou a instância pelo Raycast, a recomendação é **não implementar isso nesta extensão** até existir um desenho específico de privilégio mínimo, auditoria e distribuição interna endurecida. Um token de `Instance Admin` é break-glass/root e está fora do limite aceitável para uma preferência desktop.

## Evidências verificadas

- A extensão original usa Universal Auth: recebe `clientId` e `clientSecret`, troca-os por um access token, armazena o token em `LocalStorage` e tenta `renew()` quando a validação falha. [Código original](https://github.com/raycast/extensions/blob/870667fc671801a467deb7c4c7fc72992efe3820/extensions/infisical/src/infisical.ts) e [README](https://github.com/raycast/extensions/blob/870667fc671801a467deb7c4c7fc72992efe3820/extensions/infisical/README.md).
- O Token Auth é voltado a Machine Identities e permite chamadas diretas com o token, sem trocar Client ID/Secret por outro token. Tem TTL, máximo de usos e, dependendo do plano, trusted IPs. [Infisical Token Auth](https://infisical.com/docs/documentation/platform/identities/token-auth).
- Um usuário autenticado consegue obter o JWT de sessão com `infisical user get token --plain`; isso é um token de sessão humano, não um PAT administrativo independente, com escopos próprios. [Infisical CLI: user](https://infisical.com/docs/cli/commands/user).
- Organização e projeto têm autorizações separadas: Admin de organização não equivale automaticamente a acesso aos segredos de todos os projetos. [RBAC do Infisical](https://infisical.com/docs/documentation/platform/access-controls/role-based-access-controls).
- Preferências `password` do Raycast têm armazenamento local criptografado e ficam acessíveis à extensão correspondente; isso protege o disco, mas não protege contra código/dependência maliciosa executando dentro da extensão nem contra malware local. [Segurança do Raycast](https://developers.raycast.com/information/security).

## Definições que evitam ambiguidade

| Termo | O que é | Ciclo de vida | Adequação ao Raycast |
| --- | --- | --- | --- |
| Machine Identity + Universal Auth | Client ID e Client Secret de uma identidade de workload trocados por token curto. | Segredo pode ter TTL e limite de usos; token de acesso é renovável dentro do máximo permitido. | Melhor opção para identidade dedicada com escopo mínimo. |
| Machine Identity + Token Auth | Token bearer direto criado para uma Machine Identity. | TTL, máximo TTL, usos e IPs confiáveis configuráveis. | Sim, mas aumenta o risco de uma credencial estática/portável. |
| User access token | JWT da sessão de uma pessoa. | Sessão expira/revoga; requer login humano para obter outro token. | Tecnicamente suportado, mas não recomendado para conta Admin. |
| Service token | Credencial de projeto, com escopos de ambiente/path. | Pode expirar; modelo legado em migração para Identities. | Fora de escopo para este fork administrativo. |
| Instance Admin | Privilégio máximo de uma instância self-hosted. | Conforme a credencial que o porta. | Nunca aceitar no Raycast. |

## Debate estruturado

### Posição A — defender Machine Identity Admin + Token Auth

**Tese.** Um token direto reduz complexidade: elimina login Universal Auth, token derivado em cache, renovação e duas preferências secretas. A identidade é própria da integração, logo não se mistura ao ciclo de vida de uma pessoa. Para uma extensão que realmente administra organização, uma Machine Identity `Organization Admin` permite essas operações de forma previsível.

**Argumentos fortes.**

- Há apenas uma credencial operacional a configurar, em um campo `password`.
- A identidade pode ser nomeada (`Raycast Admin`), inventariada, rotacionada e revogada sem afetar um funcionário.
- O token pode ter TTL, limite de usos e, quando disponível, IPs confiáveis.

**Resposta às críticas.** Universal Auth também preserva um segredo de bootstrap capaz de emitir novos tokens; portanto, token curto não é uma vitória automática. A diferença real é quanto de privilégio, tempo de validade e alcance ficam no dispositivo.

**Concessão.** Admin de organização só se justifica se os comandos forem de organização; para navegar segredos, é excesso de privilégio. Um token bearer Admin furtado pode criar persistência (por exemplo, criar outra identidade) antes de ser revogado.

### Posição B — defender User access token de uma conta IAM/Organization Admin

**Tese.** Para uma ferramenta interativa e pessoal, operar como a pessoa pode ser mais fiel à governança: ações auditáveis por usuário, MFA/SSO no login original e nenhuma Machine Identity administrativa compartilhada por várias pessoas.

**Argumentos fortes.**

- O usuário já tem as permissões e a trilha de auditoria atribuível a ele.
- Não se cria uma nova credencial de serviço com poder transversal.
- O SDK suporta injetar manualmente um access token, e o CLI expõe o JWT de sessão.

**Resposta às críticas.** Para uso individual de curta duração, expiração manual é uma característica: obriga novo login em vez de renovar privilégio silenciosamente.

**Concessão.** Não existe evidência de um PAT humano de API, com escopos e rotação projetados para este caso. O usuário teria de copiar um JWT de sessão. Após ser copiado, MFA/SSO não protegem o replay do JWT. Offboarding, mudança de role ou sessão expirada tornam a experiência frágil.

### Posição C — revisão adversarial: contra ambos

**Tese.** Não aceitar tokens administrativos no Raycast. Uma extensão desktop, seu ecossistema de dependências e suas atualizações não são o local de uma credencial root/reutilizável. Aceitar os dois modos aumenta superfície, confunde UX e induz o uso do token de maior poder.

**Argumentos fortes.**

- Token Auth funciona como API key bearer; sem escopo mínimo, uma exfiltração é reproduzível de outra máquina/rede.
- Um token humano Admin exportado é uma sessão copiável, não uma autorização interativa contínua.
- Para Instance Admin, o impacto inclui controle programático completo da instância. A própria documentação o trata como credencial altamente privilegiada. [Provisionamento programático](https://infisical.com/docs/self-hosting/guides/automated-bootstrapping).
- Criptografia local de preferências não protege enquanto a extensão pode ler o token em memória.

**Concessão.** Uma Machine Identity dedicada e não-admin, adicionada somente a projetos explicitamente aprovados, tem blast radius controlável. Para esse perfil, ainda é necessário token curto/rotação, sem logs de token/headers/segredos e auditoria de eventos.

## Matriz comparativa

| Critério | Machine Identity Admin + Token Auth | Usuário IAM Admin + JWT | Machine Identity mínima + Universal Auth |
| --- | --- | --- | --- |
| Compatibilidade técnica | Alta | Alta | Já implementada |
| Simplicidade de UX | Alta | Média; colar token a cada expiração | Média |
| Rastreabilidade por pessoa | Baixa se compartilhada; média se individual | Alta | Alta se uma identidade por operador; média se compartilhada |
| Menor privilégio | Baixa com Admin | Baixa com Admin | Alta quando escopada por projeto/role |
| Risco de token copiado | Crítico | Crítico | Alto, porém reduzível por TTL curto |
| Rotação/revogação | Boa, operacional | Dependente da sessão/pessoa | Boa, separada de pessoas |
| Apto como padrão | Não | Não | **Sim** |

## Decisão recomendada para o fork

### Escopo permitido (versão 1)

- Listar projetos que a identidade já pode acessar.
- Listar, copiar e exportar segredos somente dos projetos explicitamente associados à identidade.
- Escrita/edição/exclusão apenas se a role de projeto permitir, com confirmação explícita para ações destrutivas.
- Mostrar valores de segredo somente após ação explícita; não revelar por padrão.

### Escopo proibido

- Operações de IAM: membros, identidades, roles, grupos, SSO/IdP, billing e políticas da organização.
- Operações de Instance Admin ou bootstrap self-hosted.
- Capturar senha, TOTP, cookie de sessão ou executar login de usuário no fork.
- Suportar token de conta humana Admin ou Machine Identity `Organization Admin` como configuração geral.

### Autenticação proposta

1. Criar uma Machine Identity exclusiva por instalação ou por operador, por exemplo `raycast-levy-prod`.
2. Atribuir `No Access` no nível da organização, salvo se um endpoint indispensável exigir outra role; não usar Admin.
3. Associar explicitamente a identidade aos projetos necessários. Usar role personalizada mínima, idealmente com restrições de ambiente/path.
4. Manter Universal Auth como modo padrão: Client Secret de TTL curto e limite de usos compatível com a rotina. O token de acesso derivado é de curta duração.
5. Se houver uma razão concreta para Token Auth, habilitá-lo como modo avançado de Machine Identity não-admin. Exigir TTL/Max TTL definidos, dono do token, data de rotação e confirmação de que não se trata de Instance Admin.
6. Armazenar segredos somente em preferências `password`; remover o cache de token em `LocalStorage` usado hoje. Nunca incluir preferências, bearer header ou resposta bruta em logs, toast, analytics ou exceção.
7. Em `401`, informar “credencial expirada ou revogada” e abrir as preferências. Em `403`, informar “identidade sem permissão para este recurso”. Não chamar `renew()` para token direto ou JWT humano.

## Por que não suportar os dois agora

Suportar ambos não entrega uma capacidade que o modo de Machine Identity mínima não cubra, mas amplia a matriz de segurança e suporte:

- dois ciclos de expiração/rotação e mensagens de erro;
- possibilidade de o usuário inserir o JWT Admin por conveniência;
- dificuldade de auditar qual tipo de ator executou cada chamada;
- tentação de reintroduzir cache/renovação inadequada para um dos modos;
- documentação e testes mais complexos.

Uma futura modalidade de usuário só deve ser reavaliada se o Infisical oferecer OAuth/PKCE ou PAT humano de API com escopo, expiração, revogação e auditoria apropriados. Nesse cenário, ela deve ser uma modalidade separada, não um campo genérico `Access Token`.

## Pré-condições de segurança antes de implementar

- Inventário do conjunto exato de endpoints e ações necessárias; o papel mínimo depende disso.
- Confirmação na instância/versão Infisical dos valores efetivos de TTL, Max TTL, usos, revogação e trusted IPs; a documentação apresenta defaults que precisam ser validados no ambiente alvo.
- Audit logs disponíveis e revisados para autenticações, leituras/exportações em volume e alterações. [Audit logs](https://infisical.com/docs/documentation/getting-started/concepts/audit-logs).
- Distribuição interna ou Store com lockfile, revisão de dependências e revisão humana de release.
- Produção somente após teste com projeto não produtivo: ação permitida, projeto não associado negado, 401 após revogação e ausência de tokens em logs.

## Pergunta decisória remanescente

O fork precisa administrar a **organização/instância**, ou apenas operar segredos de projetos selecionados? A recomendação acima cobre somente o segundo caso. Se a resposta for organização/instância, é necessário desenhar um produto administrativo separado e rever o modelo de autenticação antes de escrever código.
