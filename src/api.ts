import type {
  AccessPermission,
  Branch,
  Department,
  Device,
  DocumentType,
  Incident,
  MaintenanceEvent,
  UserAccount,
} from './types'

export interface ServerState {
  devices: Device[]
  incidents: Incident[]
  events: MaintenanceEvent[]
  permissions: AccessPermission[]
  departments: Department[]
  users: UserAccount[]
  branches: Branch[]
  hospitalName: string
  updatedAt: string
}

export type PublicDevice = Pick<
  Device,
  'id' | 'code' | 'hisCode' | 'name' | 'category' | 'model' | 'serial' | 'department' | 'room' | 'company' | 'status'
>

let authToken: string | null = null

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const setAuthToken = (token: string | null) => {
  authToken = token
}

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = new Headers(options?.headers)
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)
  const response = await fetch(url, options ? { ...options, headers } : { headers })
  if (response.status === 204) return undefined as T
  if (!response.headers.get('content-type')?.includes('application/json')) {
    throw new Error('Phản hồi máy chủ không hợp lệ')
  }
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new ApiError(payload.error || `Yêu cầu thất bại (${response.status})`, response.status)
  return payload as T
}

const jsonOptions = (method: string, body: unknown): RequestInit => ({
  method,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

/* --------------------------------------------------------------------- auth */

export const loginOnServer = (username: string, password: string) =>
  request<{ token: string; user: UserAccount }>('/api/auth/login', jsonOptions('POST', { username, password }))

export const getCurrentUserOnServer = () => request<UserAccount>('/api/auth/me')

export const logoutOnServer = () => request<void>('/api/auth/logout', { method: 'POST' })

export const changePasswordOnServer = (currentPassword: string, newPassword: string) =>
  request<void>('/api/auth/password', jsonOptions('POST', { currentPassword, newPassword }))

/* -------------------------------------------------------------------- state */

export const getServerState = () => request<ServerState>('/api/state')

export const getPublicDevice = (id: string) =>
  request<PublicDevice>(`/api/public/devices/${encodeURIComponent(id)}`)

/* ------------------------------------------------------------------ devices */

export const createDeviceOnServer = (device: Device) =>
  request<Device>('/api/devices', jsonOptions('POST', device))

export const updateDeviceOnServer = (id: string, changes: Partial<Device>) =>
  request<Device>(`/api/devices/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

export const deleteDeviceOnServer = (id: string) =>
  request<void>(`/api/devices/${encodeURIComponent(id)}`, { method: 'DELETE' })

export const uploadDocumentToServer = (deviceId: string, file: File, type: DocumentType) => {
  const body = new FormData()
  body.append('file', file)
  body.append('type', type)
  return request<{ document: Device['documents'][number]; device: Device }>(
    `/api/devices/${encodeURIComponent(deviceId)}/documents`,
    { method: 'POST', body },
  )
}

export const deleteDocumentOnServer = (deviceId: string, documentId: string) =>
  request<Device>(
    `/api/devices/${encodeURIComponent(deviceId)}/documents/${encodeURIComponent(documentId)}`,
    { method: 'DELETE' },
  )

/* ---------------------------------------------------------------- incidents */

export const createIncidentOnServer = (incident: Incident) =>
  request<Incident>('/api/incidents', jsonOptions('POST', incident))

export const uploadIncidentPhotoToServer = (incidentId: string, file: File) => {
  const body = new FormData()
  body.append('file', file)
  return request<Incident>(`/api/incidents/${encodeURIComponent(incidentId)}/photos`, { method: 'POST', body })
}

export const updateIncidentOnServer = (id: string, changes: Partial<Incident>) =>
  request<Incident>(`/api/incidents/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

/* ------------------------------------------------------------------- events */

export const createEventOnServer = (event: MaintenanceEvent) =>
  request<MaintenanceEvent>('/api/events', jsonOptions('POST', event))

export const updateEventOnServer = (id: string, changes: Partial<MaintenanceEvent>) =>
  request<MaintenanceEvent>(`/api/events/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

export const deleteEventOnServer = (id: string) =>
  request<void>(`/api/events/${encodeURIComponent(id)}`, { method: 'DELETE' })

/* -------------------------------------------------------------- departments */

export const createDepartmentOnServer = (department: Partial<Department>) =>
  request<Department>('/api/departments', jsonOptions('POST', department))

export const updateDepartmentOnServer = (id: string, changes: Partial<Department>) =>
  request<Department>(`/api/departments/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

export const deleteDepartmentOnServer = (id: string) =>
  request<void>(`/api/departments/${encodeURIComponent(id)}`, { method: 'DELETE' })

/* -------------------------------------------------------------- permissions */

export const updatePermissionOnServer = (id: string, changes: Partial<AccessPermission>) =>
  request<AccessPermission>(`/api/permissions/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

/* -------------------------------------------------------------------- users */

export const createUserOnServer = (user: Partial<UserAccount> & { password?: string }) =>
  request<UserAccount>('/api/users', jsonOptions('POST', user))

export const updateUserOnServer = (id: string, changes: Partial<UserAccount> & { password?: string }) =>
  request<UserAccount>(`/api/users/${encodeURIComponent(id)}`, jsonOptions('PATCH', changes))

export const deleteUserOnServer = (id: string) =>
  request<void>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
