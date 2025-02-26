export const getUniquePartFromUid = (uid: string | null): string => {
  // expect UIDs to similar to e.g. MP-108-SKYLARK400_END-1-FCC
  if (!uid) {
    console.warn('No UID found in component data')
    return ''
  }
  const parts = uid.split('-')
  if (parts.length < 2) {
    console.warn('Component UID is not in expected format')
    return ''
  }
  return parts.slice(0, 2).join('-')
}