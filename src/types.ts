export type ViewId =
  | 'dashboard'
  | 'devices'
  | 'incidents'
  | 'maintenance'
  | 'reports'
  | 'organization'

export type DeviceStatus =
  | 'Đang hoạt động'
  | 'Đang sửa chữa'
  | 'Chờ bảo trì'
  | 'Ngừng sử dụng'

export type IncidentStatus =
  | 'Mới tiếp nhận'
  | 'Đang xử lý'
  | 'Chờ linh kiện'
  | 'Đã hoàn tất'

export type Priority = 'Khẩn cấp' | 'Cao' | 'Trung bình' | 'Thấp'

export type BranchId = 'cu-chi' | 'tay-ninh' | 'long-an' | 'vinh-long' | 'tay-nguyen'

export interface Branch {
  id: BranchId
  name: string
  shortName: string
  region: string
  inventoryCount: number
}

export interface Department {
  id: string
  branchId: BranchId
  name: string
  shortName: string
  head: string
  phone: string
}

export type DocumentType =
  | 'Hợp đồng'
  | 'Nghiệm thu'
  | 'Hóa đơn'
  | 'Bảo hành'
  | 'Bảo trì'
  | 'Kiểm định'
  | 'Khác'

export const documentTypes: DocumentType[] = [
  'Hợp đồng',
  'Nghiệm thu',
  'Hóa đơn',
  'Bảo hành',
  'Bảo trì',
  'Kiểm định',
  'Khác',
]

export interface DeviceDocument {
  id: string
  name: string
  type: DocumentType
  size: string
  uploadedAt: string
  url?: string
}

export interface Device {
  id: string
  branchId: BranchId
  code: string
  hisCode: string
  name: string
  category: string
  model: string
  serial: string
  manufacturer: string
  origin: string
  manufactureYear: number
  usageDate: string
  contractDate: string
  handoverDate: string
  acceptanceDate: string
  warrantyStart: string
  warrantyEnd: string
  maintenanceCycle: number
  nextMaintenance: string
  company: string
  department: string
  room: string
  supplier: string
  price: number
  status: DeviceStatus
  shared: boolean
  documents: DeviceDocument[]
  lastUpdated: string
}

export interface IncidentNote {
  id: string
  author: string
  content: string
  time: string
}

export interface Incident {
  id: string
  code: string
  deviceId: string
  title: string
  description: string
  priority: Priority
  status: IncidentStatus
  reporter: string
  reporterDepartment: string
  createdAt: string
  assignee: string
  nextActionDate?: string
  hasPhoto: boolean
  photos?: Array<{
    id: string
    name: string
    size: string
    url: string
  }>
  notes: IncidentNote[]
}

export interface MaintenanceEvent {
  id: string
  deviceId: string
  type: 'Bảo trì định kỳ' | 'Bảo hành' | 'Hiệu chuẩn' | 'Sửa chữa'
  date: string
  time: string
  provider: string
  assignee: string
  reminderDays: number
  status: 'Sắp tới' | 'Đang thực hiện' | 'Hoàn tất' | 'Quá hạn'
  note: string
}

export interface OrganizationUnit {
  id: string
  name: string
  type: 'company' | 'department' | 'room'
  count: number
  children?: OrganizationUnit[]
}

export interface AccessPermission {
  id: string
  branchId: BranchId
  name: string
  users: number
  view: boolean
  borrow: boolean
  approve: boolean
}

export type UserRole = 'admin' | 'moderator' | 'department'

export interface UserAccount {
  id: string
  username: string
  displayName: string
  role: UserRole
  branchId?: BranchId
  department?: string
  active: boolean
  lastLogin?: string
}

export type AlertKind = 'incident' | 'maintenance-overdue' | 'maintenance-soon' | 'warranty' | 'follow-up'

export interface AlertItem {
  id: string
  kind: AlertKind
  severity: 'danger' | 'warning' | 'info'
  title: string
  detail: string
  meta: string
  view: ViewId
  deviceId?: string
  incidentId?: string
  eventId?: string
}

export const roleLabel = (role: UserRole) =>
  role === 'admin' ? 'Admin tổng' : role === 'moderator' ? 'Quản lý chi nhánh' : 'Tài khoản khoa'
