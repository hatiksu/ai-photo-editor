// ИИ-ассистент на Claude: подбирает значения ползунков по описанию. Модуль грузится лениво.
import Anthropic from '@anthropic-ai/sdk'
import { ADJ_KEYS, RANGES, clampAdjustments, type Adjustments } from './processing'

const MODEL = 'claude-opus-5-5'

const SCHEMA: Record<string, unknown> = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation', 'caption', 'adjustments'],
  properties: {
    explanation: { type: 'string', description: 'Кратко (1–2 предложения, по-русски), что и почему изменено.' },
    caption: { type: 'string', description: 'Короткая подпись к фото для соцсетей, по-русски, без хэштегов.' },
    adjustments: {
      type: 'object',
      additionalProperties: false,
      required: ADJ_KEYS,
      properties: Object.fromEntries(ADJ_KEYS.map((k) => [k, { type: 'integer', description: `от ${RANGES[k][0]} до ${RANGES[k][1]}` }])),
    },
  },
}

const SYSTEM = `Ты — профессиональный ретушёр внутри фоторедактора. Ты получаешь фото (уже с текущими правками) и пожелание пользователя.
Верни ПОЛНЫЙ новый набор значений ползунков (абсолютные значения, не приращения), которые нужно установить, чтобы получить желаемый результат.
Значения ползунков: exposure ±100 (±2 EV), brightness, contrast, highlights, shadows, temperature (+ теплее), tint (+ пурпурнее, − зеленее), saturation, vibrance — от −100 до 100; sharpness, vignette, grain, fade, sepia, grayscale — от 0 до 100.
Правь сдержанно: чаще всего хватает значений в пределах ±40. Ориентируйся на то, что реально видно на снимке: пересвет, тёмные участки, цветовой сдвиг.`

export interface AssistantResult {
  explanation: string
  caption: string
  adjustments: Adjustments
}

export async function askAssistant(params: {
  apiKey: string
  imageBase64: string
  instruction: string
  current: Adjustments
}): Promise<AssistantResult> {
  const client = new Anthropic({ apiKey: params.apiKey, dangerouslyAllowBrowser: true })
  let response
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'medium', format: { type: 'json_schema', schema: SCHEMA } },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: params.imageBase64 } },
            { type: 'text', text: `Текущие значения ползунков: ${JSON.stringify(params.current)}\n\nПожелание: ${params.instruction}` },
          ],
        },
      ],
    })
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Неверный API-ключ Anthropic')
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error('У ключа нет доступа к модели')
    if (err instanceof Anthropic.RateLimitError) throw new Error('Слишком много запросов — попробуйте через минуту')
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Нет соединения с интернетом')
    if (err instanceof Anthropic.APIError) throw new Error(`Ошибка API (${err.status ?? '—'}): ${err.message}`)
    throw err
  }

  if (response.stop_reason === 'refusal') throw new Error('Модель отказалась обрабатывать этот запрос')
  if (response.stop_reason === 'max_tokens') throw new Error('Ответ модели оборвался — попробуйте ещё раз')
  const block = response.content.find((b) => b.type === 'text')
  if (!block || block.type !== 'text') throw new Error('Пустой ответ модели')
  const parsed = JSON.parse(block.text) as Partial<AssistantResult>
  return {
    explanation: String(parsed.explanation ?? ''),
    caption: String(parsed.caption ?? ''),
    adjustments: clampAdjustments(parsed.adjustments as Record<string, unknown>),
  }
}
