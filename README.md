# Gestão Santa Print

Painel de gestão da Santa Print construído com React, Vite, TypeScript, pnpm workspace e Supabase.

## Estrutura atual

O workspace original está em:

```text
OneDrive/Imagens/Dot-Explorer
```

A aplicação web está em:

```text
OneDrive/Imagens/Dot-Explorer/artifacts/santa-print
```

Os comandos adicionados na raiz escondem esse caminho legado e permitem executar o projeto normalmente.

## Requisitos

- Node.js 24
- pnpm 10.15 ou superior

## Instalação

```bash
corepack enable
pnpm run install:workspace
```

## Desenvolvimento

```bash
pnpm run dev
```

## Verificação

```bash
pnpm run typecheck
pnpm run build
```

## Variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp OneDrive/Imagens/Dot-Explorer/.env.example OneDrive/Imagens/Dot-Explorer/.env
```

Nunca coloque `SUPABASE_SECRET_KEY` ou chaves de serviço em variáveis iniciadas por `VITE_`, porque tudo que começa com `VITE_` pode ser incluído no bundle do navegador.

## Deploy na Vercel

O arquivo `vercel.json` já aponta o build para o workspace correto e publica o diretório gerado pelo Vite.

O frontend pode ser publicado pela Vercel. A API Express deve ser hospedada separadamente ou convertida para funções serverless antes de ser servida no mesmo domínio.
