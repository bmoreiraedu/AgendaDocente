# AgendaDocente — regras de entrega

- A branch padrão e de produção é `main`.
- Depois de qualquer alteração funcional, execute `pnpm lint`, `pnpm test` e `pnpm build`.
- Se as verificações passarem e o usuário não pedir trabalho apenas local, faça commit das alterações intencionais e push para `origin/main` como etapa padrão de conclusão.
- Nunca faça commit de `.env.local`, tokens, senhas, chaves administrativas, CSVs reais ou dados privados.
- O push em `main` aciona o workflow `.github/workflows/deploy.yml`, que atualiza `https://agenda-docente.pages.dev`.
- A versão pública atual é registrada no arquivo `VERSION` e em `package.json`.
