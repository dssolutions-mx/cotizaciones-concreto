/** Normalize EMA API responses that return `{ data: T }` or bare `T`. */
export async function parseEmaApiData<T>(res: Response): Promise<T> {
  const j = await res.json()
  if (j && typeof j === 'object' && 'data' in j && (j as { data?: T }).data !== undefined) {
    return (j as { data: T }).data
  }
  return j as T
}
