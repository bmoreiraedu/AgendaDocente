export function decodeCsvBytes(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1252' } {
  try {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'utf-8' }
  } catch {
    const text = new TextDecoder('windows-1252').decode(bytes)
    return { text: text.replace(/^\uFEFF/, ''), encoding: 'windows-1252' }
  }
}
