import { expect, test, type Page } from '@playwright/test'

const photo = (page: Page) => page.getByLabel('Редактируемое фото')
const toast = (page: Page) => page.getByRole('status')

/** Цвет пикселя в центре предпросмотра и размер холста */
function sample(page: Page) {
  return photo(page).evaluate((c: HTMLCanvasElement) => {
    const d = c.getContext('2d')!.getImageData((c.width / 2) | 0, (c.height / 3) | 0, 1, 1).data
    return { rgb: [d[0], d[1], d[2]], w: c.width, h: c.height }
  })
}

/** Двигаем ползунок так же, как это делает палец: input + отпускание */
async function setSlider(page: Page, value: number) {
  await page.getByRole('slider').evaluate((el: HTMLInputElement, v) => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, String(v))
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }))
  }, value)
}

test.beforeEach(async ({ page }) => {
  await page.goto('./')
  await page.getByRole('button', { name: 'Попробовать на примере' }).click()
  await expect(photo(page)).toBeVisible()
  // Ждём первый кадр из воркера
  await expect.poll(async () => (await sample(page)).w).toBeGreaterThan(1)
})

test('авто-улучшение меняет фото и попадает в историю', async ({ page }) => {
  const before = await sample(page)
  await page.getByRole('button', { name: /Авто-улучшение/ }).click()
  await expect(toast(page)).toContainText('Подобраны')
  await expect.poll(async () => (await sample(page)).rgb).not.toEqual(before.rgb)
  await expect(page.getByRole('button', { name: 'Отменить' })).toBeEnabled()

  await page.getByRole('button', { name: 'Отменить' }).click()
  await expect.poll(async () => (await sample(page)).rgb).toEqual(before.rgb)
})

test('ползунок: изменение, сброс, удержание для сравнения', async ({ page }) => {
  await page.getByRole('button', { name: 'Настройки' }).click()
  await page.getByRole('button', { name: /Контраст/ }).click()
  const before = await sample(page)
  await setSlider(page, 60)
  await expect(page.getByTitle('Сбросить')).toHaveText('+60')
  await expect.poll(async () => (await sample(page)).rgb).not.toEqual(before.rgb)

  // Удержание пальца на фото показывает оригинал
  const box = (await photo(page).boundingBox())!
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await page.mouse.down()
  await expect(page.getByText('Оригинал', { exact: true })).toBeVisible()
  await page.mouse.up()
  await expect(page.getByText('Оригинал', { exact: true })).toBeHidden()

  await page.getByTitle('Сбросить').click()
  await expect(page.getByTitle('Сбросить')).toHaveText('0')
})

test('двойной тап увеличивает и возвращает масштаб', async ({ page }) => {
  const frame = photo(page).locator('..')
  const box = (await photo(page).boundingBox())!
  const tapTwice = async () => {
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
  }
  await tapTwice()
  await expect.poll(() => frame.evaluate((el) => getComputedStyle(el).transform)).toContain('matrix(2.5')
  await tapTwice()
  await expect.poll(() => frame.evaluate((el) => getComputedStyle(el).transform)).toBe('none')
})

test('фильтр с регулировкой силы', async ({ page }) => {
  await page.getByRole('button', { name: 'Фильтры' }).click()
  await page.getByRole('button', { name: 'Ч/Б', exact: true }).click()
  await expect(page.getByText('Сила фильтра «Ч/Б»')).toBeVisible()
  await expect.poll(async () => {
    const [r, g, b] = (await sample(page)).rgb
    return r === g && g === b
  }).toBe(true)
})

test('обрезка 1:1 и поворот', async ({ page }) => {
  await page.getByRole('button', { name: 'Кадр' }).click()
  await page.getByRole('button', { name: '1:1' }).click()
  await page.getByRole('button', { name: 'Обрезать' }).click()
  await expect.poll(async () => {
    const { w, h } = await sample(page)
    return w === h
  }).toBe(true)

  await page.getByRole('button', { name: 'Свободно' }).click()
  const before = await sample(page)
  await page.getByRole('button', { name: 'Вправо' }).click()
  await expect.poll(async () => (await sample(page)).rgb).not.toEqual(before.rgb)
})

test('ИИ-ассистент: ввод ключа и применение настроек', async ({ page }) => {
  await page.route('https://api.anthropic.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: { 'access-control-allow-origin': '*' },
      body: JSON.stringify({
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        model: 'claude-opus-5-5',
        stop_reason: 'end_turn',
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              explanation: 'Сделал теплее и контрастнее.',
              caption: 'Вечер в горах',
              adjustments: { exposure: 0, brightness: 0, contrast: 30, highlights: 0, shadows: 0, temperature: 50, tint: 0, saturation: 10, vibrance: 0, sharpness: 0, vignette: 20, grain: 0, fade: 0, sepia: 0, grayscale: 0 },
            }),
          },
        ],
        usage: { input_tokens: 1, output_tokens: 1 },
      }),
    }),
  )

  await page.getByRole('button', { name: /Кино/ }).click()
  const dialog = page.getByRole('dialog', { name: 'API-ключ Anthropic' })
  await dialog.getByLabel('API-ключ').fill('sk-ant-test')
  await dialog.getByRole('button', { name: 'Сохранить' }).click()

  await page.getByRole('button', { name: /Кино/ }).click()
  await expect(page.getByText('Сделал теплее и контрастнее.')).toBeVisible()
  await expect(page.getByText('«Вечер в горах»')).toBeVisible()

  await page.getByRole('button', { name: 'Настройки' }).click()
  await page.getByRole('button', { name: /Температура/ }).click()
  await expect(page.getByTitle('Сбросить')).toHaveText('+50')
})

test('сохранение файла в полном разрешении', async ({ page }) => {
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Сохранить фото' })
  await expect(dialog.getByText('1600 × 1200')).toBeVisible()
  await dialog.getByRole('radio', { name: /PNG/ }).click()
  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Скачать' }).click()
  expect((await download).suggestedFilename()).toBe('sample-edited.png')
})

test('открывается без интернета после первого запуска', async ({ page, context }) => {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
  })
  await page.reload()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { name: /Фоторедактор/ })).toBeVisible()
  await context.setOffline(false)
})
