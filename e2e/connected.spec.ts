import { expect, test } from '@playwright/test'

const email = process.env.E2E_MASTER_EMAIL
const password = process.env.E2E_MASTER_PASSWORD

test.describe('fluxos conectados ao Supabase', () => {
  test.skip(!email || !password, 'Defina E2E_MASTER_EMAIL e E2E_MASTER_PASSWORD para o ambiente local/remoto de teste.')

  test('login válido abre a Home', async ({ page }) => {
    await page.goto('/login')
    await page.getByLabel('E-mail').fill(email!)
    await page.getByLabel('Senha').fill(password!)
    await page.getByRole('button', { name: 'Entrar' }).click()
    await expect(page).toHaveURL(/\/$/)
    await expect(page.getByText(/Agora \/ próxima aula/i)).toBeVisible()
  })
})
