export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (char === '"') {
      if (quoted && text[i + 1] === '"') {
        field += '"'
        i++
      } else if (!quoted && field !== '') throw new Error('Invalid quote')
      else quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(field)
      field = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++
      row.push(field)
      if (row.some(Boolean)) rows.push(row)
      row = []
      field = ''
    } else field += char
  }
  if (quoted) throw new Error('Unclosed quote')
  row.push(field)
  if (row.some(Boolean)) rows.push(row)
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '')
  return rows
}
