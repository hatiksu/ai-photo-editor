// ИИ-функции: ассистент на Claude и локальное удаление фона.
import Anthropic from 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@1.2.0/+esm';
import { ADJ_KEYS, RANGES, clampAdjustments } from './processing.js';

const MODEL = 'claude-opus-5-5';

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['explanation', 'caption', 'adjustments'],
  properties: {
    explanation: {
      type: 'string',
      description: 'Кратко (1–2 предложения, по-русски), что и почему изменено.',
    },
    caption: {
      type: 'string',
      description: 'Короткая подпись к фото для соцсетей, по-русски, без хэштегов.',
    },
    adjustments: {
      type: 'object',
      additionalProperties: false,
      required: ADJ_KEYS,
      properties: Object.fromEntries(
        ADJ_KEYS.map((k) => [k, { type: 'integer', description: `от ${RANGES[k][0]} до ${RANGES[k][1]}` }]),
      ),
    },
  },
};

const SYSTEM = `Ты — профессиональный ретушёр внутри фоторедактора. Ты получаешь фото (уже с текущими правками) и пожелание пользователя.
Верни ПОЛНЫЙ новый набор значений ползунков (абсолютные значения, не приращения), которые нужно установить, чтобы получить желаемый результат.
Значения ползунков: exposure ±100 (±2 EV), brightness, contrast, highlights, shadows, temperature (+ теплее), tint (+ пурпурнее, − зеленее), saturation, vibrance — от −100 до 100; sharpness, vignette, grain, fade, sepia, grayscale — от 0 до 100.
Правь сдержанно: чаще всего хватает значений в пределах ±40. Ориентируйся на то, что реально видно на снимке: пересвет, тёмные участки, цветовой сдвиг.`;

/** Масштабирует холст до maxSide и возвращает base64 JPEG без префикса. */
export function canvasToBase64(canvas, maxSide = 1024) {
  const scale = Math.min(1, maxSide / Math.max(canvas.width, canvas.height));
  const c = document.createElement('canvas');
  c.width = Math.round(canvas.width * scale);
  c.height = Math.round(canvas.height * scale);
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(canvas, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

/**
 * Просит Claude подобрать настройки.
 * @returns {Promise<{explanation: string, caption: string, adjustments: object}>}
 */
export async function askClaude({ apiKey, canvas, instruction, current }) {
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  let response;
  try {
    response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: {
        effort: 'medium',
        format: { type: 'json_schema', schema: SCHEMA },
      },
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: canvasToBase64(canvas) } },
            {
              type: 'text',
              text: `Текущие значения ползунков: ${JSON.stringify(current)}\n\nПожелание: ${instruction}`,
            },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) throw new Error('Неверный API-ключ Anthropic.');
    if (err instanceof Anthropic.PermissionDeniedError) throw new Error('У ключа нет доступа к модели.');
    if (err instanceof Anthropic.RateLimitError) throw new Error('Слишком много запросов — попробуйте через минуту.');
    if (err instanceof Anthropic.APIConnectionError) throw new Error('Нет соединения с API Anthropic.');
    if (err instanceof Anthropic.APIError) throw new Error(`Ошибка API (${err.status}): ${err.message}`);
    throw err;
  }

  if (response.stop_reason === 'refusal') {
    throw new Error('Модель отказалась обрабатывать этот запрос.');
  }
  if (response.stop_reason === 'max_tokens') {
    throw new Error('Ответ модели оборвался — попробуйте ещё раз.');
  }
  const text = response.content.find((b) => b.type === 'text')?.text;
  if (!text) throw new Error('Пустой ответ модели.');
  const parsed = JSON.parse(text);
  return {
    explanation: String(parsed.explanation ?? ''),
    caption: String(parsed.caption ?? ''),
    adjustments: clampAdjustments(parsed.adjustments),
  };
}

let bgModulePromise;

/** Удаляет фон локально (нейросеть в браузере). Возвращает холст с прозрачным фоном. */
export async function removeBackground(canvas, onProgress) {
  bgModulePromise ??= import('https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm');
  const { removeBackground: run } = await bgModulePromise;
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  const result = await run(blob, {
    output: { format: 'image/png' },
    progress: (key, current, total) => onProgress?.(key, total ? current / total : 0),
  });
  const bitmap = await createImageBitmap(result);
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  out.getContext('2d').drawImage(bitmap, 0, 0, out.width, out.height);
  return out;
}
