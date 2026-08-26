import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react'
import type { Device, MaintenanceEvent } from '../types'
import { daysFromToday, dueLabel, formatDate, getDeviceById, normalizeText } from '../utils'
import { PageHeading, StatusBadge } from '../components/Shared'

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

export default function MaintenanceView({
  devices,
  events,
  canManage,
  onAddEvent,
  onOpenEvent,
  onComplete,
  scopeName,
}: {
  devices: Device[]
  events: MaintenanceEvent[]
  canManage: boolean
  onAddEvent: () => void
  onOpenEvent: (event: MaintenanceEvent) => void
  onComplete: (event: MaintenanceEvent) => void
  scopeName: string
}) {
  const today = new Date()
  const todayKey = toDateKey(today)
  const [visibleMonth, setVisibleMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(todayKey)
  const [type, setType] = useState('Tất cả công việc')
  const [search, setSearch] = useState('')

  const filteredEvents = useMemo(() => events.filter((event) => {
    const device = getDeviceById(devices, event.deviceId)
    const haystack = normalizeText(`${event.type} ${device?.name ?? ''} ${event.provider} ${event.assignee}`)
    return (type === 'Tất cả công việc' || event.type === type)
      && (!search || haystack.includes(normalizeText(search)))
  }), [devices, events, search, type])

  const calendarDays = useMemo(() => {
    const year = visibleMonth.getFullYear()
    const month = visibleMonth.getMonth()
    const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(year, month, 1 - firstWeekday + index)
      return {
        date,
        dateString: toDateKey(date),
        day: date.getDate(),
        current: date.getMonth() === month,
      }
    })
  }, [visibleMonth])
  const selectedEvents = filteredEvents.filter((event) => event.date === selectedDate)
  const monthKey = `${visibleMonth.getFullYear()}-${String(visibleMonth.getMonth() + 1).padStart(2, '0')}`
  const pendingEvents = events.filter((event) => event.status !== 'Hoàn tất')
  const upcomingCount = pendingEvents.filter((event) => daysFromToday(event.date) >= 0).length
  const inProgressEvents = events.filter((event) => event.status === 'Đang thực hiện')
  const overdueEvents = pendingEvents.filter((event) => daysFromToday(event.date) < 0)
  const overdueCount = overdueEvents.length
  const dueSoon = pendingEvents
    .filter((event) => {
      const days = daysFromToday(event.date)
      return days >= 0 && days <= (event.reminderDays || 0)
    })
    .sort((a, b) => a.date.localeCompare(b.date))
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

  return (
    <div className="page maintenance-page">
      <PageHeading
        eyebrow="Kế hoạch kỹ thuật"
        title="Lịch công việc"
        description={`Lập lịch bảo trì, bảo hành, hiệu chuẩn và sửa chữa cho thiết bị tại ${scopeName}.`}
        actions={
          <>
            <button className="button secondary" type="button" onClick={() => document.getElementById('reminder-rules')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}><Settings2 size={17} /> Nhắc hẹn đến hạn</button>
            {canManage && <button className="button primary" type="button" onClick={onAddEvent}><Plus size={17} /> Tạo lịch mới</button>}
          </>
        }
      />

      <section className="maintenance-metrics">
        <article><span className="summary-icon blue"><CalendarDays size={19} /></span><div><strong>{upcomingCount}</strong><span>Sắp đến hạn</span></div><small>Các lịch chưa bắt đầu</small></article>
        <article><span className="summary-icon amber"><RefreshCcw size={19} /></span><div><strong>{inProgressEvents.length}</strong><span>Đang thực hiện</span></div><small>{new Set(inProgressEvents.map((event) => event.assignee)).size} người phụ trách</small></article>
        <article><span className="summary-icon coral"><CircleAlert size={19} /></span><div><strong>{overdueCount}</strong><span>Quá hạn</span></div><small>{overdueCount ? 'Cần đặt lịch lại' : 'Không có lịch trễ'}</small></article>
        <article><span className="summary-icon green"><CheckCircle2 size={19} /></span><div><strong>{completedThisMonth}</strong><span>Hoàn tất trong tháng</span></div><small>Theo tháng đang xem</small></article>
      </section>

      <section className="calendar-toolbar">
        <div className="calendar-navigation">
          <button className="icon-button border-button" type="button" onClick={() => changeMonth(-1)} aria-label="Tháng trước"><ArrowLeft size={17} /></button>
          <h2>Tháng {String(visibleMonth.getMonth() + 1).padStart(2, '0')}, {visibleMonth.getFullYear()}</h2>
          <button className="icon-button border-button" type="button" onClick={() => changeMonth(1)} aria-label="Tháng sau"><ArrowRight size={17} /></button>
          <button className="button ghost compact-button" type="button" onClick={goToday}>Hôm nay</button>
        </div>
        <div className="calendar-filters">
          <label className="list-search small-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm lịch..." />{search && <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm"><X size={14} /></button>}</label>
          <div className="select-wrap">
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option>Tất cả công việc</option>
              <option>Bảo trì định kỳ</option>
              <option>Bảo hành</option>
              <option>Hiệu chuẩn</option>
              <option>Sửa chữa</option>
            </select>
            <ChevronDown size={15} />
            </div>
            {hasActiveFilters && <button className="table-footer-reset" type="button" onClick={() => { setSearch(''); setType('Tất cả công việc') }}>Xóa lọc</button>}
        </div>
      </section>

      <div className="calendar-layout">
        <section className="month-calendar">
          <div className="weekday-row">
            {weekdays.map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="calendar-grid">
            {calendarDays.map((item, index) => {
              const dayEvents = filteredEvents.filter((event) => event.date === item.dateString)
              return (
                <button
                  type="button"
                  className={`calendar-cell ${!item.current ? 'outside' : ''} ${item.dateString === todayKey ? 'today' : ''} ${item.dateString === selectedDate ? 'selected' : ''}`}
                  key={`${item.dateString}-${index}`}
                  onClick={() => { setSelectedDate(item.dateString); if (!item.current) setVisibleMonth(new Date(item.date.getFullYear(), item.date.getMonth(), 1)) }}
                >
                  <span className="day-number">{item.day}</span>
                  <div className="calendar-events">
                    {dayEvents.slice(0, 2).map((event) => {
                      const device = getDeviceById(devices, event.deviceId)
                      return (
                        <span className={`calendar-event ${eventTone[event.type]}`} key={event.id}>
                          <i /> {event.time} {device?.name}
                        </span>
                      )
                    })}
                    {dayEvents.length > 2 && <small>+{dayEvents.length - 2} công việc</small>}
                  </div>
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
          <div className="agenda-list">
            {selectedEvents.map((event) => {
              const device = getDeviceById(devices, event.deviceId)
              return (
                <button className="agenda-card" type="button" key={event.id} onClick={() => onOpenEvent(event)}>
                  <span className={`agenda-type-icon ${eventTone[event.type]}`}>
                    {event.type === 'Bảo hành' ? <ShieldCheck size={18} /> : <Wrench size={18} />}
                  </span>
                  <div className="agenda-copy">
                    <div><StatusBadge label={event.status} /><small>{formatDate(event.date)}</small></div>
                    <strong>{event.type}</strong>
                    <span>{device?.name}</span>
                    <small>{device?.department}</small>
                    <footer><span><Clock3 size={13} /> {event.time}</span><span>{event.assignee}</span></footer>
                    {canManage && event.status !== 'Hoàn tất' && (
                      <span
                        className="agenda-complete"
                        role="button"
                        tabIndex={0}
                        onClick={(clickEvent) => { clickEvent.stopPropagation(); onComplete(event) }}
                        onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter') { keyEvent.stopPropagation(); onComplete(event) } }}
                      >
                        <CheckCircle2 size={14} /> Đánh dấu hoàn tất
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
            {!selectedEvents.length && <div className="agenda-empty">Không có công việc trong ngày này.</div>}
          </div>
          {canManage && <button className="agenda-add" type="button" onClick={onAddEvent}><Plus size={16} /> Thêm lịch ngày {selectedDate.slice(8, 10)}/{selectedDate.slice(5, 7)}</button>}
        </aside>
      </div>

      <section className="reminder-panel" id="reminder-rules">
        <header>
          <div className="reminder-icon"><CalendarDays size={21} /></div>
          <div>
            <strong>Nhắc hẹn đã đến ngưỡng</strong>
            <span>Mỗi lịch tự bật nhắc theo số ngày “nhắc trước” đã cài khi tạo.</span>
          </div>
          <span className="reminder-status"><CheckCircle2 size={16} /> {dueSoon.length + overdueCount} nhắc hẹn</span>
        </header>
        <div className="reminder-list">
          {overdueEvents.slice(0, 4).map((event) => {
            const device = getDeviceById(devices, event.deviceId)
            return (
              <button className="reminder-row overdue" type="button" key={event.id} onClick={() => onOpenEvent(event)}>
                <CircleAlert size={16} />
                <div><strong>{event.type} — {device?.name}</strong><small>{formatDate(event.date)} · {dueLabel(event.date)} · {event.provider}</small></div>
              </button>
            )
          })}
          {dueSoon.slice(0, 4).map((event) => {
            const device = getDeviceById(devices, event.deviceId)
            return (
              <button className="reminder-row" type="button" key={event.id} onClick={() => onOpenEvent(event)}>
                <Clock3 size={16} />
                <div><strong>{event.type} — {device?.name}</strong><small>{formatDate(event.date)} · {dueLabel(event.date)} · nhắc trước {event.reminderDays} ngày</small></div>
              </button>
            )
          })}
          {!dueSoon.length && !overdueCount && <div className="agenda-empty">Chưa có nhắc hẹn nào đến ngưỡng.</div>}
        </div>
      </section>
    </div>
  )
}
