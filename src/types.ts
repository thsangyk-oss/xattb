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
  | 'Đã nhận về khoa'

/** Bốn hình thức xử lý một sự cố; có thể chuyển qua lại và mỗi lần chuyển đều để lại dấu vết. */
export type RepairType = 'Tự sửa' | 'Báo công ty' | 'Chuyển về Hệ thống' | 'Thay mới'

export const repairTypes: RepairType[] = ['Tự sửa', 'Báo công ty', 'Chuyển về Hệ thống', 'Thay mới']

export const repairTypeHints: Record<RepairType, string> = {
  'Tự sửa': 'Phòng TTBYT tự khắc phục tại chỗ',
  'Báo công ty': 'Gọi nhà cung cấp / hãng đến xử lý',
  'Chuyển về Hệ thống': 'Chuyển thiết bị về xưởng của hệ thống',
  'Thay mới': 'Không sửa được, đề xuất thay thiết bị mới',
}

/** Dấu vết mỗi lần đổi hình thức sửa chữa: đổi sang gì, lúc nào, ai đổi. */
export interface RepairFootprint {
  id: string
  from: RepairType | null
  to: RepairType
  at: string
  by: string
  note?: string
}

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
  /** Chỉ admin tổng nhận được trường này; máy chủ lược bỏ với mọi vai trò khác. */
  price?: number
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
  /** Hình thức xử lý đang áp dụng; chưa chọn nghĩa là mới tiếp nhận, chưa quyết định hướng sửa. */
  repairType?: RepairType
  /** Ngày xác nhận sửa chữa — bắt buộc cho mọi hình thức. */
  repairConfirmDate?: string
  /** Thời điểm bấm “Hoàn thành sửa chữa”. */
  repairCompletedAt?: string
  /** Thời điểm khoa bấm “Nhận về lại khoa”. */
  returnedAt?: string
  repairHistory?: RepairFootprint[]
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

export type AlertKind =
  | 'incident'
  | 'maintenance-overdue'
  | 'maintenance-soon'
  | 'warranty'
  | 'warranty-overdue'
  | 'follow-up'

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
  /**
   * Ưu tiên khẩn: lịch bảo trì/bảo hành đã quá hạn mà chưa có xác nhận đã bảo.
   * Những mục này được nhắc lại mỗi ngày với moderator và tài khoản khoa.
   */
  urgent?: boolean
}

export const roleLabel = (role: UserRole) =>
  role === 'admin' ? 'Admin tổng' : role === 'moderator' ? 'Quản lý chi nhánh' : 'Tài khoản khoa'
