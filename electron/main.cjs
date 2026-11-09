// Десктопная версия: окно Electron показывает собранное веб-приложение из папки dist.
// Файлы отдаются через свою схему app:// — она ведёт себя как https, поэтому работают
// ES-модули, Web Workers, IndexedDB и localStorage, как в обычном браузере.
const { app, BrowserWindow, Menu, net, protocol, shell } = require('electron')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const TITLE = 'Фоторедактор с ИИ'
const WINDOW = { width: 1280, height: 840, minWidth: 760, minHeight: 600, backgroundColor: '#08090d' }
const DIST = path.join(__dirname, '..', 'dist')
const START_URL = 'app://bundle/index.html'

protocol.registerSchemesAsPrivileged([
  { scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } },
])

// Второй запуск не открывает второе окно, а показывает уже открытое
if (!app.requestSingleInstanceLock()) app.quit()

function createWindow() {
  const win = new BrowserWindow({
    ...WINDOW,
    title: TITLE,
    show: false,
    autoHideMenuBar: true,
    icon: path.join(DIST, 'icon-512.png'),
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false },
  })
  win.once('ready-to-show', () => win.show())

  // Внешние ссылки открываем в браузере по умолчанию, а не внутри приложения
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^(https|mailto):/.test(url)) void shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault()
      if (/^(https|mailto):/.test(url)) void shell.openExternal(url)
    }
  })

  void win.loadURL(START_URL)
  return win
}

app.whenReady().then(() => {
  protocol.handle('app', (request) => {
    const { pathname } = new URL(request.url)
    const file = path.normalize(path.join(DIST, decodeURIComponent(pathname)))
    // Не выпускаем запросы за пределы папки с приложением
    if (!file.startsWith(DIST)) return new Response('Not found', { status: 404 })
    return net.fetch(pathToFileURL(file).toString())
  })
  Menu.setApplicationMenu(null)
  createWindow()
})

app.on('second-instance', () => {
  const [win] = BrowserWindow.getAllWindows()
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
})

app.on('window-all-closed', () => app.quit())
