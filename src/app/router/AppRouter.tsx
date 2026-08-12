import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AppShell } from '../layouts/AppShell'
import { AuthGate, FirstAccessGate, ProfileGate } from './Guards'
import { FirstAccessPage, ForgotPasswordPage, LoginPage, ResetPasswordPage } from '../../features/auth/AuthPages'
import { OnboardingPage } from '../../features/onboarding/OnboardingPage'
import { WorkspaceProvider } from '../providers/WorkspaceProvider'
import { LoadingState } from '../../components/ui'

const DashboardPage = lazy(() => import('../../features/dashboard/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const AgendaPage = lazy(() => import('../../features/agenda/AgendaPage').then((module) => ({ default: module.AgendaPage })))
const ActionsPage = lazy(() => import('../../features/actions/ActionsPage').then((module) => ({ default: module.ActionsPage })))
const ClassesPage = lazy(() => import('../../features/classes/ClassesPages').then((module) => ({ default: module.ClassesPage })))
const ClassDetailPage = lazy(() => import('../../features/classes/ClassesPages').then((module) => ({ default: module.ClassDetailPage })))
const ImportsPage = lazy(() => import('../../features/imports/ImportsPages').then((module) => ({ default: module.ImportsPage })))
const NewImportPage = lazy(() => import('../../features/imports/ImportsPages').then((module) => ({ default: module.NewImportPage })))
const ImportDetailPage = lazy(() => import('../../features/imports/ImportsPages').then((module) => ({ default: module.ImportDetailPage })))
const SettingsPage = lazy(() => import('../../features/settings/SettingsPage').then((module) => ({ default: module.SettingsPage })))

export function AppRouter() {
  return <BrowserRouter><Suspense fallback={<LoadingState label="Abrindo sua agenda…" />}><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route path="/forgot-password" element={<ForgotPasswordPage />} />
    <Route path="/reset-password" element={<ResetPasswordPage />} />
    <Route element={<AuthGate />}>
      <Route path="/first-access" element={<FirstAccessPage />} />
      <Route element={<FirstAccessGate />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route element={<ProfileGate />}>
          <Route element={<WorkspaceProvider><AppShell /></WorkspaceProvider>}>
            <Route index element={<DashboardPage />} />
            <Route path="agenda" element={<AgendaPage />} />
            <Route path="actions" element={<ActionsPage />} />
            <Route path="classes" element={<ClassesPage />} />
            <Route path="classes/:classId" element={<ClassDetailPage />} />
            <Route path="imports" element={<ImportsPage />} />
            <Route path="imports/new" element={<NewImportPage />} />
            <Route path="imports/:importId" element={<ImportDetailPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
    </Route>
    <Route path="*" element={<LoginPage />} />
  </Routes></Suspense></BrowserRouter>
}
