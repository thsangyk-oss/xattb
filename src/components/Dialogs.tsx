import { useMemo, useState, type FormEvent } from 'react'
import {
  ArrowLeftRight,
  BellRing,
  CalendarClock,
  Camera,
  CheckCircle2,
  ClipboardCheck,
  Copy,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  History,
  ImagePlus,
  Info,
  KeyRound,
  Link2,
  Lock,
  MapPin,
  MessageSquarePlus,
  PackageCheck,
  Pencil,
  Plus,
  Printer,
  QrCode,
  Save,
  ScanLine,
  ShieldCheck,
  Siren,
  Trash2,
  UploadCloud,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type {
  AlertItem,
  Branch,
  BranchId,
  Department,
  Device,
  DocumentType,
  Incident,
  IncidentStatus,
  MaintenanceEvent,
  Priority,
  RepairType,
  UserAccount,
} from '../types'
import { documentTypes, repairTypeHints, repairTypes } from '../types'
import { defaultUserPassword, departmentCatalog, hospitalName, slugify } from '../data'
import { dueLabel, formatCurrency, formatDate, formatDateTime, getDeviceById, isoOffset, todayIso } from '../utils'
import { DetailRow, DeviceVisual, EmptyState, Modal, StatusBadge } from './Shared'

const deviceCategories = [
  'Hô hấp',
  'Chẩn đoán hình ảnh',
  'Theo dõi bệnh nhân',
  'Tiêm truyền',
  'Xét nghiệm',
  'Gây mê hồi sức',
  'Nội soi',
  'Tim mạch',
  'Lọc máu',
  'Phẫu thuật',
  'Kiểm soát nhiễm khuẩn',
  'Khác',
]

/* ------------------------------------------------------------ device detail */

export function DeviceDetailDialog({
  device,
  incidents,
  events,
  canManage,
  canSeePrice,
  onClose,
  onShowQr,
  onEdit,
  onDelete,
  onAddDocument,
  onRemoveDocument,
  onToggleShared,
  onReport,
  onToast,
}: {
  device: Device
  incidents: Incident[]
  events: MaintenanceEvent[]
  canManage: boolean
  canSeePrice: boolean
  onClose: () => void
  onShowQr: () => void
  onEdit: () => void
  onDelete: () => void
  onAddDocument: (file: File, type: DocumentType) => void
  onRemoveDocument: (documentId: string) => void
  onToggleShared: () => void
  onReport: () => void
  onToast: (message: string) => void
}) {
  const [tab, setTab] = useState<'overview' | 'documents' | 'history'>('overview')
  const [uploadType, setUploadType] = useState<DocumentType>('Hợp đồng')
  const deviceIncidents = incidents.filter((incident) => incident.deviceId === device.id)
  const deviceEvents = events.filter((event) => event.deviceId === device.id)

  return (
    <Modal
      title={device.name}
      eyebrow={`${device.code} · ${device.department}`}
      width="drawer"
      onClose={onClose}
      footer={
        <>
          <button className="button ghost" type="button" onClick={onShowQr}><QrCode size={17} /> Mã QR</button>
          <button className="button secondary" type="button" onClick={onReport}><Siren size={16} /> Báo hỏng</button>
          {canManage && <button className="button primary" type="button" onClick={onEdit}><Pencil size={16} /> Sửa hồ sơ</button>}
        </>
      }
    >
      <div className="device-detail-hero">
        <DeviceVisual category={device.category} size="lg" />
        <div>
          <StatusBadge label={device.status} />
          <h3>{device.name}</h3>
          <p>{device.manufacturer} · {device.model}</p>
          <div className="device-identity"><span>{device.code}</span><span>S/N: {device.serial}</span><span>HIS: {device.hisCode}</span></div>
        </div>
      </div>

      <div className="detail-tabs segmented-tabs">
        <button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')} type="button">Tổng quan</button>
        <button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')} type="button">Tài liệu <b>{device.documents.length}</b></button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')} type="button">Lịch sử <b>{deviceIncidents.length + deviceEvents.length}</b></button>
      </div>

      {tab === 'overview' && (
        <div className="detail-tab-content">
          <section className="detail-section">
            <h4><Info size={16} /> Thông tin nhận dạng</h4>
            <div className="detail-grid">
              <DetailRow label="Mã thiết bị" value={device.code} />
              <DetailRow label="Mã máy / HIS" value={device.hisCode} />
              <DetailRow label="Model" value={device.model} />
              <DetailRow label="Số seri" value={device.serial} />
              <DetailRow label="Hãng sản xuất" value={device.manufacturer} />
              <DetailRow label="Nước sản xuất" value={device.origin} />
              <DetailRow label="Năm sản xuất" value={device.manufactureYear} />
              <DetailRow label="Nhóm thiết bị" value={device.category} />
            </div>
          </section>

          <section className="detail-section location-section">
            <h4><MapPin size={16} /> Đơn vị sử dụng</h4>
            <div className="location-card">
              <span><MapPin size={18} /></span>
              <div><strong>{device.department}</strong><p>{device.room} · {device.company}</p></div>
            </div>
            <div className="sharing-row">
              <div>
                <strong>Cho khoa khác xem và mượn</strong>
                <span>Thiết bị sẽ hiện trong danh mục dùng chung của chi nhánh</span>
              </div>
              <button
                className={`switch-control ${device.shared ? 'on' : ''}`}
                type="button"
                onClick={onToggleShared}
                disabled={!canManage}
                title={canManage ? 'Bật/tắt quyền xem liên khoa' : 'Chỉ Phòng TTBYT được thay đổi'}
                aria-label="Đổi trạng thái chia sẻ"
              >
                <span />
              </button>
            </div>
          </section>

          <section className="detail-section">
            <h4><CalendarClock size={16} /> Các mốc hồ sơ</h4>
            <div className="milestone-list">
              <div><span><FileText size={15} /></span><p>Ngày ký hợp đồng<small>{formatDate(device.contractDate)}</small></p></div>
              <div><span><PackageCheck size={15} /></span><p>Ngày bàn giao<small>{formatDate(device.handoverDate)}</small></p></div>
              <div><span><ClipboardCheck size={15} /></span><p>Ngày nghiệm thu<small>{formatDate(device.acceptanceDate)}</small></p></div>
              <div><span><CheckCircle2 size={15} /></span><p>Đưa vào sử dụng<small>{formatDate(device.usageDate)}</small></p></div>
              <div><span><ShieldCheck size={15} /></span><p>Bảo hành<small>{formatDate(device.warrantyStart)} → {formatDate(device.warrantyEnd)}</small></p></div>
              <div className="highlight"><span><Wrench size={15} /></span><p>Bảo trì tiếp theo<small>{formatDate(device.nextMaintenance)} · {dueLabel(device.nextMaintenance)} · chu kỳ {device.maintenanceCycle} tháng</small></p></div>
            </div>
          </section>

          <section className="detail-section">
            <h4><FileCheck2 size={16} /> Mua sắm{canSeePrice ? ' & tài chính' : ''}</h4>
            <div className="detail-grid">
              <DetailRow label="Công ty cung cấp" value={device.supplier} />
              {canSeePrice
                ? <DetailRow label="Nguyên giá" value={formatCurrency(device.price)} />
                : <DetailRow label="Nguyên giá" value={<span className="value-restricted"><Lock size={12} /> Chỉ admin tổng xem được</span>} />}
            </div>
          </section>

          {canManage && (
            <button className="danger-link" type="button" onClick={onDelete}>
              <Trash2 size={15} /> Xóa hồ sơ thiết bị
            </button>
          )}
        </div>
      )}

      {tab === 'documents' && (
        <div className="detail-tab-content document-tab">
          {canManage ? (
            <>
              <div className="document-type-picker">
                <span>Loại tài liệu sắp tải lên</span>
                <div>
                  {documentTypes.map((type) => (
                    <button
                      key={type}
                      type="button"
                      className={uploadType === type ? 'active' : ''}
                      onClick={() => setUploadType(type)}
                    >
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <label className="document-upload">
                <UploadCloud size={25} />
                <strong>Tải bản scan «{uploadType}»</strong>
                <span>PDF, DOCX, XLSX, JPG hoặc PNG · tối đa 20 MB</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.webp"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) onAddDocument(file, uploadType)
                    event.target.value = ''
                  }}
                />
              </label>
            </>
          ) : (
            <div className="form-info"><ShieldCheck size={17} /><span>Tài khoản khoa chỉ xem tài liệu. Liên hệ Phòng TTBYT để bổ sung hồ sơ.</span></div>
          )}

          {device.documents.length ? (
            <div className="document-list">
              {device.documents.map((item) => (
                <article key={item.id}>
                  <span className="pdf-icon"><FileText size={19} /></span>
                  <div>
                    <strong>{item.name}</strong>
                    <small><b className="doc-type">{item.type}</b> · {item.size} · {item.uploadedAt}</small>
                  </div>
                  <button
                    className="icon-button compact"
                    type="button"
                    onClick={() => item.url
                      ? window.open(item.url, '_blank', 'noopener,noreferrer')
                      : onToast('Tài liệu mẫu chưa có bản scan trên máy chủ')}
                    aria-label="Mở tài liệu"
                  >
                    <Download size={17} />
                  </button>
                  {canManage && item.url && (
                    <button className="icon-button compact danger" type="button" onClick={() => onRemoveDocument(item.id)} aria-label="Xóa tài liệu">
                      <Trash2 size={16} />
                    </button>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <EmptyState title="Chưa có tài liệu" detail="Tải bản scan hợp đồng, nghiệm thu, hóa đơn hoặc biên bản bảo hành lên hồ sơ này." />
          )}
        </div>
      )}

      {tab === 'history' && (
        <div className="detail-tab-content history-tab">
          {deviceIncidents.map((incident) => (
            <article className="history-entry" key={incident.id}>
              <span><History size={17} /></span>
              <div>
                <div><strong>{incident.title}</strong><StatusBadge label={incident.status} /></div>
                <p>{incident.description}</p>
                <small>{incident.code} · {formatDateTime(incident.createdAt)} · {incident.reporter}</small>
              </div>
            </article>
          ))}
          {deviceEvents.map((event) => (
            <article className="history-entry routine" key={event.id}>
              <span><Wrench size={17} /></span>
              <div>
                <div><strong>{event.type}</strong><StatusBadge label={event.status} /></div>
                <p>{event.note}</p>
                <small>{formatDate(event.date)} · {event.provider}</small>
              </div>
            </article>
          ))}
          {!deviceIncidents.length && !deviceEvents.length && (
            <EmptyState title="Chưa có lịch sử" detail="Thiết bị chưa ghi nhận sự cố hay lịch bảo trì nào." />
          )}
        </div>
      )}
    </Modal>
  )
}

/* -------------------------------------------------------------- device form */

export function DeviceFormDialog({
  device,
  branches,
  departments,
  defaultBranchId,
  canSeePrice,
  onClose,
  onSave,
}: {
  device: Device | null
  branches: Branch[]
  departments: string[]
  defaultBranchId: BranchId
  canSeePrice: boolean
  onClose: () => void
  onSave: (device: Device) => void
}) {
  const isEdit = Boolean(device)
  const departmentOptions = departments.length ? departments : departmentCatalog.map((item) => item.name)

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const text = (key: string) => String(form.get(key) ?? '').trim()
    onSave({
      id: device?.id ?? `dev-${Date.now()}`,
      code: text('code'),
      hisCode: text('hisCode') || 'Chưa đồng bộ',
      name: text('name'),
      category: text('category'),
      model: text('model'),
      serial: text('serial'),
      manufacturer: text('manufacturer'),
      origin: text('origin'),
      manufactureYear: Number(form.get('manufactureYear')),
      contractDate: text('contractDate'),
      handoverDate: text('handoverDate'),
      acceptanceDate: text('acceptanceDate'),
      usageDate: text('usageDate'),
      warrantyStart: text('warrantyStart'),
      warrantyEnd: text('warrantyEnd'),
      maintenanceCycle: Number(form.get('maintenanceCycle')),
      nextMaintenance: text('nextMaintenance'),
      branchId: (text('branchId') || defaultBranchId) as BranchId,
      company: hospitalName,
      department: text('department'),
      room: text('room'),
      supplier: text('supplier'),
      // Không gửi trường giá nếu tài khoản không được xem — tránh ghi đè giá đang lưu bằng 0.
      ...(canSeePrice ? { price: Number(form.get('price')) || 0 } : {}),
      status: (text('status') || 'Đang hoạt động') as Device['status'],
      shared: form.get('shared') === 'on',
      documents: device?.documents ?? [],
      lastUpdated: new Date().toISOString(),
    })
  }

  return (
    <Modal
      title={isEdit ? 'Sửa hồ sơ thiết bị' : 'Thêm thiết bị mới'}
      eyebrow={isEdit ? device!.code : 'Hồ sơ tài sản'}
      width="large"
      onClose={onClose}
    >
      <form className="entity-form" onSubmit={handleSubmit}>
        <section>
          <h3><ScanLine size={17} /> Nhận dạng thiết bị</h3>
          <div className="form-grid">
            <label className="span-2">Tên thiết bị <input name="name" required defaultValue={device?.name} placeholder="Ví dụ: Máy thở chức năng cao" /></label>
            <label>Mã thiết bị <input name="code" required defaultValue={device?.code} placeholder="TBYT-HSTC-001" /></label>
            <label>Mã máy / Mã HIS <input name="hisCode" defaultValue={device?.hisCode} placeholder="HIS-92104" /></label>
            <label>Nhóm thiết bị
              <select name="category" defaultValue={device?.category ?? 'Hô hấp'}>
                {deviceCategories.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Tình trạng
              <select name="status" defaultValue={device?.status ?? 'Đang hoạt động'}>
                <option>Đang hoạt động</option><option>Đang sửa chữa</option><option>Chờ bảo trì</option><option>Ngừng sử dụng</option>
              </select>
            </label>
            <label>Model <input name="model" required defaultValue={device?.model} placeholder="Model thiết bị" /></label>
            <label>Số seri <input name="serial" required defaultValue={device?.serial} placeholder="Số seri" /></label>
            <label>Hãng sản xuất <input name="manufacturer" required defaultValue={device?.manufacturer} placeholder="Tên hãng" /></label>
            <label>Nước sản xuất <input name="origin" required defaultValue={device?.origin} placeholder="Quốc gia" /></label>
            <label>Năm sản xuất <input name="manufactureYear" type="number" min="1980" max="2100" required defaultValue={device?.manufactureYear ?? new Date().getFullYear()} /></label>
          </div>
        </section>

        <section>
          <h3><MapPin size={17} /> Đơn vị & vị trí sử dụng</h3>
          <div className="form-grid">
            <label className="span-2">Chi nhánh
              <select name="branchId" defaultValue={device?.branchId ?? defaultBranchId} disabled={branches.length === 1}>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name} · {branch.region}</option>)}
              </select>
            </label>
            <label>Khoa/phòng
              <select name="department" defaultValue={device?.department ?? departmentOptions[0]}>
                {departmentOptions.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label>Phòng sử dụng <input name="room" required defaultValue={device?.room} placeholder="Ví dụ: ICU 01" /></label>
            <label className="span-2 check-label">
              <input name="shared" type="checkbox" defaultChecked={device?.shared} />
              <span /> Cho phép khoa/phòng khác xem và gửi yêu cầu mượn thiết bị
            </label>
          </div>
        </section>

        <section>
          <h3><CalendarClock size={17} /> Hợp đồng & vòng đời</h3>
          <div className="form-grid">
            <label>Ngày ký hợp đồng <input name="contractDate" type="date" required defaultValue={device?.contractDate} /></label>
            <label>Ngày bàn giao <input name="handoverDate" type="date" required defaultValue={device?.handoverDate} /></label>
            <label>Ngày nghiệm thu <input name="acceptanceDate" type="date" required defaultValue={device?.acceptanceDate} /></label>
            <label>Ngày đưa vào sử dụng <input name="usageDate" type="date" required defaultValue={device?.usageDate} /></label>
            <label>Bảo hành từ <input name="warrantyStart" type="date" required defaultValue={device?.warrantyStart} /></label>
            <label>Bảo hành đến <input name="warrantyEnd" type="date" required defaultValue={device?.warrantyEnd} /></label>
            <label>Chu kỳ bảo trì
              <select name="maintenanceCycle" defaultValue={String(device?.maintenanceCycle ?? 6)}>
                <option value="3">3 tháng</option><option value="6">6 tháng</option><option value="12">12 tháng</option>
              </select>
            </label>
            <label>Bảo trì tiếp theo <input name="nextMaintenance" type="date" required defaultValue={device?.nextMaintenance} /></label>
            <label className="span-2">Công ty cung cấp <input name="supplier" required defaultValue={device?.supplier} placeholder="Tên nhà cung cấp" /></label>
            {canSeePrice && (
              <label>Nguyên giá (VNĐ) <input name="price" type="number" min="0" step="1000" required defaultValue={device?.price ?? 0} /></label>
            )}
          </div>
          {!canSeePrice && (
            <div className="form-info"><Lock size={17} /><span>Nguyên giá thiết bị do admin tổng quản lý và không hiển thị ở tài khoản này. Các thông tin còn lại bạn vẫn sửa được bình thường.</span></div>
          )}
        </section>

        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button primary" type="submit"><Save size={17} /> {isEdit ? 'Lưu thay đổi' : 'Lưu thiết bị'}</button>
        </footer>
      </form>
    </Modal>
  )
}

/* --------------------------------------------------------------- user form */

export function UserAccountDialog({
  branches,
  departments,
  currentUser,
  onClose,
  onCreate,
}: {
  branches: Branch[]
  departments: Department[]
  currentUser: UserAccount
  onClose: () => void
  onCreate: (user: Partial<UserAccount> & { password: string }) => void
}) {
  const canCreateModerator = currentUser.role === 'admin'
  const [role, setRole] = useState<'moderator' | 'department'>(canCreateModerator ? 'department' : 'department')
  const [branchId, setBranchId] = useState<BranchId>(
    (currentUser.role === 'moderator' ? currentUser.branchId : branches[0]?.id) ?? 'cu-chi',
  )
  const branchDepartments = useMemo(
    () => departments.filter((item) => item.branchId === branchId),
    [branchId, departments],
  )
  const [department, setDepartment] = useState(branchDepartments[0]?.name ?? '')
  const [username, setUsername] = useState('')
  const [touchedUsername, setTouchedUsername] = useState(false)

  const activeDepartment = branchDepartments.some((item) => item.name === department)
    ? department
    : branchDepartments[0]?.name ?? ''

  const suggestedUsername = role === 'moderator'
    ? `moderator-${branchId}`
    : activeDepartment
      ? `${slugify(branchDepartments.find((item) => item.name === activeDepartment)?.shortName ?? activeDepartment)}.${branchId}`
      : ''

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onCreate({
      username: (touchedUsername ? username : suggestedUsername).trim().toLowerCase(),
      displayName: String(form.get('displayName') || '').trim(),
      role,
      branchId,
      department: role === 'department' ? activeDepartment : undefined,
      active: true,
      password: defaultUserPassword,
    })
  }

  return (
    <Modal title="Tạo tài khoản mới" eyebrow="Phân quyền truy cập" width="small" onClose={onClose}>
      <form className="entity-form" onSubmit={handleSubmit}>
        <section>
          <h3><UserRound size={17} /> Loại tài khoản</h3>
          <div className="role-picker">
            {canCreateModerator && (
              <button type="button" className={role === 'moderator' ? 'active' : ''} onClick={() => setRole('moderator')}>
                <strong>Quản lý chi nhánh</strong>
                <small>Toàn quyền trong 1 chi nhánh</small>
              </button>
            )}
            <button type="button" className={role === 'department' ? 'active' : ''} onClick={() => setRole('department')}>
              <strong>Tài khoản khoa</strong>
              <small>Chỉ xem và báo hỏng thiết bị của khoa</small>
            </button>
          </div>
        </section>

        <section>
          <div className="form-grid">
            <label className="span-2">Chi nhánh
              <select
                value={branchId}
                onChange={(event) => setBranchId(event.target.value as BranchId)}
                disabled={currentUser.role !== 'admin'}
              >
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
              </select>
            </label>
            {role === 'department' && (
              <label className="span-2">Khoa/phòng phụ trách
                <select value={activeDepartment} onChange={(event) => setDepartment(event.target.value)} required>
                  {branchDepartments.map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                </select>
              </label>
            )}
            <label className="span-2">Tên hiển thị
              <input name="displayName" required placeholder={role === 'moderator' ? 'Ví dụ: Quản lý Củ Chi' : 'Ví dụ: Khoa Cấp cứu · Củ Chi'} />
            </label>
            <label className="span-2">Tên đăng nhập
              <input
                value={touchedUsername ? username : suggestedUsername}
                onChange={(event) => { setTouchedUsername(true); setUsername(event.target.value) }}
                required
                pattern="[a-zA-Z0-9._-]+"
                placeholder="tendangnhap"
              />
            </label>
          </div>
        </section>

        <div className="form-info">
          <ShieldCheck size={17} />
          <span>Mật khẩu khởi tạo: <strong>{defaultUserPassword}</strong>. Người dùng nên đổi mật khẩu ở lần đăng nhập đầu tiên.</span>
        </div>

        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button primary" type="submit" disabled={role === 'department' && !activeDepartment}>
            <Save size={17} /> Tạo tài khoản
          </button>
        </footer>
      </form>
    </Modal>
  )
}

/* ---------------------------------------------------------------- password */

export function PasswordDialog({
  onClose,
  onSubmit,
}: {
  onClose: () => void
  onSubmit: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (next !== confirm) {
      setError('Mật khẩu xác nhận không khớp')
      return
    }
    setBusy(true)
    setError(null)
    try {
      await onSubmit(current, next)
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Không thể đổi mật khẩu')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Đổi mật khẩu" eyebrow="Bảo mật tài khoản" width="small" onClose={onClose}>
      <form className="entity-form" onSubmit={submit}>
        <section>
          <div className="form-grid">
            <label className="span-2">Mật khẩu hiện tại <input type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required autoComplete="current-password" /></label>
            <label className="span-2">Mật khẩu mới <input type="password" value={next} onChange={(event) => setNext(event.target.value)} required minLength={6} autoComplete="new-password" /></label>
            <label className="span-2">Nhập lại mật khẩu mới <input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required minLength={6} autoComplete="new-password" /></label>
          </div>
        </section>
        {error && <div className="login-error"><KeyRound size={15} />{error}</div>}
        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button primary" type="submit" disabled={busy}><Save size={17} /> {busy ? 'Đang lưu...' : 'Cập nhật'}</button>
        </footer>
      </form>
    </Modal>
  )
}

/* --------------------------------------------------- nhắc việc quá hạn */

/**
 * Nhắc mỗi ngày khi moderator / tài khoản khoa đăng nhập, chừng nào còn lịch
 * bảo trì hoặc bảo hành quá hạn chưa được xác nhận. Admin tổng không thấy hộp
 * thoại này — quản lý toàn hệ thống nên chỉ nhận cảnh báo trong chuông thông báo.
 */
export function OverdueReminderDialog({
  alerts,
  userName,
  onOpenAlert,
  onDismiss,
}: {
  alerts: AlertItem[]
  userName: string
  onOpenAlert: (alert: AlertItem) => void
  onDismiss: () => void
}) {
  return (
    <Modal
      title="Nhắc việc khẩn hôm nay"
      eyebrow={`${userName} · ${formatDate(todayIso())}`}
      width="small"
      onClose={onDismiss}
      footer={<button className="button primary" type="button" onClick={onDismiss}>Đã hiểu, nhắc lại vào ngày mai</button>}
    >
      <div className="overdue-reminder">
        <div className="overdue-reminder-head">
          <span><Siren size={22} /></span>
          <div>
            <strong>{alerts.length} việc quá hạn chưa có xác nhận</strong>
            <p>Bảo trì và bảo hành đã quá hạn được xếp mức ưu tiên khẩn. Hộp thoại này sẽ hiện lại mỗi lần đăng nhập trong ngày mới cho tới khi các mục dưới đây được xác nhận hoàn tất.</p>
          </div>
        </div>
        <div className="overdue-reminder-list">
          {alerts.slice(0, 8).map((alert) => (
            <button type="button" key={alert.id} onClick={() => onOpenAlert(alert)}>
              <span className="overdue-flag">KHẨN</span>
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.detail}</small>
                <small className="overdue-meta">{alert.meta}</small>
              </div>
            </button>
          ))}
        </div>
        {alerts.length > 8 && <p className="overdue-more">+{alerts.length - 8} mục khẩn khác trong trung tâm cảnh báo.</p>}
      </div>
    </Modal>
  )
}

/* ---------------------------------------------------------------------- QR */

export function QrDialog({ device, onClose, onToast }: { device: Device; onClose: () => void; onToast: (message: string) => void }) {
  const reportUrl = `${window.location.origin}${window.location.pathname}?device=${encodeURIComponent(device.id)}`

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(reportUrl)
      onToast('Đã sao chép liên kết báo hỏng')
    } catch {
      onToast('Trình duyệt không cho phép sao chép tự động')
    }
  }

  return (
    <Modal title="Tem QR thiết bị" eyebrow={device.code} width="small" onClose={onClose}>
      <div className="qr-dialog">
        <div className="qr-device">
          <DeviceVisual category={device.category} />
          <div><strong>{device.name}</strong><span>{device.department} · {device.room}</span></div>
        </div>
        <div className="qr-paper" id="device-qr">
          <QRCodeSVG value={reportUrl} size={214} level="H" fgColor="#0f2a24" bgColor="#ffffff" includeMargin />
          <strong>{device.code}</strong>
          <span>Quét để báo hỏng thiết bị</span>
        </div>
        <div className="qr-help">
          <Camera size={18} />
          <p>Người sử dụng không cần đăng nhập. Biểu mẫu tự điền thông tin thiết bị và cho phép chụp ảnh lỗi.</p>
        </div>
        <div className="qr-link">
          <Link2 size={15} /><span>{reportUrl}</span>
          <button type="button" onClick={copyUrl} aria-label="Sao chép liên kết"><Copy size={15} /></button>
        </div>
        <div className="qr-actions">
          <button className="button secondary" type="button" onClick={() => window.print()}><Printer size={16} /> In tem QR</button>
          <button className="button primary" type="button" onClick={() => window.open(reportUrl, '_blank')}><ExternalLink size={16} /> Mở biểu mẫu</button>
        </div>
      </div>
    </Modal>
  )
}

/* ----------------------------------------------------------- new incident */

export function NewIncidentDialog({
  devices,
  preselectedDeviceId,
  reporterName,
  onClose,
  onCreate,
}: {
  devices: Device[]
  preselectedDeviceId?: string
  reporterName?: string
  onClose: () => void
  onCreate: (incident: Incident, photo?: File) => void
}) {
  const [priority, setPriority] = useState<Priority>('Cao')
  const [photo, setPhoto] = useState<File | undefined>()

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const deviceId = String(form.get('deviceId'))
    const device = getDeviceById(devices, deviceId)
    const stamp = Date.now()
    onCreate({
      id: `inc-${stamp}`,
      code: `SC-${new Date().getFullYear()}-${String(stamp).slice(-4)}`,
      deviceId,
      title: String(form.get('title')),
      description: String(form.get('description')),
      priority,
      status: 'Mới tiếp nhận',
      reporter: String(form.get('reporter')),
      reporterDepartment: device?.department ?? '',
      createdAt: new Date().toISOString(),
      assignee: 'Chưa phân công',
      nextActionDate: String(form.get('nextActionDate') || todayIso()),
      hasPhoto: Boolean(photo),
      notes: [],
    }, photo)
  }

  return (
    <Modal title="Báo hỏng thiết bị" eyebrow="Yêu cầu sửa chữa mới" width="medium" onClose={onClose}>
      <form className="entity-form incident-form" onSubmit={handleSubmit}>
        <section>
          <h3><ScanLine size={17} /> Thiết bị báo hỏng</h3>
          <div className="form-grid">
            <label className="span-2">Thiết bị
              <select name="deviceId" defaultValue={preselectedDeviceId ?? ''} required>
                <option value="" disabled>Chọn thiết bị</option>
                {devices.map((device) => <option value={device.id} key={device.id}>{device.code} — {device.name} ({device.department})</option>)}
              </select>
            </label>
            <label className="span-2">Tiêu đề sự cố <input name="title" required placeholder="Mô tả ngắn tình trạng hư hỏng" /></label>
            <label className="span-2">Mô tả chi tiết <textarea name="description" rows={4} required placeholder="Hiện tượng lỗi, thời điểm xảy ra và thao tác đã thử..." /></label>
          </div>
        </section>

        <section>
          <h3><BellRing size={17} /> Mức độ ưu tiên</h3>
          <div className="priority-picker">
            {(['Khẩn cấp', 'Cao', 'Trung bình', 'Thấp'] as Priority[]).map((item) => (
              <button className={priority === item ? 'active' : ''} type="button" key={item} onClick={() => setPriority(item)}>
                <span />{item}
              </button>
            ))}
          </div>
        </section>

        <section>
          <h3><UserRound size={17} /> Người báo & minh chứng</h3>
          <div className="form-grid">
            <label>Người báo <input name="reporter" required defaultValue={reporterName} placeholder="Họ tên người báo" /></label>
            <label>Ngày cần xử lý <input name="nextActionDate" type="date" defaultValue={isoOffset(1)} /></label>
            <label className="span-2 photo-upload">
              <ImagePlus size={21} />
              <span><strong>{photo?.name || 'Thêm ảnh hư hỏng'}</strong><small>Chụp ảnh hoặc chọn JPG, PNG</small></span>
              <input type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0])} />
            </label>
          </div>
        </section>

        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button primary danger-button" type="submit"><Siren size={17} /> Gửi báo cáo sự cố</button>
        </footer>
      </form>
    </Modal>
  )
}

/* -------------------------------------------------------- incident detail */

export function IncidentDetailDialog({
  incident,
  devices,
  canManage,
  onClose,
  onUpdateStatus,
  onAssign,
  onAddNote,
  onSetRepairType,
  onCompleteRepair,
  onReceiveBack,
}: {
  incident: Incident
  devices: Device[]
  canManage: boolean
  onClose: () => void
  onUpdateStatus: (status: IncidentStatus) => void
  onAssign: (assignee: string) => void
  onAddNote: (content: string, nextDate: string) => void
  onSetRepairType: (type: RepairType, confirmDate: string, transferNote: string) => void
  onCompleteRepair: () => void
  onReceiveBack: () => void
}) {
  const device = getDeviceById(devices, incident.deviceId)
  const [note, setNote] = useState('')
  const [nextDate, setNextDate] = useState(incident.nextActionDate ?? isoOffset(1))
  const [assignee, setAssignee] = useState(incident.assignee)
  const [draftType, setDraftType] = useState<RepairType | null>(incident.repairType ?? null)
  const [confirmDate, setConfirmDate] = useState(incident.repairConfirmDate ?? todayIso())
  const [transferNote, setTransferNote] = useState('')

  const history = incident.repairHistory ?? []
  const isSwitching = Boolean(incident.repairType) && draftType !== incident.repairType
  const completed = Boolean(incident.repairCompletedAt) || incident.status === 'Đã hoàn tất' || incident.status === 'Đã nhận về khoa'
  const returned = incident.status === 'Đã nhận về khoa'
  // Ngày xác nhận sửa chữa là bắt buộc trước khi chốt một hình thức.
  const canSubmitType = Boolean(draftType) && Boolean(confirmDate)
    && (draftType !== incident.repairType || confirmDate !== incident.repairConfirmDate)

  return (
    <Modal title={incident.title} eyebrow={`${incident.code} · ${formatDateTime(incident.createdAt)}`} width="drawer" onClose={onClose}>
      <div className="incident-detail-head">
        <div>
          <StatusBadge label={incident.priority} dot={false} />
          <StatusBadge label={incident.status} />
          {incident.repairType && <StatusBadge label={incident.repairType} dot={false} />}
        </div>
        <p>{incident.description}</p>
      </div>

      {device && (
        <div className="linked-device">
          <DeviceVisual category={device.category} />
          <div>
            <span>Thiết bị liên quan</span>
            <strong>{device.name}</strong>
            <small>{device.code} · {device.department} · {device.room}</small>
          </div>
        </div>
      )}

      <div className="detail-section incident-meta">
        <h4><Info size={16} /> Thông tin tiếp nhận</h4>
        <div className="detail-grid">
          <DetailRow label="Người báo" value={incident.reporter} />
          <DetailRow label="Khoa/phòng" value={incident.reporterDepartment} />
          <DetailRow label="Thời gian báo" value={formatDateTime(incident.createdAt)} />
          <DetailRow label="Người phụ trách" value={incident.assignee} />
          <DetailRow label="Hẹn xử lý tiếp" value={incident.nextActionDate ? `${formatDate(incident.nextActionDate)} · ${dueLabel(incident.nextActionDate)}` : '—'} />
        </div>
      </div>

      {incident.hasPhoto && (
        <section className="detail-section">
          <h4><Camera size={16} /> Hình ảnh hư hỏng</h4>
          {incident.photos?.length ? (
            <div className="incident-photo-grid">
              {incident.photos.map((photo) => (
                <button type="button" key={photo.id} onClick={() => window.open(photo.url, '_blank', 'noopener,noreferrer')}>
                  <img src={photo.url} alt={photo.name} />
                  <span>{photo.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="mock-damage-photo"><Camera size={24} /><span>Ảnh minh chứng trong dữ liệu mẫu</span></div>
          )}
        </section>
      )}

      <section className="detail-section repair-section">
        <h4><Wrench size={16} /> Hình thức sửa chữa</h4>

        {canManage ? (
          <>
            <div className="repair-type-picker">
              {repairTypes.map((type) => (
                <button
                  type="button"
                  key={type}
                  className={`repair-type-option ${draftType === type ? 'active' : ''} ${incident.repairType === type ? 'current' : ''}`}
                  onClick={() => setDraftType(type)}
                  disabled={returned}
                  aria-pressed={draftType === type}
                >
                  <strong>{type}</strong>
                  <small>{repairTypeHints[type]}</small>
                  {incident.repairType === type && <i className="repair-current-flag">Đang áp dụng</i>}
                </button>
              ))}
            </div>

            {!returned && (
              <div className="repair-confirm-row">
                <label>
                  <CalendarClock size={15} /> Ngày xác nhận sửa chữa
                  <input
                    type="date"
                    value={confirmDate}
                    onChange={(event) => setConfirmDate(event.target.value)}
                    required
                  />
                </label>
                {isSwitching && (
                  <label className="repair-transfer-note">
                    <ArrowLeftRight size={15} /> Lý do chuyển hình thức
                    <input
                      value={transferNote}
                      onChange={(event) => setTransferNote(event.target.value)}
                      placeholder={`Vì sao chuyển sang “${draftType}”?`}
                    />
                  </label>
                )}
                <button
                  className="button primary compact-button"
                  type="button"
                  disabled={!canSubmitType}
                  onClick={() => {
                    if (draftType) onSetRepairType(draftType, confirmDate, transferNote)
                    setTransferNote('')
                  }}
                >
                  <Save size={15} /> {isSwitching ? 'Chuyển hình thức' : 'Xác nhận'}
                </button>
              </div>
            )}

            {!incident.repairType && (
              <div className="form-info warning-info">
                <Info size={17} />
                <span>Chưa chọn hình thức sửa chữa. Hãy chọn một hình thức và nhập ngày xác nhận để bắt đầu theo dõi.</span>
              </div>
            )}

            <div className="repair-actions">
              <button
                className="button primary"
                type="button"
                disabled={!incident.repairType || completed}
                onClick={onCompleteRepair}
                title={!incident.repairType ? 'Cần chọn hình thức sửa chữa trước' : undefined}
              >
                <CheckCircle2 size={16} /> {completed ? 'Đã hoàn thành sửa chữa' : 'Hoàn thành sửa chữa'}
              </button>
              <button
                className="button secondary"
                type="button"
                disabled={!completed || returned}
                onClick={onReceiveBack}
                title={!completed ? 'Chỉ nhận về sau khi đã hoàn thành sửa chữa' : undefined}
              >
                <PackageCheck size={16} /> {returned ? 'Khoa đã nhận về' : 'Nhận về lại khoa'}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="repair-readonly">
              {incident.repairType
                ? <><StatusBadge label={incident.repairType} dot={false} /><span>{repairTypeHints[incident.repairType]}</span></>
                : <span>Phòng TTBYT chưa chốt hình thức sửa chữa cho yêu cầu này.</span>}
            </div>
            <div className="repair-actions">
              <button className="button primary" type="button" disabled={!completed || returned} onClick={onReceiveBack}>
                <PackageCheck size={16} /> {returned ? 'Khoa đã nhận về' : 'Xác nhận nhận về lại khoa'}
              </button>
            </div>
          </>
        )}

        <div className="detail-grid repair-dates">
          <DetailRow label="Ngày xác nhận sửa chữa" value={formatDate(incident.repairConfirmDate)} />
          <DetailRow label="Hoàn thành sửa chữa" value={formatDateTime(incident.repairCompletedAt)} />
          <DetailRow label="Khoa nhận về" value={formatDateTime(incident.returnedAt)} />
        </div>

        {history.length > 0 && (
          <div className="repair-trace">
            <strong><History size={14} /> Dấu vết chuyển hình thức</strong>
            <ol>
              {history.map((trace) => (
                <li key={trace.id}>
                  <span className="repair-trace-dot" />
                  <div>
                    <p>{trace.from ? <>Chuyển từ <b>{trace.from}</b> sang <b>{trace.to}</b></> : <>Chốt hình thức <b>{trace.to}</b></>}</p>
                    {trace.note && <em>“{trace.note}”</em>}
                    <small>{formatDateTime(trace.at)} · {trace.by}</small>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </section>

      <section className="detail-section resolution-section">
        <h4><Wrench size={16} /> Tiến trình xử lý</h4>

        {canManage ? (
          <div className="form-grid">
            <label>Trạng thái
              <select value={incident.status} onChange={(event) => onUpdateStatus(event.target.value as IncidentStatus)}>
                <option>Mới tiếp nhận</option><option>Đang xử lý</option><option>Chờ linh kiện</option>
                <option>Đã hoàn tất</option><option>Đã nhận về khoa</option>
              </select>
            </label>
            <label>Đơn vị / người xử lý
              <div className="inline-field">
                <input value={assignee} onChange={(event) => setAssignee(event.target.value)} placeholder="Phòng TTBYT hoặc công ty" />
                <button type="button" className="button secondary compact-button" disabled={assignee === incident.assignee} onClick={() => onAssign(assignee)}>Lưu</button>
              </div>
            </label>
          </div>
        ) : (
          <div className="form-info"><ShieldCheck size={17} /><span>Phòng TTBYT phụ trách cập nhật trạng thái. Khoa có thể bổ sung ghi chú bên dưới.</span></div>
        )}

        <div className="note-timeline">
          {incident.notes.map((item) => (
            <article key={item.id}>
              <span><MessageSquarePlus size={15} /></span>
              <div><strong>{item.author}</strong><p>{item.content}</p><small>{item.time}</small></div>
            </article>
          ))}
          {!incident.notes.length && <p className="no-notes">Chưa có ghi chú xử lý.</p>}
        </div>

        <div className="add-note-box">
          <textarea rows={3} value={note} onChange={(event) => setNote(event.target.value)} placeholder="Thêm kết quả kiểm tra, phương án xử lý..." />
          <div>
            {canManage && (
              <label><CalendarClock size={15} /> Nhắc xử lý tiếp <input type="date" value={nextDate} onChange={(event) => setNextDate(event.target.value)} /></label>
            )}
            <button className="button primary compact-button" type="button" disabled={!note.trim()} onClick={() => { onAddNote(note, nextDate); setNote('') }}>
              <Plus size={15} /> Thêm ghi chú
            </button>
          </div>
        </div>
      </section>
    </Modal>
  )
}

/* ------------------------------------------------------ maintenance dialogs */

export function NewMaintenanceDialog({
  devices,
  onClose,
  onCreate,
}: {
  devices: Device[]
  onClose: () => void
  onCreate: (event: MaintenanceEvent) => void
}) {
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onCreate({
      id: `mnt-${Date.now()}`,
      deviceId: String(form.get('deviceId')),
      type: String(form.get('type')) as MaintenanceEvent['type'],
      date: String(form.get('date')),
      time: String(form.get('time')),
      provider: String(form.get('provider')),
      assignee: String(form.get('assignee')),
      reminderDays: Number(form.get('reminderDays')),
      status: 'Sắp tới',
      note: String(form.get('note')),
    })
  }

  return (
    <Modal title="Tạo lịch công việc" eyebrow="Bảo trì · Bảo hành · Hiệu chuẩn · Sửa chữa" width="medium" onClose={onClose}>
      <form className="entity-form" onSubmit={handleSubmit}>
        <section>
          <div className="form-grid">
            <label className="span-2">Thiết bị
              <select name="deviceId" required defaultValue="">
                <option disabled value="">Chọn thiết bị</option>
                {devices.map((device) => <option value={device.id} key={device.id}>{device.code} — {device.name}</option>)}
              </select>
            </label>
            <label>Loại công việc
              <select name="type" defaultValue="Bảo trì định kỳ">
                <option>Bảo trì định kỳ</option><option>Bảo hành</option><option>Hiệu chuẩn</option><option>Sửa chữa</option>
              </select>
            </label>
            <label>Ngày thực hiện <input name="date" type="date" min={todayIso()} defaultValue={isoOffset(3)} required /></label>
            <label>Giờ bắt đầu <input name="time" type="time" defaultValue="08:30" required /></label>
            <label>Nhắc trước
              <select name="reminderDays" defaultValue="3">
                <option value="0">Trong ngày</option><option value="1">1 ngày</option><option value="3">3 ngày</option>
                <option value="7">7 ngày</option><option value="14">14 ngày</option><option value="30">30 ngày</option>
              </select>
            </label>
            <label>Người phụ trách <input name="assignee" required placeholder="KS. phụ trách" /></label>
            <label>Công ty / đơn vị xử lý <input name="provider" required placeholder="Nhà cung cấp hoặc Phòng TTBYT" /></label>
            <label className="span-2">Nội dung công việc <textarea name="note" rows={4} required placeholder="Các hạng mục cần kiểm tra, vật tư dự kiến..." /></label>
          </div>
        </section>
        <div className="form-info"><BellRing size={17} /><span>Hệ thống sẽ hiện nhắc hẹn trong trung tâm cảnh báo khi đến ngưỡng nhắc trước.</span></div>
        <footer className="form-footer">
          <button className="button secondary" type="button" onClick={onClose}>Hủy</button>
          <button className="button primary" type="submit"><CalendarClock size={17} /> Tạo lịch</button>
        </footer>
      </form>
    </Modal>
  )
}

export function MaintenanceDetailDialog({
  event,
  devices,
  canManage,
  onClose,
  onUpdate,
  onDelete,
}: {
  event: MaintenanceEvent
  devices: Device[]
  canManage: boolean
  onClose: () => void
  onUpdate: (changes: Partial<MaintenanceEvent>) => void
  onDelete: () => void
}) {
  const device = getDeviceById(devices, event.deviceId)

  return (
    <Modal
      title={event.type}
      eyebrow={`${formatDate(event.date)} · ${dueLabel(event.date)}`}
      width="small"
      onClose={onClose}
      footer={canManage ? (
        <>
          <button className="button ghost" type="button" onClick={onDelete}><X size={16} /> Hủy lịch</button>
          <button className="button primary" type="button" disabled={event.status === 'Hoàn tất'} onClick={() => { onUpdate({ status: 'Hoàn tất' }); onClose() }}>
            <CheckCircle2 size={16} /> Xác nhận hoàn tất
          </button>
        </>
      ) : undefined}
    >
      <div className="maintenance-detail">
        <StatusBadge label={event.status} />
        {device && (
          <div className="qr-device">
            <DeviceVisual category={device.category} />
            <div><strong>{device.name}</strong><span>{device.code} · {device.department}</span></div>
          </div>
        )}
        <div className="detail-grid">
          <DetailRow label="Thời gian" value={`${formatDate(event.date)} · ${event.time}`} />
          <DetailRow label="Người phụ trách" value={event.assignee} />
          <DetailRow label="Đơn vị xử lý" value={event.provider} />
          <DetailRow label="Nhắc trước" value={`${event.reminderDays} ngày`} />
        </div>
        {canManage && (
          <label className="inline-select">Trạng thái
            <select value={event.status} onChange={(changeEvent) => onUpdate({ status: changeEvent.target.value as MaintenanceEvent['status'] })}>
              <option>Sắp tới</option><option>Đang thực hiện</option><option>Hoàn tất</option><option>Quá hạn</option>
            </select>
          </label>
        )}
        <div className="maintenance-note"><strong>Nội dung công việc</strong><p>{event.note}</p></div>
        {event.status !== 'Hoàn tất' && device && (
          <p className="maintenance-hint">Khi xác nhận hoàn tất, hệ thống tự đặt lịch bảo trì kế tiếp sau {device.maintenanceCycle} tháng.</p>
        )}
      </div>
    </Modal>
  )
}
