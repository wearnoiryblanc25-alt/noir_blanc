export const normalizeProductColorKey = (value?: string | null) =>
  value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ') ?? ''

export const resolveDefaultProductColorHex = (color?: string | null) => {
  const normalizedColor = normalizeProductColorKey(color)

  if (normalizedColor.includes('negro') || normalizedColor.includes('black')) {
    return '#181614'
  }

  if (
    normalizedColor.includes('blanco') ||
    normalizedColor.includes('white') ||
    normalizedColor.includes('marfil') ||
    normalizedColor.includes('ivory')
  ) {
    return '#efe5d7'
  }

  if (normalizedColor.includes('beige') || normalizedColor.includes('camel')) {
    return '#c7ab8d'
  }

  if (normalizedColor.includes('cafe') || normalizedColor.includes('brown')) {
    return '#86654b'
  }

  if (normalizedColor.includes('gris') || normalizedColor.includes('gray')) {
    return '#a1a09c'
  }

  if (normalizedColor.includes('verde') || normalizedColor.includes('green')) {
    return '#8a9477'
  }

  if (normalizedColor.includes('azul') || normalizedColor.includes('blue')) {
    return '#6c7a92'
  }

  if (normalizedColor.includes('rosa') || normalizedColor.includes('pink')) {
    return '#d79bb2'
  }

  if (normalizedColor.includes('rojo') || normalizedColor.includes('red')) {
    return '#995e58'
  }

  return '#d2c8bc'
}
