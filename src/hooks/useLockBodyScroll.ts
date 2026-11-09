import { useEffect } from 'react'

let locks = 0

/** Блокирует прокрутку страницы, пока открыт хотя бы один слой (шторка, диалог). */
export function useLockBodyScroll(locked: boolean) {
  useEffect(() => {
    if (!locked) return
    locks += 1
    document.body.classList.add('scroll-locked')
    return () => {
      locks -= 1
      if (locks === 0) document.body.classList.remove('scroll-locked')
    }
  }, [locked])
}
