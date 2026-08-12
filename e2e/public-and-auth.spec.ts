import { expect, test } from '@playwright/test'

test('rota privada redireciona para login', async ({ page }) => {
  await page.goto('/agenda')
  await expect(page).toHaveURL(/\/login$/)
  await expect(page.getByRole('heading', { name: 'Bom ter você de volta.' })).toBeVisible()
})

test('login não oferece cadastro público', async ({ page }) => {
  await page.goto('/login')
  await expect(page.getByLabel('E-mail')).toBeVisible()
  await expect(page.getByLabel('Senha')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Criar conta' })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Esqueci minha senha' })).toBeVisible()
})

test('recuperação de senha é pública e acessível no mobile', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'Fluxo de viewport mobile')
  await page.goto('/forgot-password')
  await expect(page.getByRole('heading', { name: 'Redefina sua senha.' })).toBeVisible()
  const width = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }))
  expect(width.scroll).toBeLessThanOrEqual(width.client)
})
