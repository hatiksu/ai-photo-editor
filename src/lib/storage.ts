// localStorage может быть недоступен (приватный режим, запрет сайта) — оборачиваем в try/catch.

export const storage = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string) {
    try {
      if (value) localStorage.setItem(key, value)
      else localStorage.removeItem(key)
    } catch {
      // Ничего страшного: просто не запомним
    }
  },
}

export const API_KEY_STORAGE = 'anthropicKey'
