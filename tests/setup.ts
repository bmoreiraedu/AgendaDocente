import '@testing-library/jest-dom/vitest'

if (!globalThis.crypto?.subtle) {
  throw new Error('Web Crypto é obrigatório para os testes de importação.')
}
