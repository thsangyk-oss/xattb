import {
  Activity,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileChartColumn,
  PackageCheck,
  Plus,
  QrCode,
  ShieldCheck,
  Siren,
  Wrench,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { AlertItem, Branch, Device, Incident, MaintenanceEvent, UserAccount, ViewId } from '../types'
import { daysFromToday, dueLabel, formatDateTime, getDeviceById, isIncidentClosed } from '../utils'
import { BranchChip, DeviceVisual, PageHeading, SectionHeading, StatusBadge } from '../components/Shared'

const statusColors = {
  'Đang hoạt động': '#1c8c72',
  'Đang sửa chữa': '#de5d56',
  'Chờ bảo trì': '#e3a736',
  'Ngừng sử dụng': '#9ca3a0',
} as const

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      {payload.map((entry) => (
        <span key={entry.name}>
          <i style={{ background: entry.color }} />
          {entry.name}: <b>{entry.value}</b>
        </span>
      ))}
    </div>
  )
}

export default function DashboardView({
  devices,
  incidents,
  events,
  alerts,
  currentUser,
  onNavigate,
  onAddDevice,
  onNewIncident,
  onOpenAlert,
  scopeName,
  branches,
}: {
  devices: Device[]
  incidents: Incident[]
  events: MaintenanceEvent[]
  alerts: AlertItem[]
  currentUser: UserAccount
  onNavigate: (view: ViewId) => void
  onAddDevice?: () => void
  onNewIncident: () => void
  onOpenAlert: (alert: AlertItem) => void
  scopeName: string
  branches?: Branch[]
}) {
  const totalDevices = devices.length
  const activeDevices = devices.filter((device) => device.status === 'Đang hoạt động').length
  const readyRate = totalDevices ? Math.round((activeDevices / totalDevices) * 1000) / 10 : 0
  const currentMonth = new Date().toISOString().slice(0, 7)
  const updatedThisMonth = devices.filter((device) => device.lastUpdated.startsWith(currentMonth)).length
  const statusData = (Object.keys(statusColors) as Array<keyof typeof statusColors>).map((status) => ({
    name: status === 'Đang hoạt động' ? 'Hoạt động' : status === 'Đang sửa chữa' ? 'Sửa chữa' : status === 'Chờ bảo trì' ? 'Chờ bảo trì' : 'Ngừng dùng',
    value: devices.filter((device) => device.status === status).length,
    color: statusColors[status],
  }))
  // Khi admin xem "Tất cả chi nhánh", ưu tiên breakdown theo chi nhánh thay vì theo khoa
  const isAllBranches = Boolean(branches)
  const departmentData = isAllBranches
    ? branches!.map((branch) => ({
        name: branch.shortName,
        total: devices.filter((d) => d.branchId === branch.id).length,
        active: devices.filter((d) => d.branchId === branch.id && d.status === 'Đang hoạt động').length,
      }))
    : Array.from(devices.reduce((groups, device) => {
        const name = device.department.replace(/^Khoa\s+/, '').replace('Chẩn đoán hình ảnh', 'CĐHA').replace('Hồi sức tích cực', 'HSTC').replace('Gây mê hồi sức', 'GMHS').replace('Thận nhân tạo', 'Thận NT')
        const current = groups.get(name) ?? { name, total: 0, active: 0 }
        current.total += 1
        if (device.status === 'Đang hoạt động') current.active += 1
        groups.set(name, current)
        return groups
      }, new Map<string, { name: string; total: number; active: number }>()).values()).slice(0, 6)
  const openIncidents = incidents.filter((incident) => !isIncidentClosed(incident.status))
  const urgentIncidents = openIncidents.filter((incident) => incident.priority === 'Khẩn cấp')
  const attentionIncidents = openIncidents.filter((incident) => incident.priority === 'Khẩn cấp' || incident.status === 'Mới tiếp nhận')
  const pendingEvents = events.filter((event) => event.status !== 'Hoàn tất')
  const overdueEvents = pendingEvents.filter((event) => daysFromToday(event.date) < 0)
  const recentIncidents = [...incidents]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)
  const upcoming = [...pendingEvents]
    .filter((event) => daysFromToday(event.date) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 4)
  const topAlerts = alerts.slice(0, 5)
  const urgentAlertCount = alerts.filter((alert) => alert.urgent).length
  const completeProfiles = devices.filter((device) => device.documents.length > 0).length
  const documentationRate = totalDevices ? Math.round((completeProfiles / totalDevices) * 1000) / 10 : 0
  const today = new Date()
  const hour = today.getHours()
  const greeting = hour < 12 ? 'Chào buổi sáng' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối'
  const todayLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(today)
  const incidentTrendData = Array.from({ length: 6 }, (_, index) => {
    const month = new Date(today.getFullYear(), today.getMonth() - 5 + index, 1)
    const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
    return {
      month: `T${month.getMonth() + 1}`,
      count: incidents.filter((incident) => incident.createdAt.startsWith(key)).length,
    }
  })

  return (
    <div className="page dashboard-page">
      <PageHeading
        eyebrow={todayLabel}
        title={`${greeting}, ${currentUser.displayName}`}
        description={`${totalDevices} hồ sơ thiết bị · ${scopeName}.`}
        actions={
          <>
            <button className="button secondary" type="button" onClick={() => onNavigate('reports')}>
              <FileChartColumn size={17} />
              Mở báo cáo
            </button>
            {onAddDevice ? (
              <button className="button primary" type="button" onClick={onAddDevice}>
                <Plus size={17} />
                Thêm thiết bị
              </button>
            ) : (
              <button className="button primary" type="button" onClick={onNewIncident}>
                <Siren size={17} />
                Báo hỏng
              </button>
            )}
          </>
        }
      />

      <section className="metric-grid" aria-label="Chỉ số tổng quan">
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon green"><PackageCheck size={19} /></span>
            <span className="metric-trend neutral">Đã nhập</span>
          </div>
          <strong>{totalDevices}</strong>
          <span>Hồ sơ thiết bị</span>
          <small><b>{updatedThisMonth} hồ sơ</b> cập nhật trong tháng</small>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon teal"><Activity size={19} /></span>
            <span className="metric-trend neutral">{readyRate}%</span>
          </div>
          <strong>{activeDevices}</strong>
          <span>Đang hoạt động tốt</span>
          <small><b>{totalDevices - activeDevices} hồ sơ</b> cần theo dõi</small>
        </article>
        <article className="metric-card alert-card">
          <div className="metric-top">
            <span className="metric-icon red"><Siren size={19} /></span>
            <span className={`metric-trend ${urgentIncidents.length ? 'down' : 'neutral'}`}>{urgentIncidents.length} khẩn cấp</span>
          </div>
          <strong>{openIncidents.length}</strong>
          <span>Sự cố đang xử lý</span>
          <small><b>{attentionIncidents.length} yêu cầu</b> cần phản hồi sớm</small>
        </article>
        <article className="metric-card">
          <div className="metric-top">
            <span className="metric-icon amber"><CalendarClock size={19} /></span>
            <span className="metric-trend neutral">7 ngày tới</span>
          </div>
          <strong>{pendingEvents.length}</strong>
          <span>Công việc đang mở</span>
          <small><b>{overdueEvents.length} lịch</b> đang quá hạn</small>
        </article>
      </section>

      <section className={`alert-board ${topAlerts.length ? '' : 'clear'}`}>
        <header>
          <div className="alert-board-icon">{topAlerts.length ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}</div>
          <div>
            <strong>{topAlerts.length ? `${alerts.length} cảnh báo cần xử lý` : 'Không có cảnh báo'}</strong>
            <span>
              {urgentAlertCount > 0
                ? `${urgentAlertCount} mục ưu tiên khẩn — bảo trì hoặc bảo hành đã quá hạn mà chưa có xác nhận`
                : 'Sự cố đang mở, lịch quá hạn, nhắc hẹn đến ngưỡng và bảo hành sắp hết'}
            </span>
          </div>
          {alerts.length > 0 && (
            <button type="button" onClick={() => onNavigate(attentionIncidents.length ? 'incidents' : 'maintenance')}>
              Xử lý ngay <ArrowRight size={16} />
            </button>
          )}
        </header>
        {topAlerts.length > 0 && (
          <div className="alert-board-list">
            {topAlerts.map((alert) => (
              <button className={`alert-row ${alert.severity} ${alert.urgent ? 'urgent' : ''}`} type="button" key={alert.id} onClick={() => onOpenAlert(alert)}>
                <span>
                  {alert.kind === 'incident' || alert.kind === 'follow-up' ? <Siren size={15} />
                    : alert.kind === 'warranty' || alert.kind === 'warranty-overdue' ? <ShieldCheck size={15} />
                      : <CalendarClock size={15} />}
                </span>
                <div><strong>{alert.urgent && <i className="urgent-tag">KHẨN</i>}{alert.title}</strong><small>{alert.detail}</small></div>
                <ArrowRight size={15} className="row-arrow" />
              </button>
            ))}
            {alerts.length > topAlerts.length && (
              <span className="alert-more">+{alerts.length - topAlerts.length} cảnh báo khác trong trung tâm thông báo</span>
            )}
          </div>
        )}
      </section>

      <div className="dashboard-columns">
        <section className="panel chart-panel wide-panel">
          <SectionHeading
            title={isAllBranches ? 'Thiết bị theo chi nhánh' : 'Thiết bị theo khoa'}
            detail="Số lượng và tỷ lệ đang hoạt động"
            action={
              <button className="text-button" type="button" onClick={() => onNavigate('reports')}>
                Xem báo cáo <ArrowRight size={15} />
              </button>
            }
          />
          <div className="bar-chart-wrap">
            <ResponsiveContainer width="100%" height="100%">
             <BarChart data={departmentData} barGap={2} margin={{ top: 8, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e8ece9" />
                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#64706b', fontSize: 12 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#87908c', fontSize: 11 }} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f2f5f3' }} />
                <Bar dataKey="total" name="Tổng thiết bị" fill="#d8e3df" radius={[3, 3, 0, 0]} maxBarSize={24} />
                <Bar dataKey="active" name="Hoạt động" fill="#1c8c72" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend">
            <span><i className="legend-total" /> Tổng thiết bị</span>
            <span><i className="legend-active" /> Đang hoạt động</span>
          </div>
        </section>

        <section className="panel status-panel">
           <SectionHeading title="Tình trạng thiết bị" detail={scopeName} />
          <div className="donut-wrap">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={63}
                  outerRadius={83}
                  paddingAngle={3}
                  stroke="none"
                >
                  {statusData.map((item) => <Cell key={item.name} fill={item.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
             <div className="donut-center"><strong>{totalDevices}</strong><span>Thiết bị</span></div>
          </div>
          <div className="status-legend">
            {statusData.map((item) => (
              <div key={item.name}>
                <span><i style={{ background: item.color }} />{item.name}</span>
                <strong>{item.value}</strong>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="dashboard-columns lower">
        <section className="panel wide-panel">
          <SectionHeading
            title="Sự cố gần đây"
            detail={`${openIncidents.length} yêu cầu đang mở`}
            action={<button className="text-button" type="button" onClick={() => onNavigate('incidents')}>Xem tất cả <ArrowRight size={15} /></button>}
          />
          <div className="recent-list">
            {recentIncidents.length ? recentIncidents.map((incident) => {
              const device = getDeviceById(devices, incident.deviceId)
              if (!device) return null
              return (
                <button className="recent-row" type="button" key={incident.id} onClick={() => onOpenAlert({ id: incident.id, kind: 'incident', severity: 'warning', title: incident.title, detail: '', meta: '', view: 'incidents', incidentId: incident.id })}>
                  <DeviceVisual category={device.category} size="sm" />
                  <span className="recent-main">
                    <strong>{incident.title}</strong>
                    <small>{device.name} · {device.department}</small>
                    {branches && <BranchChip branchId={device.branchId} branches={branches} />}
                  </span>
                  <span className="recent-time">{formatDateTime(incident.createdAt)}</span>
                  <StatusBadge label={incident.status} />
                  <ArrowRight size={16} className="row-arrow" />
                </button>
              )
            }) : <div className="dashboard-list-empty">Chưa có sự cố trong phạm vi đang xem.</div>}
          </div>
        </section>

        <section className="panel schedule-panel">
          <SectionHeading
            title="Lịch sắp tới"
            detail="7 ngày tiếp theo"
            action={<button className="icon-button compact" type="button" onClick={() => onNavigate('maintenance')} aria-label="Mở lịch"><ArrowRight size={17} /></button>}
          />
          <div className="schedule-list">
            {upcoming.length ? upcoming.map((event) => {
              const device = getDeviceById(devices, event.deviceId)
              return (
                <div className="schedule-row" key={event.id}>
                  <div className={`date-tile ${event.status === 'Quá hạn' ? 'overdue' : ''}`}>
                    <strong>{event.date.slice(8, 10)}</strong>
                    <span>Tháng {Number(event.date.slice(5, 7))}</span>
                  </div>
                  <div>
                    <strong>{event.type}</strong>
                    <span>{device?.name}</span>
                    <small><Clock3 size={13} /> {event.time} · {dueLabel(event.date)}</small>
                    {branches && device && <BranchChip branchId={device.branchId} branches={branches} />}
                  </div>
                </div>
              )
            }) : <div className="dashboard-list-empty">Chưa có lịch công việc đang mở.</div>}
          </div>
        </section>
      </div>

      <section className="dashboard-bottom-grid">
        <div className="panel incident-trend-panel">
          <SectionHeading title="Xu hướng sự cố" detail="6 tháng gần nhất" />
          <div className="trend-chart">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={incidentTrendData} margin={{ top: 8, right: 8, left: -32, bottom: 0 }}>
                <defs>
                  <linearGradient id="incidentFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#de5d56" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#de5d56" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0ee" />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#69736f', fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#8c9490', fontSize: 10 }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" name="Sự cố" stroke="#d9514b" strokeWidth={2} fill="url(#incidentFill)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="quick-actions-panel">
          <SectionHeading title="Thao tác nhanh" detail="Các nghiệp vụ thường dùng" />
          <div className="quick-action-grid">
            <button type="button" onClick={onNewIncident}><span className="quick-icon coral"><Siren size={19} /></span><strong>Báo sự cố</strong><small>Tạo yêu cầu mới</small></button>
            <button type="button" onClick={() => onNavigate('devices')}><span className="quick-icon dark"><QrCode size={19} /></span><strong>Mã QR</strong><small>Chọn thiết bị để in tem</small></button>
            <button type="button" onClick={() => onNavigate('maintenance')}><span className="quick-icon amber"><Wrench size={19} /></span><strong>Lập lịch</strong><small>Bảo trì, hiệu chuẩn</small></button>
            <button type="button" onClick={() => onNavigate('reports')}><span className="quick-icon green"><FileChartColumn size={19} /></span><strong>Báo cáo</strong><small>Tùy chọn dữ liệu</small></button>
          </div>
          <div className="compliance-note">
            <CheckCircle2 size={18} />
            <span><strong>{documentationRate}% hồ sơ có chứng từ</strong> · {totalDevices - completeProfiles} hồ sơ chưa có tài liệu</span>
          </div>
        </div>
      </section>
    </div>
  )
}
