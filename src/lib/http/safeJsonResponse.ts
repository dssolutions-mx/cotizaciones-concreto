/**
 * Parse fetch() response as JSON; avoids "Unexpected token <" / "Unexpected token R"
 * when the platform returns HTML or plain text (e.g. 413 Request Entity Too Large on Vercel).
 */
export async function parseJsonResponse<T = Record<string, unknown>>(res: Response): Promise<T> {
  const text = await res.text();
  const trimmed = text.trim();
  if (!trimmed) {
    if (!res.ok) {
      throw new Error(messageForFailedResponse(res.status, ''));
    }
    return {} as T;
  }
  const first = trimmed[0];
  if (first !== '{' && first !== '[') {
    throw new Error(messageForFailedResponse(res.status, trimmed));
  }
  try {
    return JSON.parse(trimmed) as T;
  } catch {
    throw new Error('La respuesta del servidor no es válida. Intente de nuevo.');
  }
}

function messageForFailedResponse(status: number, bodySnippet: string): string {
  const lower = bodySnippet.toLowerCase();
  if (
    status === 413 ||
    lower.includes('entity too large') ||
    lower.includes('request entity') ||
    lower.includes('body exceeded') ||
    lower.includes('payload too large') ||
    lower.includes('function_payload_too_large')
  ) {
    return 'El archivo supera el límite del servidor web. La app sube el PDF directamente a almacenamiento; actualice la página e intente de nuevo.';
  }
  if (status === 504 || status === 502) {
    return 'El servidor no respondió a tiempo. Intente de nuevo.';
  }
  if (status === 401) {
    return 'Sesión expirada. Vuelva a iniciar sesión.';
  }
  return `Error del servidor (${status}). Intente de nuevo.`;
}
