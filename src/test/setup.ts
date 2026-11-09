// В Node нет ImageData — для тестов обработки пикселей хватает минимальной замены.
class ImageDataPolyfill {
  readonly data: Uint8ClampedArray
  readonly width: number
  readonly height: number
  readonly colorSpace = 'srgb'

  constructor(dataOrWidth: Uint8ClampedArray | number, widthOrHeight: number, height?: number) {
    if (typeof dataOrWidth === 'number') {
      this.width = dataOrWidth
      this.height = widthOrHeight
      this.data = new Uint8ClampedArray(this.width * this.height * 4)
    } else {
      this.data = dataOrWidth
      this.width = widthOrHeight
      this.height = height ?? dataOrWidth.length / 4 / widthOrHeight
    }
  }
}

if (typeof globalThis.ImageData === 'undefined') {
  Object.assign(globalThis, { ImageData: ImageDataPolyfill })
}
