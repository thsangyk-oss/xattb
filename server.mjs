import express from 'express'
import multer from 'multer'
import { createServer as createViteServer } from 'vite'
import { promises as fs } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  branches,
  defaultUserPassword,
  departmentId,
  hospitalName,
  seedDepartments,
  seedDevices,
  seedIncidents,
  seedMaintenance,
  seedPermissions,
  seedUsers,
} from './src/data.ts'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.join(rootDir, 'data')
const uploadDir = path.join(rootDir, 'uploads')
const storePath = path.join(dataDir, 'store.json')
const port = Number(process.env.PORT) || 8792
const production = process.argv.includes('--production')

await fs.mkdir(dataDir, { recursive: true })
await fs.mkdir(uploadDir, { recursive: true })

const initialState = {
  devices: structuredClone(seedDevices),
  incidents: structuredClone(seedIncidents),
  events: structuredClone(seedMaintenance),
  permissions: structuredClone(seedPermissions),
  departments: structuredClone(seedDepartments),
  users: structuredClone(seedUsers),
  hospitalName,
  branches: structuredClone(branches),
  updatedAt: new Date().toISOString(),
}

let state
let dirty = false
try {
  state = JSON.parse(await fs.readFile(storePath, 'utf8'))
} catch (error) {
  if (error.code !== 'ENOENT') throw error
  // Lần chạy đầu: ghi ngay kho dữ liệu mẫu để không chỉ nằm trong bộ nhớ
  state = structuredClone(initialState)
  dirty = true
}

/* ---------------------------------------------------------------- migration */

const ensureArray = (key, seed) => {
  if (!Array.isArray(state[key])) {
    state[key] = structuredClone(seed)
    dirty = true
  }
}
ensureArray('devices', seedDevices)
ensureArray('incidents', seedIncidents)
ensureArray('events', seedMaintenance)
ensureArray('departments', seedDepartments)
ensureArray('users', seedUsers)

// incidents gained a repair type + transfer footprint trail
state.incidents = state.incidents.map((incident) => {
  if (Array.isArray(incident.repairHistory)) return incident
  dirty = true
  return { ...incident, repairHistory: [] }
})

// permissions moved from a flat list to one row per branch + department
if (!Array.isArray(state.permissions) || state.permissions.some((item) => !item.branchId)) {
  state.permissions = structuredClone(seedPermissions)
  dirty = true
}

if (!Array.isArray(state.branches) || state.branches.length !== branches.length
  || state.branches.some((branch, index) => branch.id !== branches[index].id || branch.name !== branches[index].name)) {
  state.branches = structuredClone(branches)
  dirty = true
}
if (state.hospitalName !== hospitalName) {
  state.hospitalName = hospitalName
  dirty = true
}

state.devices = state.devices.map((device, index) => {
  const branchId = device.branchId || branches[index % branches.length].id
  const handover = device.handoverDate || ''
  if (device.branchId !== branchId || device.company !== hospitalName
    || device.acceptanceDate === undefined || device.warrantyStart === undefined) dirty = true
  return {
    ...device,
    branchId,
    company: hospitalName,
    acceptanceDate: device.acceptanceDate ?? handover,
    warrantyStart: device.warrantyStart ?? handover,
    documents: Array.isArray(device.documents) ? device.documents : [],
  }
})

// every department referenced by a device must exist in the catalog
for (const device of state.devices) {
  if (!device.department) continue
  const id = departmentId(device.branchId, device.department)
  if (!state.departments.some((item) => item.id === id)) {
    state.departments.push({
      id,
      branchId: device.branchId,
      name: device.department,
      shortName: device.department.replace(/^Khoa |^Phòng /, ''),
      head: '',
      phone: '',
    })
    dirty = true
  }
}

state.users = state.users.map((user) => {
  const role = user.role === 'admin' ? 'admin' : user.role === 'department' ? 'department' : 'moderator'
  return {
    ...user,
    role,
    password: user.password || defaultUserPassword,
    active: user.active !== false,
    branchId: role === 'admin' ? undefined : user.branchId || branches[0].id,
    department: role === 'department' ? user.department : undefined,
  }
})
for (const seedUser of seedUsers) {
  if (!state.users.some((user) => user.username?.toLowerCase() === seedUser.username.toLowerCase())) {
    state.users.push(structuredClone(seedUser))
    dirty = true
  }
}

if (dirty) {
  state.updatedAt = new Date().toISOString()
  await fs.writeFile(storePath, JSON.stringify(state, null, 2), 'utf8')
}

let writeQueue = Promise.resolve()
const persist = () => {
  state.updatedAt = new Date().toISOString()
  const snapshot = JSON.stringify(state, null, 2)
  writeQueue = writeQueue.then(() => fs.writeFile(storePath, snapshot, 'utf8'))
  return writeQueue
}

/* ------------------------------------------------------------------- access */

const sessions = new Map()

const publicUser = (user) => {
  if (!user) return null
  const safeUser = { ...user }
  delete safeUser.password
  return safeUser
}

const getSessionUser = (request) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  const userId = token ? sessions.get(token) : undefined
  return userId ? state.users.find((user) => user.id === userId && user.active !== false) : undefined
}

const departmentCanSeeShared = (user) =>
  state.permissions.find((item) => item.branchId === user.branchId && item.name === user.department)?.view !== false

// what a user is allowed to READ
const canReadDevice = (user, device) => {
  if (!user || !device) return false
  if (user.role === 'admin') return true
  if (device.branchId !== user.branchId) return false
  if (user.role === 'moderator') return true
  return device.department === user.department || (device.shared && departmentCanSeeShared(user))
}

// what a user is allowed to WRITE (device records, schedules, documents)
const canWriteDevice = (user, device) => {
  if (!user || !device) return false
  if (user.role === 'admin') return true
  return user.role === 'moderator' && device.branchId === user.branchId
}

// Giá thiết bị là thông tin chỉ dành cho admin tổng: moderator và tài khoản khoa
// không bao giờ nhận trường này, kể cả trong payload thô của /api/state.
const canSeePrice = (user) => user?.role === 'admin'

const scopedDevice = (user, device) => {
  if (canSeePrice(user)) return device
  const { price, ...rest } = device
  void price
  return rest
}

const scopedState = (user) => {
  const devices = state.devices
    .filter((device) => canReadDevice(user, device))
    .map((device) => scopedDevice(user, device))
  const deviceIds = new Set(devices.map((device) => device.id))
  const inBranch = (item) => user.role === 'admin' || item.branchId === user.branchId
  return {
    devices,
    incidents: state.incidents.filter((incident) => deviceIds.has(incident.deviceId)),
    events: state.events.filter((event) => deviceIds.has(event.deviceId)),
    permissions: state.permissions.filter(inBranch),
    departments: state.departments.filter(inBranch),
    users: state.users
      .filter((item) => user.role === 'admin'
        || (user.role === 'moderator' && item.branchId === user.branchId)
        || item.id === user.id)
      .map(publicUser),
    branches: user.role === 'admin' ? state.branches : state.branches.filter((branch) => branch.id === user.branchId),
    hospitalName: state.hospitalName,
    updatedAt: state.updatedAt,
  }
}

const requireSession = (request, response, next) => {
  const user = getSessionUser(request)
  if (!user) return response.status(401).json({ error: 'Phiên đăng nhập đã hết hạn' })
  request.user = user
  return next()
}

const requireRole = (...roles) => (request, response, next) => {
  const user = getSessionUser(request)
  if (!user) return response.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này' })
  if (!roles.includes(user.role)) return response.status(403).json({ error: 'Tài khoản không có quyền thực hiện thao tác này' })
  request.user = user
  return next()
}

// resolves request.device and checks write access in one step
const requireDeviceWrite = (request, response, next) => {
  const user = getSessionUser(request)
  if (!user) return response.status(401).json({ error: 'Vui lòng đăng nhập để thực hiện thao tác này' })
  const device = state.devices.find((item) => item.id === request.params.id)
  if (!device) return response.status(404).json({ error: 'Không tìm thấy thiết bị' })
  if (!canWriteDevice(user, device)) return response.status(403).json({ error: 'Bạn không có quyền chỉnh sửa thiết bị này' })
  request.user = user
  request.device = device
  return next()
}

/* ------------------------------------------------------------------ uploads */

const safeFileName = (name) => name
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-zA-Z0-9._-]/g, '-')
  .replace(/-+/g, '-')
  .slice(-120)

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDir),
  filename: (_request, file, callback) => callback(null, `${Date.now()}-${safeFileName(file.originalname)}`),
})

const allowedMime = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/jpeg',
  'image/png',
  'image/webp',
])

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => {
    const ok = allowedMime.has(file.mimetype)
    callback(ok ? null : new Error('Định dạng tệp không được hỗ trợ'), ok)
  },
})

const readableSize = (bytes) => bytes > 1_000_000
  ? `${(bytes / 1_000_000).toFixed(1)} MB`
  : `${Math.ceil(bytes / 1_000)} KB`

/* --------------------------------------------------------------------- app */

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))
app.use('/uploads', express.static(uploadDir, { fallthrough: false, maxAge: production ? '1d' : 0 }))

app.get('/api/health', (_request, response) => {
  response.json({ ok: true, port, updatedAt: state.updatedAt })
})

app.get('/api/state', requireSession, (request, response) => {
  response.set('Cache-Control', 'no-store')
  response.json(scopedState(request.user))
})

// QR báo hỏng: mở được mà không cần đăng nhập, chỉ trả về thông tin tối thiểu
app.get('/api/public/devices/:id', (request, response) => {
  const device = state.devices.find((item) => item.id === request.params.id)
  if (!device) return response.status(404).json({ error: 'Không tìm thấy thiết bị' })
  response.set('Cache-Control', 'no-store')
  return response.json({
    id: device.id,
    code: device.code,
    hisCode: device.hisCode,
    name: device.name,
    category: device.category,
    model: device.model,
    serial: device.serial,
    department: device.department,
    room: device.room,
    company: device.company,
    status: device.status,
  })
})

app.post('/api/auth/login', (request, response) => {
  const username = String(request.body?.username || '').trim().toLowerCase()
  const password = String(request.body?.password || '')
  const user = state.users.find((item) => item.username.toLowerCase() === username
    && item.password === password
    && item.active !== false)
  if (!user) return response.status(401).json({ error: 'Tên đăng nhập hoặc mật khẩu không đúng' })
  user.lastLogin = new Date().toISOString()
  const token = randomUUID()
  sessions.set(token, user.id)
  void persist()
  return response.json({ token, user: publicUser(user) })
})

app.get('/api/auth/me', requireSession, (request, response) => {
  response.json(publicUser(request.user))
})

app.post('/api/auth/password', requireSession, async (request, response) => {
  const current = String(request.body?.currentPassword || '')
  const next = String(request.body?.newPassword || '')
  if (request.user.password !== current) return response.status(400).json({ error: 'Mật khẩu hiện tại không đúng' })
  if (next.length < 6) return response.status(400).json({ error: 'Mật khẩu mới cần ít nhất 6 ký tự' })
  request.user.password = next
  await persist()
  return response.status(204).end()
})

app.post('/api/auth/logout', (request, response) => {
  const token = request.headers.authorization?.replace(/^Bearer\s+/i, '')
  if (token) sessions.delete(token)
  response.status(204).end()
})

/* ------------------------------------------------------------------- users */

const canManageUser = (actor, target) => {
  if (actor.role === 'admin') return target.role !== 'admin' || target.id === actor.id
  if (actor.role === 'moderator') return target.role === 'department' && target.branchId === actor.branchId
  return false
}

app.post('/api/users', requireRole('admin', 'moderator'), async (request, response) => {
  const body = request.body || {}
  if (!body.username || !body.displayName) return response.status(400).json({ error: 'Thiếu thông tin tài khoản bắt buộc' })
  if (body.role === 'admin') return response.status(400).json({ error: 'Hệ thống chỉ duy trì một admin tổng' })
  const role = body.role === 'moderator' ? 'moderator' : 'department'
  if (request.user.role === 'moderator' && role !== 'department') {
    return response.status(403).json({ error: 'Quản lý chi nhánh chỉ được tạo tài khoản khoa' })
  }
  const branchId = request.user.role === 'moderator' ? request.user.branchId : body.branchId
  if (!branchId || !branches.some((branch) => branch.id === branchId)) return response.status(400).json({ error: 'Chi nhánh không hợp lệ' })
  if (role === 'department' && !body.department) return response.status(400).json({ error: 'Cần chọn khoa/phòng cho tài khoản' })
  const username = String(body.username).trim().toLowerCase()
  if (state.users.some((item) => item.username.toLowerCase() === username)) return response.status(409).json({ error: 'Tên đăng nhập đã tồn tại' })
  const created = {
    id: body.id || `user-${randomUUID()}`,
    username,
    displayName: String(body.displayName).trim(),
    role,
    branchId,
    department: role === 'department' ? String(body.department) : undefined,
    active: body.active !== false,
    password: body.password || defaultUserPassword,
  }
  state.users.push(created)
  await persist()
  return response.status(201).json(publicUser(created))
})

app.patch('/api/users/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.users.findIndex((user) => user.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy tài khoản' })
  const current = state.users[index]
  if (!canManageUser(request.user, current)) return response.status(403).json({ error: 'Bạn không có quyền với tài khoản này' })
  if (current.id === request.user.id && request.body.active === false) {
    return response.status(400).json({ error: 'Không thể tự khóa tài khoản đang đăng nhập' })
  }
  state.users[index] = {
    ...current,
    displayName: request.body.displayName || current.displayName,
    department: current.role === 'department' ? request.body.department || current.department : undefined,
    active: request.body.active !== undefined ? request.body.active !== false : current.active !== false,
    password: request.body.password || current.password || defaultUserPassword,
  }
  await persist()
  return response.json(publicUser(state.users[index]))
})

app.delete('/api/users/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.users.findIndex((user) => user.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy tài khoản' })
  const target = state.users[index]
  if (target.role === 'admin') return response.status(400).json({ error: 'Không thể xóa admin tổng' })
  if (!canManageUser(request.user, target)) return response.status(403).json({ error: 'Bạn không có quyền với tài khoản này' })
  state.users.splice(index, 1)
  for (const [token, userId] of sessions) if (userId === target.id) sessions.delete(token)
  await persist()
  return response.status(204).end()
})

/* ------------------------------------------------------------- departments */

app.post('/api/departments', requireRole('admin', 'moderator'), async (request, response) => {
  const body = request.body || {}
  const branchId = request.user.role === 'moderator' ? request.user.branchId : body.branchId
  const name = String(body.name || '').trim()
  if (!name) return response.status(400).json({ error: 'Cần nhập tên khoa/phòng' })
  if (!branches.some((branch) => branch.id === branchId)) return response.status(400).json({ error: 'Chi nhánh không hợp lệ' })
  const id = departmentId(branchId, name)
  if (state.departments.some((item) => item.id === id)) return response.status(409).json({ error: 'Khoa/phòng đã tồn tại trong chi nhánh' })
  const created = {
    id,
    branchId,
    name,
    shortName: String(body.shortName || name.replace(/^Khoa |^Phòng /, '')).trim(),
    head: String(body.head || ''),
    phone: String(body.phone || ''),
  }
  state.departments.push(created)
  state.permissions.push({ id: `perm-${id}`, branchId, name, users: 0, view: true, borrow: true, approve: false })
  await persist()
  return response.status(201).json(created)
})

app.patch('/api/departments/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.departments.findIndex((item) => item.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy khoa/phòng' })
  const current = state.departments[index]
  if (request.user.role === 'moderator' && current.branchId !== request.user.branchId) {
    return response.status(403).json({ error: 'Ngoài phạm vi chi nhánh của bạn' })
  }
  state.departments[index] = {
    ...current,
    shortName: request.body.shortName ?? current.shortName,
    head: request.body.head ?? current.head,
    phone: request.body.phone ?? current.phone,
  }
  await persist()
  return response.json(state.departments[index])
})

app.delete('/api/departments/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.departments.findIndex((item) => item.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy khoa/phòng' })
  const current = state.departments[index]
  if (request.user.role === 'moderator' && current.branchId !== request.user.branchId) {
    return response.status(403).json({ error: 'Ngoài phạm vi chi nhánh của bạn' })
  }
  const deviceCount = state.devices.filter((device) => device.branchId === current.branchId && device.department === current.name).length
  if (deviceCount) return response.status(409).json({ error: `Còn ${deviceCount} thiết bị thuộc khoa/phòng này` })
  state.departments.splice(index, 1)
  state.permissions = state.permissions.filter((item) => item.id !== `perm-${current.id}`)
  await persist()
  return response.status(204).end()
})

/* ----------------------------------------------------------------- devices */

app.post('/api/devices', requireRole('admin', 'moderator'), async (request, response) => {
  const device = request.body
  if (!device?.id || !device?.code || !device?.name) return response.status(400).json({ error: 'Thiếu thông tin thiết bị bắt buộc' })
  const branchId = request.user.role === 'moderator' ? request.user.branchId : device.branchId || branches[0].id
  if (state.devices.some((item) => item.id === device.id || item.code === device.code)) {
    return response.status(409).json({ error: 'Mã thiết bị đã tồn tại' })
  }
  const saved = {
    ...device,
    branchId,
    company: hospitalName,
    // chỉ admin được đặt nguyên giá; vai trò khác tạo hồ sơ với giá bỏ trống
    price: canSeePrice(request.user) ? Number(device.price) || 0 : undefined,
    documents: [],
    lastUpdated: new Date().toISOString(),
  }
  state.devices.unshift(saved)
  await persist()
  return response.status(201).json(scopedDevice(request.user, saved))
})

app.patch('/api/devices/:id', requireDeviceWrite, async (request, response) => {
  const index = state.devices.findIndex((device) => device.id === request.params.id)
  if (request.user.role === 'moderator' && request.body.branchId && request.body.branchId !== request.user.branchId) {
    return response.status(403).json({ error: 'Quản lý chi nhánh không thể chuyển thiết bị sang chi nhánh khác' })
  }
  state.devices[index] = {
    ...state.devices[index],
    ...request.body,
    id: state.devices[index].id,
    documents: state.devices[index].documents,
    branchId: request.user.role === 'moderator' ? request.user.branchId : request.body.branchId || state.devices[index].branchId,
    company: hospitalName,
    // vai trò không xem được giá cũng không được sửa giá — giữ nguyên giá trị cũ
    price: canSeePrice(request.user) && request.body.price !== undefined
      ? Number(request.body.price) || 0
      : state.devices[index].price,
    lastUpdated: new Date().toISOString(),
  }
  await persist()
  return response.json(scopedDevice(request.user, state.devices[index]))
})

app.delete('/api/devices/:id', requireDeviceWrite, async (request, response) => {
  state.devices = state.devices.filter((device) => device.id !== request.params.id)
  state.incidents = state.incidents.filter((incident) => incident.deviceId !== request.params.id)
  state.events = state.events.filter((event) => event.deviceId !== request.params.id)
  await persist()
  response.status(204).end()
})

app.post('/api/devices/:id/documents', requireDeviceWrite, upload.single('file'), async (request, response) => {
  if (!request.file) return response.status(400).json({ error: 'Chưa chọn tệp tải lên' })
  const device = state.devices.find((item) => item.id === request.params.id)
  const document = {
    id: `doc-${Date.now()}`,
    name: request.file.originalname,
    type: request.body.type || 'Khác',
    size: readableSize(request.file.size),
    uploadedAt: new Intl.DateTimeFormat('vi-VN').format(new Date()),
    url: `/uploads/${request.file.filename}`,
  }
  device.documents.push(document)
  await persist()
  return response.status(201).json({ document, device: scopedDevice(request.user, device) })
})

app.delete('/api/devices/:id/documents/:documentId', requireDeviceWrite, async (request, response) => {
  const device = request.device
  const index = device.documents.findIndex((item) => item.id === request.params.documentId)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy tài liệu' })
  const [removed] = device.documents.splice(index, 1)
  if (removed.url?.startsWith('/uploads/')) {
    await fs.unlink(path.join(uploadDir, path.basename(removed.url))).catch(() => undefined)
  }
  await persist()
  return response.json(scopedDevice(request.user, device))
})

/* --------------------------------------------------------------- incidents */

app.post('/api/incidents', async (request, response) => {
  const incident = request.body
  if (!incident?.id || !incident?.deviceId || !incident?.title) return response.status(400).json({ error: 'Thiếu thông tin sự cố bắt buộc' })
  if (state.incidents.some((item) => item.id === incident.id)) return response.status(409).json({ error: 'Sự cố đã tồn tại' })
  const device = state.devices.find((item) => item.id === incident.deviceId)
  if (!device) return response.status(404).json({ error: 'Không tìm thấy thiết bị' })
  const user = getSessionUser(request)
  // báo hỏng qua QR không cần đăng nhập; nếu đã đăng nhập thì phải nằm trong phạm vi
  if (user && !canReadDevice(user, device)) return response.status(403).json({ error: 'Thiết bị nằm ngoài phạm vi của bạn' })
  // Người báo hỏng (kể cả khách quét QR) không được tự đặt hướng xử lý hay dấu vết chuyển.
  state.incidents.unshift({
    ...incident,
    notes: Array.isArray(incident.notes) ? incident.notes : [],
    repairType: undefined,
    repairConfirmDate: undefined,
    repairCompletedAt: undefined,
    returnedAt: undefined,
    repairHistory: [],
  })
  device.status = 'Đang sửa chữa'
  device.lastUpdated = new Date().toISOString()
  await persist()
  return response.status(201).json(state.incidents[0])
})

app.post('/api/incidents/:id/photos', upload.single('file'), async (request, response) => {
  const incident = state.incidents.find((item) => item.id === request.params.id)
  if (!incident) {
    if (request.file) await fs.unlink(request.file.path).catch(() => undefined)
    return response.status(404).json({ error: 'Không tìm thấy sự cố' })
  }
  if (!request.file) return response.status(400).json({ error: 'Chưa chọn ảnh tải lên' })
  incident.photos = [...(incident.photos ?? []), {
    id: `photo-${Date.now()}`,
    name: request.file.originalname,
    size: readableSize(request.file.size),
    url: `/uploads/${request.file.filename}`,
  }]
  incident.hasPhoto = true
  await persist()
  return response.status(201).json(incident)
})

const repairTypes = ['Tự sửa', 'Báo công ty', 'Chuyển về Hệ thống', 'Thay mới']

app.patch('/api/incidents/:id', requireSession, async (request, response) => {
  const index = state.incidents.findIndex((incident) => incident.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy sự cố' })
  const current = state.incidents[index]
  const device = state.devices.find((item) => item.id === current.deviceId)
  if (!canReadDevice(request.user, device)) return response.status(403).json({ error: 'Sự cố nằm ngoài phạm vi của bạn' })

  const body = request.body || {}
  // Tài khoản khoa chỉ được bổ sung ghi chú và xác nhận đã nhận thiết bị về lại khoa —
  // đó là hai việc thuộc thẩm quyền của chính khoa đó.
  const isDepartmentUser = request.user.role === 'department'
  const receivingBack = body.status === 'Đã nhận về khoa'
  if (isDepartmentUser && receivingBack && current.status !== 'Đã hoàn tất') {
    return response.status(400).json({ error: 'Chỉ nhận thiết bị về khoa sau khi sửa chữa đã hoàn thành' })
  }
  const changes = isDepartmentUser
    ? {
      notes: body.notes ?? current.notes,
      ...(receivingBack ? { status: 'Đã nhận về khoa' } : {}),
    }
    : { ...body }

  if (changes.repairType !== undefined && !repairTypes.includes(changes.repairType)) {
    return response.status(400).json({ error: 'Hình thức sửa chữa không hợp lệ' })
  }
  // Mọi hình thức sửa chữa đều phải kèm ngày xác nhận sửa chữa.
  const confirmDate = changes.repairConfirmDate ?? current.repairConfirmDate
  if (changes.repairType !== undefined && !confirmDate) {
    return response.status(400).json({ error: 'Cần nhập ngày xác nhận sửa chữa' })
  }

  const history = Array.isArray(current.repairHistory) ? [...current.repairHistory] : []
  // Dấu vết chuyển hình thức: máy chủ tự đóng dấu ngày và người thực hiện, không tin client.
  if (changes.repairType !== undefined && changes.repairType !== current.repairType) {
    history.push({
      id: `trace-${randomUUID()}`,
      from: current.repairType ?? null,
      to: changes.repairType,
      at: new Date().toISOString(),
      by: request.user.displayName,
      note: typeof body.transferNote === 'string' ? body.transferNote.trim() : '',
    })
  }
  delete changes.transferNote
  delete changes.repairHistory

  const now = new Date().toISOString()
  if (changes.status === 'Đã hoàn tất' && current.status !== 'Đã hoàn tất') changes.repairCompletedAt = now
  if (changes.status === 'Đã nhận về khoa') {
    changes.returnedAt = now
    changes.repairCompletedAt = current.repairCompletedAt ?? now
  }

  state.incidents[index] = { ...current, ...changes, id: current.id, repairHistory: history }
  const incident = state.incidents[index]

  if (device) {
    // Thiết bị chỉ trở lại "Đang hoạt động" khi khoa đã nhận về; "Thay mới" thì ngừng sử dụng.
    if (incident.status === 'Đã nhận về khoa') {
      device.status = incident.repairType === 'Thay mới' ? 'Ngừng sử dụng' : 'Đang hoạt động'
      device.lastUpdated = now
    } else if (incident.status === 'Đã hoàn tất' && incident.repairType === 'Tự sửa') {
      // Tự sửa tại chỗ: thiết bị không rời khoa nên hoàn thành là dùng lại được ngay.
      device.status = 'Đang hoạt động'
      device.lastUpdated = now
    }
  }

  await persist()
  return response.json(incident)
})

/* ------------------------------------------------------------------ events */

app.post('/api/events', requireRole('admin', 'moderator'), async (request, response) => {
  const event = request.body
  if (!event?.id || !event?.deviceId || !event?.date || !event?.type) return response.status(400).json({ error: 'Thiếu thông tin lịch bắt buộc' })
  const device = state.devices.find((item) => item.id === event.deviceId)
  if (!canWriteDevice(request.user, device)) return response.status(403).json({ error: 'Thiết bị nằm ngoài phạm vi của bạn' })
  if (state.events.some((item) => item.id === event.id)) return response.status(409).json({ error: 'Lịch đã tồn tại' })
  state.events.push(event)
  state.events.sort((a, b) => a.date.localeCompare(b.date))
  await persist()
  return response.status(201).json(event)
})

app.patch('/api/events/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.events.findIndex((event) => event.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy lịch' })
  const device = state.devices.find((item) => item.id === state.events[index].deviceId)
  if (!canWriteDevice(request.user, device)) return response.status(403).json({ error: 'Lịch nằm ngoài phạm vi của bạn' })
  state.events[index] = { ...state.events[index], ...request.body, id: state.events[index].id }
  if (state.events[index].status === 'Hoàn tất' && device) {
    const cycle = Number(device.maintenanceCycle) || 6
    const next = new Date(`${state.events[index].date}T00:00:00`)
    next.setMonth(next.getMonth() + cycle)
    device.nextMaintenance = next.toISOString().slice(0, 10)
    device.lastUpdated = new Date().toISOString()
  }
  await persist()
  return response.json(state.events[index])
})

app.delete('/api/events/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.events.findIndex((event) => event.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy lịch' })
  const device = state.devices.find((item) => item.id === state.events[index].deviceId)
  if (!canWriteDevice(request.user, device)) return response.status(403).json({ error: 'Lịch nằm ngoài phạm vi của bạn' })
  state.events.splice(index, 1)
  await persist()
  return response.status(204).end()
})

/* ------------------------------------------------------------- permissions */

app.patch('/api/permissions/:id', requireRole('admin', 'moderator'), async (request, response) => {
  const index = state.permissions.findIndex((permission) => permission.id === request.params.id)
  if (index < 0) return response.status(404).json({ error: 'Không tìm thấy đơn vị phân quyền' })
  if (request.user.role === 'moderator' && state.permissions[index].branchId !== request.user.branchId) {
    return response.status(403).json({ error: 'Ngoài phạm vi chi nhánh của bạn' })
  }
  state.permissions[index] = {
    ...state.permissions[index],
    ...request.body,
    id: state.permissions[index].id,
    branchId: state.permissions[index].branchId,
  }
  await persist()
  return response.json(state.permissions[index])
})

app.use('/api', (_request, response) => response.status(404).json({ error: 'API không tồn tại' }))

app.use((error, _request, response, _next) => {
  void _next
  console.error(error)
  response.status(error instanceof multer.MulterError ? 400 : 500).json({ error: error.message || 'Lỗi máy chủ' })
})

if (production) {
  const distDir = path.join(rootDir, 'dist')
  app.use(express.static(distDir, { index: false }))
  app.use((request, response, next) => {
    if (request.method !== 'GET' || request.path.startsWith('/api/')) return next()
    return response.sendFile(path.join(distDir, 'index.html'))
  })
} else {
  const vite = await createViteServer({ root: rootDir, server: { middlewareMode: true }, appType: 'spa' })
  app.use(vite.middlewares)
}

app.listen(port, '0.0.0.0', () => {
  console.log(`${hospitalName} đang chạy tại http://localhost:${port}`)
  for (const [name, addresses] of Object.entries(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family === 'IPv4' && !address.internal) console.log(`  ${name}: http://${address.address}:${port}`)
    }
  }
})
