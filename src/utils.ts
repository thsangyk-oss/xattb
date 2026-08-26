import type {
  AlertItem,
  Device,
  DeviceStatus,
  Incident,
  IncidentStatus,
  MaintenanceEvent,
  Priority,
} from './types'

export const formatDate = (value: string) => {
  if (!value) return '—'
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`))
}

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(value)

export const shortCurrency = (value: number) => {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`
  if (value >= 1_000_000) return `${Math.round(value / 1_000_000)} triệu`
  return formatCurrency(value)
}

export const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export const isoOffset = (offsetDays: number, from = todayIso()) => {
  const date = new Date(`${from}T00:00:00`)
  date.setDate(date.getDate() + offsetDays)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

/** Số ngày từ hôm nay tới `value`; âm nghĩa là đã quá hạn. */
export const daysFromToday = (value: string) => {
  if (!value) return Number.POSITIVE_INFINITY
  const today = new Date(`${todayIso()}T00:00:00`)
  const target = new Date(`${value.slice(0, 10)}T00:00:00`)
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

export const dueLabel = (value: string) => {
  const days = daysFromToday(value)
  if (!Number.isFinite(days)) return 'Chưa đặt lịch'
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`
  if (days === 0) return 'Hôm nay'
  if (days === 1) return 'Ngày mai'
  return `Còn ${days} ngày`
}

export const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()

export const matchesDeviceSearch = (device: Device, search: string) => {
  if (!search.trim()) return true
  const haystack = [
    device.code,
    device.hisCode,
    device.name,
    device.model,
    device.serial,
    device.department,
    device.room,
    device.manufacturer,
  ]
    .map(normalizeText)
    .join(' ')
  return haystack.includes(normalizeText(search.trim()))
}

export const toneForStatus = (
  status: DeviceStatus | IncidentStatus | Priority | string,
) => {
  if (['Đang hoạt động', 'Đã hoàn tất', 'Hoàn tất', 'Đã duyệt', 'Đã bàn giao'].includes(status)) return 'success'
  if (['Đang sửa chữa', 'Khẩn cấp', 'Quá hạn', 'Đã khóa'].includes(status)) return 'danger'
  if (['Chờ bảo trì', 'Chờ linh kiện', 'Cao', 'Đang thực hiện', 'Chờ duyệt'].includes(status)) return 'warning'
  if (['Mới tiếp nhận', 'Sắp tới', 'Trung bình'].includes(status)) return 'info'
  return 'neutral'
}

export const getDeviceById = (devices: Device[], id: string) =>
  devices.find((device) => device.id === id)

/**
 * Trung tâm cảnh báo: tất cả nhắc nhở đều được tính từ dữ liệu thật
 * (sự cố đang mở, lịch quá hạn, lịch tới hạn theo `reminderDays`, bảo hành sắp hết).
 */
export const buildAlerts = (
  devices: Device[],
  incidents: Incident[],
  events: MaintenanceEvent[],
): AlertItem[] => {
  const deviceOf = (id: string) => devices.find((device) => device.id === id)
  const alerts: AlertItem[] = []

  for (const incident of incidents) {
    if (incident.status === 'Đã hoàn tất') continue
    const device = deviceOf(incident.deviceId)
    if (!device) continue
    const overdueFollowUp = incident.nextActionDate ? daysFromToday(incident.nextActionDate) < 0 : false
    alerts.push({
      id: `alert-${incident.id}`,
      kind: overdueFollowUp ? 'follow-up' : 'incident',
      severity: incident.priority === 'Khẩn cấp' || overdueFollowUp ? 'danger' : 'warning',
      title: `${device.name} — ${incident.title}`,
      detail: overdueFollowUp
        ? `Hẹn xử lý ${formatDate(incident.nextActionDate!)} đã trễ · ${incident.status}`
        : `${incident.reporterDepartment} báo hỏng · Ưu tiên ${incident.priority.toLowerCase()}`,
      meta: `${incident.code} · ${device.code}`,
      view: 'incidents',
      deviceId: device.id,
      incidentId: incident.id,
    })
  }

  for (const event of events) {
    if (event.status === 'Hoàn tất') continue
    const device = deviceOf(event.deviceId)
    if (!device) continue
    const days = daysFromToday(event.date)
    if (days < 0) {
      alerts.push({
        id: `alert-${event.id}`,
        kind: 'maintenance-overdue',
        severity: 'danger',
        title: `${event.type} quá hạn — ${device.name}`,
        detail: `Lịch ngày ${formatDate(event.date)} · ${event.provider}`,
        meta: `${device.code} · ${device.department}`,
        view: 'maintenance',
        deviceId: device.id,
        eventId: event.id,
      })
    } else if (days <= (event.reminderDays || 0)) {
      alerts.push({
        id: `alert-${event.id}`,
        kind: 'maintenance-soon',
        severity: 'warning',
        title: `Sắp đến hẹn ${event.type.toLowerCase()} — ${device.name}`,
        detail: `${dueLabel(event.date)} · ${formatDate(event.date)} ${event.time} · ${event.assignee}`,
        meta: `${device.code} · ${device.department}`,
        view: 'maintenance',
        deviceId: device.id,
        eventId: event.id,
      })
    }
  }

  for (const device of devices) {
    const warrantyDays = daysFromToday(device.warrantyEnd)
    if (Number.isFinite(warrantyDays) && warrantyDays >= 0 && warrantyDays <= 60) {
      alerts.push({
        id: `alert-warranty-${device.id}`,
        kind: 'warranty',
        severity: 'info',
        title: `Sắp hết bảo hành — ${device.name}`,
        detail: `Hết hạn ${formatDate(device.warrantyEnd)} · ${dueLabel(device.warrantyEnd)}`,
        meta: `${device.code} · ${device.supplier}`,
        view: 'devices',
        deviceId: device.id,
      })
    }
  }

  const weight = { danger: 0, warning: 1, info: 2 } as const
  return alerts.sort((a, b) => weight[a.severity] - weight[b.severity])
}

export const createCsv = (rows: Record<string, string | number>[]) => {
  if (!rows.length) return ''
  const keys = Object.keys(rows[0])
  const escape = (value: string | number) => `"${String(value ?? '').replace(/"/g, '""')}"`
  return `\uFEFF${keys.map(escape).join(',')}\n${rows
    .map((row) => keys.map((key) => escape(row[key])).join(','))
    .join('\n')}`
}

export const downloadText = (content: string, fileName: string, type = 'text/csv;charset=utf-8') => {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  link.click()
  URL.revokeObjectURL(url)
}

export const initials = (name: string) => {
  const parts = name.trim().split(/\s+/)
  return `${parts.at(-2)?.[0] ?? ''}${parts.at(-1)?.[0] ?? ''}`.toUpperCase()
}
