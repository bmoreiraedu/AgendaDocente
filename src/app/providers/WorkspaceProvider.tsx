import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useCycles } from '../../features/data/queries'

interface WorkspaceValue {
  selectedCycleId: string | undefined
  setSelectedCycleId: (value: string) => void
  selectedClassId: string | undefined
  setSelectedClassId: (value: string | undefined) => void
}

const WorkspaceContext = createContext<WorkspaceValue | null>(null)

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const cycles = useCycles()
  const [selectedCycleId, setSelectedCycleId] = useState<string>()
  const [selectedClassId, setSelectedClassId] = useState<string>()

  useEffect(() => {
    if (!selectedCycleId && cycles.data?.[0]) setSelectedCycleId(cycles.data[0].id)
  }, [cycles.data, selectedCycleId])

  const value = useMemo(() => ({ selectedCycleId, setSelectedCycleId, selectedClassId, setSelectedClassId }), [selectedClassId, selectedCycleId])
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext)
  if (!value) throw new Error('useWorkspace deve ser usado dentro de WorkspaceProvider')
  return value
}
