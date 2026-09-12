import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CalendarClock,
  Camera,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Columns3,
  List,
  MessageSquareText,
  PackageCheck,
  Plus,
  Search,
  TimerReset,
  UserRound,
  Wrench,
  X,
} from 'lucide-react'
import type { Branch, Device, Incident, IncidentStatus, UserAccount } from '../types'
import { repairTypes } from '../types'
import { dueLabel, formatDate, formatDateTime, getDeviceById, isIncidentClosed, normalizeText } from '../utils'
import { BranchChip, DeviceVisual, EmptyState, PageHeading, StatusBadge } from '../components/Shared'

const incidentStatuses: Array<'Tất cả' | IncidentStatus> = [
  'Tất cả',
  'Mới tiếp nhận',
  'Đang xử lý',
  'Chờ linh kiện',
  'Đã hoàn tất',
  'Đã nhận về khoa',
]

const boardStatuses: IncidentStatus[] = [
  'Mới tiếp nhận',
  'Đang xử lý',
  'Chờ linh kiện',
  'Đã hoàn tất',
  'Đã nhận về khoa',
]

export default function IncidentsView({
  devices,
  incidents,
  currentUser,
  onNewIncident,
  onOpenIncident,
  onUpdateStatus,
  scopeName,
  branches,
}: {
  devices: Device[]
  incidents: Incident[]
  currentUser: UserAccount
  onNewIncident: () => void
  onOpenIncident: (incident: Incident) => void
  onUpdateStatus: (incident: Incident, status: IncidentStatus) => void
  scopeName: string
  branches?: Branch[]
}) {
  const canManage = currentUser.role !== 'department'
  const [status, setStatus] = useState<(typeof incidentStatuses)[number]>('Tất cả')
  const [priority, setPriority] = useState('Tất cả mức độ')
  const [repairFilter, setRepairFilter] = useState('Tất cả hình thức')
  const [branchFilter, setBranchFilter] = useState('Tất cả chi nhánh')
  const [search, setSearch] = useState('')
  const [mode, setMode] = useState<'list' | 'board'>('list')

  const filtered = useMemo(() => incidents.filter((incident) => {
    const device = getDeviceById(devices, incident.deviceId)
    const haystack = normalizeText(`${incident.code} ${incident.title} ${device?.name ?? ''} ${device?.code ?? ''} ${incident.reporterDepartment}`)
    return (status === 'Tất cả' || incident.status === status)
      && (priority === 'Tất cả mức độ' || incident.priority === priority)
      && (repairFilter === 'Tất cả hình thức'
        || (repairFilter === 'Chưa chốt hình thức' ? !incident.repairType : incident.repairType === repairFilter))
      && (branchFilter === 'Tất cả chi nhánh' || device?.branchId === branchFilter)
      && (!search || haystack.includes(normalizeText(search)))
  }), [branchFilter, devices, incidents, priority, repairFilter, search, status])

  const openIncidents = incidents.filter((incident) => !isIncidentClosed(incident.status))
  const openCount = openIncidents.length
  const urgentCount = openIncidents.filter((incident) => incident.priority === 'Khẩn cấp').length
  const waitingPartsCount = incidents.filter((incident) => incident.status === 'Chờ linh kiện').length
  const completedCount = incidents.filter((incident) => isIncidentClosed(incident.status)).length
  // Đã sửa xong nhưng thiết bị chưa quay lại khoa — mục cần đôn đốc rõ nhất.
  const awaitingReturnCount = incidents.filter((incident) => incident.status === 'Đã hoàn tất').length
  const openDepartmentCount = new Set(openIncidents.map((incident) => incident.reporterDepartment)).size
  const scheduledCount = openIncidents.filter((incident) => incident.nextActionDate).length
  const scheduledRate = openCount ? Math.round((scheduledCount / openCount) * 100) : 0
  const hasActiveFilters = Boolean(search) || status !== 'Tất cả' || priority !== 'Tất cả mức độ'
    || repairFilter !== 'Tất cả hình thức' || branchFilter !== 'Tất cả chi nhánh'
  const resetFilters = () => {
    setSearch('')
    setStatus('Tất cả')
    setPriority('Tất cả mức độ')
    setRepairFilter('Tất cả hình thức')
    setBranchFilter('Tất cả chi nhánh')
  }

  return (
    <div className="page incidents-page">
      <PageHeading
        eyebrow="Trung tâm tiếp nhận"
        title="Sự cố & sửa chữa"
        description={canManage
          ? `Tiếp nhận báo hỏng từ các khoa và theo dõi tiến trình xử lý tại ${scopeName}.`
          : `Theo dõi tình trạng xử lý các yêu cầu sửa chữa của ${scopeName}.`}
        actions={<button className="button primary" type="button" onClick={onNewIncident}><Plus size={17} /> {canManage ? 'Tiếp nhận sự cố' : 'Báo hỏng'}</button>}
      />

      <section className="incident-summary-row">
        <article><span className="summary-icon coral"><CircleAlert size={19} /></span><div><strong>{urgentCount}</strong><span>Khẩn cấp</span></div><small>Cần phản hồi ngay</small></article>
        <article><span className="summary-icon blue"><TimerReset size={19} /></span><div><strong>{openCount}</strong><span>Đang mở</span></div><small>Trên {openDepartmentCount} khoa/phòng</small></article>
        <article><span className="summary-icon amber"><Wrench size={19} /></span><div><strong>{waitingPartsCount}</strong><span>Chờ linh kiện</span></div><small>{waitingPartsCount ? 'Cần theo dõi nhà cung cấp' : 'Không có yêu cầu chờ'}</small></article>
        <article><span className="summary-icon violet"><PackageCheck size={19} /></span><div><strong>{awaitingReturnCount}</strong><span>Chờ nhận về khoa</span></div><small>{awaitingReturnCount ? 'Đã sửa xong, chưa bàn giao lại' : 'Không còn tồn đọng'}</small></article>
        <article><span className="summary-icon green"><CheckCircle2 size={19} /></span><div><strong>{completedCount}</strong><span>Đã khép lại</span></div><small>Trong dữ liệu đang xem</small></article>
        <article className="response-metric"><span>Có lịch xử lý tiếp</span><strong>{scheduledCount}/{openCount}</strong><small>Yêu cầu mở đã có ngày hẹn</small><i><b style={{ width: `${scheduledRate}%` }} /></i></article>
      </section>

      <section className="work-queue-panel">
        <div className="queue-tabs-row">
          <div className="segmented-tabs incident-tabs">
            {incidentStatuses.map((item) => (
              <button key={item} type="button" className={status === item ? 'active' : ''} onClick={() => setStatus(item)}>
                {item} <b>{item === 'Tất cả' ? incidents.length : incidents.filter((incident) => incident.status === item).length}</b>
              </button>
            ))}
          </div>
          <div className="view-toggle" aria-label="Kiểu hiển thị">
            <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')} type="button" title="Danh sách"><List size={17} /></button>
            <button className={mode === 'board' ? 'active' : ''} onClick={() => setMode('board')} type="button" title="Bảng công việc"><Columns3 size={17} /></button>
          </div>
        </div>

        <div className="queue-toolbar">
          <label className="list-search incident-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm mã sự cố, thiết bị, khoa..." />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}
          </label>
          <div className="select-wrap">
            <select value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Lọc mức độ">
              <option>Tất cả mức độ</option>
              <option>Khẩn cấp</option>
              <option>Cao</option>
              <option>Trung bình</option>
              <option>Thấp</option>
            </select>
            <ChevronDown size={15} />
          </div>
          <div className="select-wrap">
            <select value={repairFilter} onChange={(event) => setRepairFilter(event.target.value)} aria-label="Lọc hình thức sửa chữa">
              <option>Tất cả hình thức</option>
              <option>Chưa chốt hình thức</option>
              {repairTypes.map((type) => <option key={type}>{type}</option>)}
            </select>
            <ChevronDown size={15} />
          </div>
          {branches && (
            <div className="select-wrap">
              <select value={branchFilter} onChange={(event) => setBranchFilter(event.target.value)} aria-label="Lọc theo chi nhánh">
                <option>Tất cả chi nhánh</option>
                {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.shortName}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
          )}
          {hasActiveFilters && <button className="button ghost compact-button" type="button" onClick={resetFilters}><X size={16} /> Xóa lọc</button>}
        </div>

        {mode === 'list' ? (
          <div className="incident-list">
            {filtered.length ? filtered.map((incident) => {
              const device = getDeviceById(devices, incident.deviceId)
              if (!device) return null
              return (
                <article className={`incident-row priority-${normalizeText(incident.priority).replace(' ', '-')}`} key={incident.id}>
                  <div className="incident-priority-line" />
                  <DeviceVisual category={device.category} />
                  <button className="incident-main" type="button" onClick={() => onOpenIncident(incident)}>
                    <span className="incident-code-line"><b>{incident.code}</b><StatusBadge label={incident.priority} dot={false} /></span>
                    <strong>{incident.title}</strong>
                    <small>{device.name} · {device.code}</small>
                  </button>
                  <div className="incident-location">
                    <strong>{incident.reporterDepartment}</strong>
                    <span><UserRound size={13} /> {incident.reporter}</span>
                    {branches && device && <BranchChip branchId={device.branchId} branches={branches} />}
                  </div>
                  <div className="incident-created">
                    <strong>{formatDateTime(incident.createdAt)}</strong>
                    <span>{incident.hasPhoto && <><Camera size={13} /> Có ảnh</>} {incident.notes.length > 0 && <><MessageSquareText size={13} /> {incident.notes.length}</>}</span>
                  </div>
                  <div className="incident-repair">
                    {incident.repairType
                      ? <><StatusBadge label={incident.repairType} dot={false} /><span><CalendarClock size={13} /> XN {formatDate(incident.repairConfirmDate)}</span></>
                      : <span className="repair-unset">Chưa chốt hình thức</span>}
                  </div>
                  <div className="incident-assignee"><strong>{incident.assignee}</strong>{incident.nextActionDate && <span><CalendarClock size={13} /> {dueLabel(incident.nextActionDate)}</span>}</div>
                  <div className="incident-status-action">
                    {canManage ? (
                      <select
                        value={incident.status}
                        onChange={(event) => onUpdateStatus(incident, event.target.value as IncidentStatus)}
                        className={`status-select ${incident.status === 'Đã hoàn tất' ? 'success' : ''}`}
                        aria-label={`Trạng thái ${incident.code}`}
                      >
                        {boardStatuses.map((item) => <option key={item}>{item}</option>)}
                      </select>
                    ) : <StatusBadge label={incident.status} />}
                    <button className="icon-button compact" type="button" onClick={() => onOpenIncident(incident)} aria-label="Mở chi tiết"><ArrowRight size={16} /></button>
                  </div>
                </article>
              )
            }) : (
              <EmptyState title="Không có sự cố phù hợp" detail="Hãy thay đổi trạng thái, mức độ hoặc từ khóa tìm kiếm." action={<button className="button secondary" type="button" onClick={resetFilters}>Xóa bộ lọc</button>} />
            )}
          </div>
        ) : (
          <div className="incident-board">
            {boardStatuses.map((boardStatus) => {
              const items = filtered.filter((incident) => incident.status === boardStatus)
              return (
                <section className="board-column" key={boardStatus}>
                  <header><StatusBadge label={boardStatus} /><b>{items.length}</b></header>
                  <div className="board-cards">
                    {items.map((incident) => {
                      const device = getDeviceById(devices, incident.deviceId)
                      return (
                        <button className="board-card" type="button" key={incident.id} onClick={() => onOpenIncident(incident)}>
                          <div><span>{incident.code}</span><StatusBadge label={incident.priority} dot={false} /></div>
                          <strong>{incident.title}</strong>
                          <small>{device?.name}</small>
                          {incident.repairType && <StatusBadge label={incident.repairType} dot={false} />}
                          {branches && device && <BranchChip branchId={device.branchId} branches={branches} />}
                          <footer><span><UserRound size={13} />{incident.assignee}</span><span>{formatDateTime(incident.createdAt)}</span></footer>
                        </button>
                      )
                    })}
                    {!items.length && <div className="board-empty">Chưa có yêu cầu</div>}
                  </div>
                </section>
              )
            })}
          </div>
        )}
      </section>
    </div>
  )
}
