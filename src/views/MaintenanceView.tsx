import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Columns3,
  List,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import type { Branch, Device, MaintenanceEvent } from '../types'
import { daysFromToday, dueLabel, getDeviceById, normalizeText } from '../utils'
import { BranchChip, EmptyState, PageHeading, StatusBadge } from '../components/Shared'

const weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

function toDateKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

const eventTone: Record<MaintenanceEvent['type'], string> = {
  'Bảo trì định kỳ': 'green',
  'Bảo hành': 'blue',
  'Hiệu chuẩn': 'amber',
  'Sửa chữa': 'coral',
}

/** Năm nhóm theo mức khẩn — thứ tự này quyết định thứ tự hiển thị. */
type GroupKey = 'overdue' | 'today' | 'week' | 'later' | 'done'

const groupMeta: Record<GroupKey, { label: string; hint: string; tone: string }> = {
  overdue: { label: 'Quá hạn', hint: 'Ưu tiên khẩn — chưa có xác nhận đã bảo', tone: 'bad' },
  today: { label: 'Hôm nay', hint: 'Cần thực hiện trong ngày', tone: 'warn' },
  week: { label: '7 ngày tới', hint: 'Chuẩn bị vật tư và nhân sự', tone: 'info' },
  later: { label: 'Sắp tới', hint: 'Đã lên lịch, chưa đến hạn', tone: 'neutral' },
  done: { label: 'Đã hoàn tất', hint: 'Đã có xác nhận', tone: 'good' },
}

const groupOf = (event: MaintenanceEvent): GroupKey => {
  if (event.status === 'Hoàn tất') return 'done'
  const days = daysFromToday(event.date)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days <= 7) return 'week'
  return 'later'
}

export default function MaintenanceView({
  devices,
  events,
  canManage,
  onAddEvent,
  onOpenEvent,
  onComplete,
  scopeName,
  branches,
}: {
  devices: Device[]
  events: MaintenanceEvent[]
  canManage: boolean
  onAddEvent: () => void
  onOpenEvent: (event: MaintenanceEvent) => void
  onComplete: (event: MaintenanceEvent) => void
  scopeName: string
  branches?: Branch[]
}) {
  const today = new Date()
  const todayKey = toDateKey(today)
  // Danh sách theo mức khẩn là mặc định; lịch tháng là chế độ xem phụ.
  const [mode, setMode] = useState<'list' | 'calendar'>('list')
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [type, setType] = useState('Tất cả công việc')
  const [search, setSearch] = useState('')

  const filteredEvents = useMemo(() => events.filter((event) => {
    const device = getDeviceById(devices, event.deviceId)
    const haystack = normalizeText(`${event.type} ${device?.name ?? ''} ${device?.code ?? ''} ${event.provider} ${event.assignee}`)
    return (type === 'Tất cả công việc' || event.type === type)
      && (!search || haystack.includes(normalizeText(search)))
  }), [devices, events, search, type])

  const grouped = useMemo(() => {
    const buckets: Record<GroupKey, MaintenanceEvent[]> = { overdue: [], today: [], week: [], later: [], done: [] }
    for (const event of filteredEvents) buckets[groupOf(event)].push(event)
    for (const key of Object.keys(buckets) as GroupKey[]) {
      buckets[key].sort((a, b) => a.date.localeCompare(b.date))
    }
    return buckets
  }, [filteredEvents])

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(year, month, 1 - firstWeekday + index)
      return { date, dateString: toDateKey(date), day: date.getDate(), current: date.getMonth() === month }
    })
  }, [visibleMonth])

  const selectedEvents = filteredEvents.filter((event) => event.date === selectedDate)
  const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`
  const pendingEvents = events.filter((event) => event.status !== 'Hoàn tất')
  const upcomingCount = pendingEvents.filter((event) => daysFromToday(event.date) >= 0).length
  const inProgressEvents = events.filter((event) => event.status === 'Đang thực hiện')
  const overdueCount = pendingEvents.filter((event) => daysFromToday(event.date) < 0).length
  const completedThisMonth = events.filter((event) => event.status === 'Hoàn tất' && event.date.startsWith(monthKey)).length
  const hasActiveFilters = Boolean(search) || type !== 'Tất cả công việc'
  const selectedDateLabel = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: 'long' }).format(new Date(`${selectedDate}T00:00:00`))

  const changeMonth = (offset: number) => {
    const next = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + offset, 1)
    setVisibleMonth(next)
    setSelectedDate(toDateKey(next))
  }

  const goToday = () => {
    setVisibleMonth(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedDate(todayKey)
  }

  const resetFilters = () => { setSearch(''); setType('Tất cả công việc') }

  const renderRow = (event: MaintenanceEvent, group: GroupKey) => {
    const device = getDeviceById(devices, event.deviceId)
    return (
      <article className={`work-row ${group === 'overdue' ? 'overdue' : ''}`} key={event.id}>
        <div className={`date-tile ${group === 'overdue' ? 'overdue' : ''}`}>
          <strong>{event.date.slice(8, 10)}</strong>
          <span>Th {Number(event.date.slice(5, 7))}</span>
        </div>
        <button className="work-main" type="button" onClick={() => onOpenEvent(event)}>
          <span className="work-top">
            <span className={`work-type ${eventTone[event.type]}`}>
              {event.type === 'Bảo hành' ? <ShieldCheck size={13} /> : <Wrench size={13} />}
              {event.type}
            </span>
            <StatusBadge label={event.status} />
          </span>
          <strong>{device?.name ?? 'Thiết bị đã xóa'}</strong>
          <small>
            {device?.code}{device?.department ? ` · ${device.department}` : ''}
            {branches && device && <> · <BranchChip branchId={device.branchId} branches={branches} /></>}
          </small>
        </button>
        <div className="work-meta">
          <span><Clock3 size={13} /> {event.time}</span>
          <span>{event.assignee}</span>
          <span className={group === 'overdue' ? 'date-overdue' : ''}>{dueLabel(event.date)}</span>
        </div>
        {canManage && event.status !== 'Hoàn tất' && (
          <button className="work-confirm" type="button" onClick={() => onComplete(event)}>
            <CheckCircle2 size={15} /> Xác nhận đã bảo
          </button>
        )}
      </article>
    )
  }

  return (
    <div className="page maintenance-page">
      <PageHeading
        eyebrow="Kế hoạch kỹ thuật"
        title="Lịch bảo trì"
        description={`Theo dõi bảo trì, bảo hành, hiệu chuẩn và sửa chữa cho thiết bị tại ${scopeName}.`}
        actions={canManage
          ? <button className="button primary" type="button" onClick={onAddEvent}><Plus size={17} /> Tạo lịch mới</button>
          : undefined}
      />

      <section className="maintenance-metrics">
        <article><span className="summary-icon blue"><CalendarDays size={19} /></span><div><strong>{upcomingCount}</strong><span>Sắp đến hạn</span></div><small>Các lịch chưa bắt đầu</small></article>
        <article><span className="summary-icon amber"><RefreshCcw size={19} /></span><div><strong>{inProgressEvents.length}</strong><span>Đang thực hiện</span></div><small>{new Set(inProgressEvents.map((event) => event.assignee)).size} người phụ trách</small></article>
        <article className={overdueCount ? 'metric-urgent' : ''}><span className="summary-icon coral"><CircleAlert size={19} /></span><div><strong>{overdueCount}</strong><span>Quá hạn</span></div><small>{overdueCount ? 'Ưu tiên khẩn — chưa xác nhận' : 'Không có lịch trễ'}</small></article>
        <article><span className="summary-icon green"><CheckCircle2 size={19} /></span><div><strong>{completedThisMonth}</strong><span>Hoàn tất trong tháng</span></div><small>Theo tháng đang xem</small></article>
      </section>

      <section className="work-queue-panel">
        <div className="queue-tabs-row">
          <div className="view-toggle labeled" aria-label="Kiểu hiển thị">
            <button className={mode === 'list' ? 'active' : ''} onClick={() => setMode('list')} type="button" title="Danh sách theo mức khẩn">
              <List size={16} /> Danh sách
            </button>
            <button className={mode === 'calendar' ? 'active' : ''} onClick={() => setMode('calendar')} type="button" title="Lịch tháng">
              <Columns3 size={16} /> Lịch tháng
            </button>
          </div>
          {mode === 'calendar' && (
            <div className="calendar-navigation">
              <button className="icon-button border-button" type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước"><ArrowLeft size={17} /></button>
              <h2>Tháng {String(visibleMonth.getMonth() + 1).padStart(2, '0')}, {visibleMonth.getFullYear()}</h2>
              <button className="icon-button border-button" type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau"><ArrowRight size={17} /></button>
              <button className="button ghost compact-button" type="button" onClick={goToday}>Hôm nay</button>
            </div>
          )}
        </div>

        <div className="queue-toolbar">
          <label className="list-search">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm thiết bị, đơn vị xử lý, người phụ trách..." />
            {search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}
          </label>
          <div className="select-wrap">
            <select value={type} onChange={(event) => setType(event.target.value)} aria-label="Lọc loại công việc">
              <option>Tất cả công việc</option>
              <option>Bảo trì định kỳ</option>
              <option>Bảo hành</option>
              <option>Hiệu chuẩn</option>
              <option>Sửa chữa</option>
            </select>
            <ChevronDown size={15} />
          </div>
          {hasActiveFilters && <button className="button ghost compact-button" type="button" onClick={resetFilters}><X size={16} /> Xóa lọc</button>}
        </div>

        {mode === 'list' ? (
          <div className="work-groups">
            {(Object.keys(groupMeta) as GroupKey[]).map((key) => {
              const items = grouped[key]
              if (!items.length) return null
              const meta = groupMeta[key]
              return (
                <section className={`work-group tone-${meta.tone}`} key={key}>
                  <header>
                    <strong>{meta.label}</strong>
                    <b>{items.length}</b>
                    <small>{meta.hint}</small>
                  </header>
                  <div className="work-list">{items.map((event) => renderRow(event, key))}</div>
                </section>
              )
            })}
            {!filteredEvents.length && (
              <EmptyState
                title="Không có công việc phù hợp"
                detail="Thử bỏ bớt bộ lọc, hoặc tạo lịch mới cho thiết bị cần bảo trì."
                action={hasActiveFilters ? <button className="button secondary" type="button" onClick={resetFilters}>Xóa bộ lọc</button> : undefined}
              />
            )}
          </div>
        ) : (
          <div className="calendar-layout">
            <section className="month-calendar">
              <div className="weekday-row">
                {weekdays.map((day) => <span key={day}>{day}</span>)}
              </div>
              <div className="calendar-grid">
                {calendarDays.map((item, index) => {
                  const dayEvents = filteredEvents.filter((event) => event.date === item.dateString)
                  const overdueHere = dayEvents.some((event) => event.status !== 'Hoàn tất' && daysFromToday(event.date) < 0)
                  return (
                    <button
                      type="button"
                      className={`calendar-cell ${!item.current ? 'outside' : ''} ${item.dateString === todayKey ? 'today' : ''} ${item.dateString === selectedDate ? 'selected' : ''}`}
                      key={`${item.dateString}-${index}`}
                      onClick={() => { setSelectedDate(item.dateString); if (!item.current) setVisibleMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1)) }}
                      aria-label={`${item.day}/${item.date.getMonth() + 1} — ${dayEvents.length} công việc`}
                    >
                      <span className="day-number">{item.day}</span>
                      {/* Chấm màu thay cho chữ cắt cụt — chi tiết xem ở bảng bên phải */}
                      {dayEvents.length > 0 && (
                        <span className={`calendar-marks ${overdueHere ? 'has-overdue' : ''}`}>
                          {dayEvents.slice(0, 4).map((event) => (
                            <i className={eventTone[event.type]} key={event.id} />
                          ))}
                          {dayEvents.length > 4 && <b>+{dayEvents.length - 4}</b>}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            </section>

            <aside className="agenda-panel">
              <header>
                <span>Ngày đã chọn</span>
                <h2>{selectedDateLabel}</h2>
                <small>{selectedEvents.length} công việc trong ngày</small>
              </header>
              <div className="work-list agenda-list">
                {selectedEvents.map((event) => renderRow(event, groupOf(event)))}
                {!selectedEvents.length && <div className="agenda-empty">Không có công việc trong ngày này.</div>}
              </div>
              {canManage && <button className="agenda-add" type="button" onClick={onAddEvent}><Plus size={16} /> Thêm lịch ngày {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}</button>}
            </aside>
          </div>
        )}
      </section>
    </div>
  )
}
