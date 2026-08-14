# Infisical Raycast — atalhos de projeto e path completo de segredo

## Objetivo

Melhorar a navegação entre projetos e permitir copiar um identificador lógico completo para cada segredo.

## Comportamento

### Lista de projetos

- `Enter` abre **Secrets** do projeto selecionado.
- `Command + Enter` abre **Details** do projeto selecionado.
- As duas ações continuam disponíveis no Action Panel, com os atalhos visíveis.

### Lista de segredos

Cada segredo ganha a ação **Copy Secret Path**. Ela copia o identificador:

```text
/<project-slug>/<environment-slug>/<secret-path>/<secret-key>
```

Exemplo para um segredo aninhado:

```text
/alltius-secret-intake/production/aws/credentials/AWS_ACCESS_KEY_ID
```

Exemplo para um segredo na raiz:

```text
/alltius-secret-intake/production/AWS_ACCESS_KEY_ID
```

`secretPath` pode estar ausente ou já conter barras inicial/final. O gerador normaliza os segmentos e sempre emite exatamente uma barra entre eles, sem expor o valor do segredo.

## Arquitetura

- `src/manage-projects.tsx` inverte as ações padrão e secundária, usando atalhos explícitos do Raycast.
- `src/secret-path.ts` contém uma função pura `buildSecretPath(projectSlug, environment, secretPath, secretKey)`.
- `src/secrets.tsx` usa a função ao renderizar **Copy Secret Path**.
- `src/secret-path.test.ts` verifica paths de raiz, aninhados e barras redundantes.

## Erros e limites

- O path é um identificador de referência; não é uma URL e não altera o segredo.
- Não há chamadas extras à API.
- A ação não copia `secretValue`, token ou outros dados confidenciais.

## Critérios de aceite

1. O item padrão da lista de projetos abre Secrets com Enter.
2. Details abre somente com Command + Enter.
3. **Copy Secret Path** copia o formato completo escolhido.
4. Paths de raiz e aninhados não produzem barras duplicadas.
5. Testes, lint e build do Raycast passam.
