import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Bell,
  BellOff,
  Building2,
  CalendarClock,
  Check,
  ChevronDown,
  CloudOff,
  FileChartColumn,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  PackageSearch,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  ShieldCheck,
  Siren,
  Stethoscope,
  UserRoundCog,
  X,
} from 'lucide-react'
import type { AlertItem, Branch, BranchId, Device, UserAccount, ViewId } from '../types'
import { roleLabel } from '../types'
import { initials, normalizeText } from '../utils'
import { DeviceVisual } from './Shared'

const NAV_COLLAPSED_KEY = 'xuyen-a-nav-collapsed'
const COMPACT_QUERY = '(max-width: 1199px)'
const MOBILE_QUERY = '(max-width: 767px)'

type NavItem = { id: ViewId; label: string; short: string; icon: typeof LayoutDashboard; roles?: UserAccount['role'][] }

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Tổng quan', short: 'Tổng quan', icon: LayoutDashboard },
  { id: 'devices', label: 'Thiết bị', short: 'Thiết bị', icon: PackageSearch },
  { id: 'incidents', label: 'Sự cố & sửa chữa', short: 'Sự cố', icon: Siren },
  { id: 'maintenance', label: 'Lịch bảo trì', short: 'Lịch', icon: CalendarClock },
  { id: 'reports', label: 'Báo cáo', short: 'Báo cáo', icon: FileChartColumn },
  { id: 'organization', label: 'Đơn vị & phân quyền', short: 'Đơn vị', icon: Building2, roles: ['admin', 'moderator'] },
]

const pageTitles: Record<ViewId, string> = {
  dashboard: 'Trung tâm vận hành',
  devices: 'Danh mục thiết bị',
  incidents: 'Sự cố & sửa chữa',
  maintenance: 'Lịch bảo trì',
  reports: 'Báo cáo & thống kê',
  organization: 'Đơn vị & phân quyền',
}

const roleIcon = (role: UserAccount['role']) =>
  role === 'admin' ? <ShieldCheck size={16} /> : role === 'moderator' ? <UserRoundCog size={16} /> : <Stethoscope size={16} />

export default function AppShell({
  currentView,
  onNavigate,
  alerts,
  onOpenAlert,
  search,
  onSearch,
  onNewIncident,
  onOpenDevice,
  devices = [],
  children,
  sidebarOpen,
  setSidebarOpen,
  notificationsOpen,
  setNotificationsOpen,
  branches,
  selectedBranchId,
  onBranchChange,
  currentUser,
  scopeName,
  offline,
  onLogout,
  onChangePassword,
}: {
  currentView: ViewId
  onNavigate: (view: ViewId) => void
  alerts: AlertItem[]
  onOpenAlert: (target: AlertItem) => void
  search: string
  onSearch: (value: string) => void
  onNewIncident: () => void
  onOpenDevice?: (device: Device) => void
  devices?: Device[]
  children: ReactNode
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  notificationsOpen: boolean
  setNotificationsOpen: (open: boolean) => void
  branches: Branch[]
  selectedBranchId: BranchId | 'all'
  onBranchChange: (branchId: BranchId | 'all') => void
  currentUser: UserAccount
  scopeName: string
  offline: boolean
  onLogout: () => void
  onChangePassword: () => void
}) {
  const [branchMenuOpen, setBranchMenuOpen] = useState(false)
  // Thu gon menu trai: nguoi dung tu bam, lua chon duoc nho lai.
  // Lan dau mo tren man hinh hep thi mac dinh thu gon san.
  const [collapsed, setCollapsed] = useState(() => {
    const stored = window.localStorage.getItem(NAV_COLLAPSED_KEY)
    return stored === null ? window.matchMedia(COMPACT_QUERY).matches : stored === '1'
  })
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [searchFocused, setSearchFocused] = useState(false)
  const [searchIndex, setSearchIndex] = useState(0)
  const searchBoxRef = useRef<HTMLFormElement>(null)

  const visibleNav = navItems.filter((item) => !item.roles || item.roles.includes(currentUser.role))
  const selectedBranch = branches.find((branch) => branch.id === selectedBranchId)
  const branchLabel = selectedBranch?.name ?? 'Tất cả chi nhánh'
  const canSwitchBranch = currentUser.role === 'admin'
  const urgentCount = alerts.filter((alert) => alert.severity === 'danger').length
  const urgentOverdueCount = alerts.filter((alert) => alert.urgent).length
  const todayLabel = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit' }).format(new Date())

  const suggestResults = useMemo(() => {
    const query = normalizeText(search.trim())
    if (!query) return []
    return devices
      .filter((device) => normalizeText(
        `${device.name} ${device.code} ${device.model} ${device.serial} ${device.department}`,
      ).includes(query))
      .slice(0, 6)
  }, [devices, search])

  const showSuggest = searchFocused && search.trim().length > 0

  const handleSearch = (event: FormEvent) => {
    event.preventDefault()
    if (search.trim()) {
      if (suggestResults[searchIndex] && onOpenDevice) {
        onOpenDevice(suggestResults[searchIndex])
      } else {
        onNavigate('devices')
      }
      setSearchFocused(false)
    }
  }

  const changeSearch = (value: string) => {
    onSearch(value)
    setSearchIndex(0)
  }

  // Click outside để đóng gợi ý
  useEffect(() => {
    if (!showSuggest) return undefined
    const onDocMouseDown = (event: MouseEvent) => {
      if (searchBoxRef.current && !searchBoxRef.current.contains(event.target as Node)) {
        setSearchFocused(false)
      }
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [showSuggest])

  const handleSearchKeyDown = (event: React.KeyboardEvent) => {
    if (!showSuggest) return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSearchIndex((current) => Math.min(current + 1, suggestResults.length - 1))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSearchIndex((current) => Math.max(current - 1, 0))
    } else if (event.key === 'Escape') {
      setSearchFocused(false)
    }
  }

  const pickSuggestion = (device: Device) => {
    if (onOpenDevice) onOpenDevice(device)
    else onNavigate('devices')
    setSearchFocused(false)
  }

  useEffect(() => {
    const mobile = window.matchMedia(MOBILE_QUERY)
    const onChange = (event: MediaQueryListEvent) => setIsMobile(event.matches)
    mobile.addEventListener('change', onChange)
    return () => mobile.removeEventListener('change', onChange)
  }, [])

  const toggleCollapsed = () => {
    const next = !collapsed
    setCollapsed(next)
    window.localStorage.setItem(NAV_COLLAPSED_KEY, next ? '1' : '0')
  }

  // Tren dien thoai luon dung ngan keo day du, khong bao gio vao che do rail.
  const rail = collapsed && !isMobile

  const navigate = (view: ViewId) => {
    onNavigate(view)
    setSidebarOpen(false)
  }

  const closeMenus = () => {
    setBranchMenuOpen(false)
    setProfileMenuOpen(false)
    setNotificationsOpen(false)
  }

  return (
    <div className={`app-shell ${rail ? 'rail' : ''}`}>
      {sidebarOpen && <button className="sidebar-scrim" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu" />}

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="brand-row">
          <span className="brand-mark"><HeartPulse size={22} /></span>
          <div className="brand-copy">
            <strong>Xuyên Á</strong>
            <span>Quản lý TBYT</span>
          </div>
          <button className="sidebar-close" onClick={() => setSidebarOpen(false)} aria-label="Đóng menu"><X size={20} /></button>
        </div>

        <div className="scope-block">
          <button
            className={`facility-switcher ${branchMenuOpen ? 'open' : ''}`}
            type="button"
            onClick={() => canSwitchBranch && setBranchMenuOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={branchMenuOpen}
            disabled={!canSwitchBranch}
            title={rail ? (currentUser.role === 'department' ? currentUser.department : branchLabel) : undefined}
          >
            <span className="facility-icon"><Building2 size={17} /></span>
            <div>
              <small>Phạm vi dữ liệu</small>
              <strong>{currentUser.role === 'department' ? currentUser.department : branchLabel}</strong>
            </div>
            {canSwitchBranch && <ChevronDown size={15} />}
          </button>
          {currentUser.role === 'department' && <span className="scope-sub">{branchLabel}</span>}

          {branchMenuOpen && canSwitchBranch && (
            <div className="branch-menu" role="listbox" aria-label="Chọn chi nhánh">
              <button
                className={selectedBranchId === 'all' ? 'active' : ''}
                type="button"
                role="option"
                aria-selected={selectedBranchId === 'all'}
                onClick={() => { onBranchChange('all'); setBranchMenuOpen(false) }}
              >
                <span className="branch-menu-icon all"><Building2 size={15} /></span>
                <span><strong>Tất cả chi nhánh</strong><small>Toàn hệ thống Xuyên Á</small></span>
                {selectedBranchId === 'all' && <Check size={15} />}
              </button>
              {branches.map((branch) => (
                <button
                  className={selectedBranchId === branch.id ? 'active' : ''}
                  type="button"
                  role="option"
                  aria-selected={selectedBranchId === branch.id}
                  key={branch.id}
                  onClick={() => { onBranchChange(branch.id); setBranchMenuOpen(false) }}
                >
                  <span className="branch-menu-icon"><Building2 size={15} /></span>
                  <span><strong>{branch.name}</strong><small>{branch.region}</small></span>
                  {selectedBranchId === branch.id && <Check size={15} />}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="primary-nav" aria-label="Điều hướng chính">
          <span className="nav-label">Quản lý</span>
          {visibleNav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={currentView === id ? 'active' : ''}
              onClick={() => navigate(id)}
              type="button"
              title={rail ? label : undefined}
            >
              <Icon size={18} />
              <span>{label}</span>
              {id === 'incidents' && urgentCount > 0 && <b className="nav-count">{urgentCount}</b>}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-user">
            <span className="user-avatar">{initials(currentUser.displayName)}</span>
            <div>
              <strong>{currentUser.displayName}</strong>
              <small>{roleLabel(currentUser.role)}</small>
            </div>
          </div>
          <button
            className="sidebar-utility sidebar-collapse"
            type="button"
            onClick={toggleCollapsed}
            title={rail ? 'Bung menu' : 'Thu gọn menu'}
            aria-label={rail ? 'Bung menu' : 'Thu gọn menu'}
            aria-expanded={!rail}
          >
            {rail ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            <span>Thu gọn menu</span>
          </button>
          <button className="sidebar-utility" type="button" onClick={onChangePassword} title={rail ? 'Đổi mật khẩu' : undefined}>
            <KeyRound size={17} /><span>Đổi mật khẩu</span>
          </button>
          <button className="sidebar-utility" type="button" onClick={onLogout} title={rail ? 'Đăng xuất' : undefined}>
            <LogOut size={17} /><span>Đăng xuất</span>
          </button>
          <div className={`system-state ${offline ? 'offline' : ''}`}>
            {offline ? <CloudOff size={15} /> : <span className="online-dot" />}
            <div>
              <strong>{offline ? 'Mất kết nối máy chủ' : 'Hệ thống ổn định'}</strong>
              <span>{offline ? 'Đang thử kết nối lại' : 'Dữ liệu đồng bộ tự động'}</span>
            </div>
          </div>
        </div>
      </aside>

      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" type="button" onClick={() => setSidebarOpen(true)} aria-label="Mở menu">
              <Menu size={21} />
            </button>
            <div className="topbar-title">
              <span>{todayLabel}</span>
              <strong>{pageTitles[currentView]}</strong>
            </div>
            <span className="topbar-scope" title={scopeName}>
              {roleIcon(currentUser.role)}
              <span>{scopeName}</span>
            </span>
          </div>

          <form
            className={`global-search ${showSuggest ? 'open' : ''}`}
            onSubmit={handleSearch}
            ref={searchBoxRef}
          >
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
              onFocus={() => setSearchFocused(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Tìm mã, tên, model, seri..."
              aria-label="Tìm kiếm thiết bị"
              aria-expanded={showSuggest && suggestResults.length > 0}
              aria-haspopup="listbox"
            />
            <kbd>Ctrl K</kbd>
            {showSuggest && (
              <div className="search-suggest" role="listbox">
                {suggestResults.length > 0 ? (
                  <>
                    <div className="search-suggest-head">Thiết bị ({suggestResults.length})</div>
                    {suggestResults.map((device, index) => (
                      <button
                        key={device.id}
                        type="button"
                        role="option"
                        aria-selected={index === searchIndex}
                        className={`search-suggest-item ${index === searchIndex ? 'active' : ''}`}
                        onMouseEnter={() => setSearchIndex(index)}
                        onClick={() => pickSuggestion(device)}
                      >
                        <DeviceVisual category={device.category} size="sm" />
                        <div>
                          <strong>{device.name}</strong>
                          <small>{device.code} · {device.department}</small>
                        </div>
                        <kbd>↵</kbd>
                      </button>
                    ))}
                    <div className="search-suggest-head" style={{ marginTop: 4 }}>
                      Nhấn Enter để xem trang thiết bị đầy đủ
                    </div>
                  </>
                ) : (
                  <div className="search-suggest-empty">
                    Không tìm thấy thiết bị nào khớp với “{search.trim()}”
                  </div>
                )}
              </div>
            )}
          </form>

          <button className="mobile-search-button" type="button" onClick={() => navigate('devices')} aria-label="Tìm thiết bị">
            <Search size={19} />
          </button>

          <div className="topbar-actions">
            <button className="quick-create" type="button" onClick={onNewIncident}>
              <Plus size={17} />
              <span>Báo hỏng</span>
            </button>

            <div className="notification-wrap">
              <button
                className={`icon-button notification-button ${notificationsOpen ? 'open' : ''}`}
                type="button"
                aria-label={`Cảnh báo (${alerts.length})`}
                onClick={() => { setProfileMenuOpen(false); setBranchMenuOpen(false); setNotificationsOpen(!notificationsOpen) }}
              >
                <Bell size={19} />
                {alerts.length > 0 && <span className={`bell-dot ${urgentCount ? 'urgent' : ''}`}>{alerts.length > 9 ? '9+' : alerts.length}</span>}
              </button>
              {notificationsOpen && (
                <div className="notification-panel">
                  <div className="notification-head">
                    <div>
                      <strong>Cảnh báo cần xử lý</strong>
                      <small>
                        {alerts.length} mục · {scopeName}
                        {urgentOverdueCount > 0 && <> · <b className="notification-urgent-count">{urgentOverdueCount} khẩn</b></>}
                      </small>
                    </div>
                    <button type="button" onClick={() => setNotificationsOpen(false)} aria-label="Đóng"><X size={16} /></button>
                  </div>
                  <div className="notification-list">
                    {alerts.length ? alerts.slice(0, 12).map((alert) => (
                      <button className={`notification-item ${alert.severity} ${alert.urgent ? 'urgent' : ''}`} type="button" key={alert.id} onClick={() => onOpenAlert(alert)}>
                        <span>
                          {alert.kind === 'incident' || alert.kind === 'follow-up' ? <Siren size={16} />
                            : alert.kind === 'warranty' || alert.kind === 'warranty-overdue' ? <ShieldCheck size={16} />
                              : <CalendarClock size={16} />}
                        </span>
                        <div>
                          <strong>{alert.urgent && <i className="urgent-tag">KHẨN</i>}{alert.title}</strong>
                          <p>{alert.detail}</p>
                          <small>{alert.meta}</small>
                        </div>
                      </button>
                    )) : (
                      <div className="notification-empty">
                        <BellOff size={22} />
                        <strong>Không có cảnh báo</strong>
                        <p>Mọi thiết bị trong phạm vi đang hoạt động đúng lịch.</p>
                      </div>
                    )}
                  </div>
                  {alerts.length > 12 && <footer className="notification-foot">+{alerts.length - 12} cảnh báo khác</footer>}
                </div>
              )}
            </div>

            <div className="profile-wrap">
              <button
                className={`user-menu ${profileMenuOpen ? 'open' : ''}`}
                type="button"
                onClick={() => { setProfileMenuOpen((open) => !open); setNotificationsOpen(false); setBranchMenuOpen(false) }}
                aria-haspopup="menu"
                aria-expanded={profileMenuOpen}
              >
                <span className="user-avatar">{initials(currentUser.displayName)}</span>
                <span className="user-copy">
                  <strong>{currentUser.displayName}</strong>
                  <small>{roleLabel(currentUser.role)}</small>
                </span>
                <ChevronDown size={14} />
              </button>
              {profileMenuOpen && (
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-head">
                    <span className="user-avatar">{initials(currentUser.displayName)}</span>
                    <div>
                      <strong>{currentUser.displayName}</strong>
                      <small>@{currentUser.username}</small>
                    </div>
                  </div>
                  <div className="profile-menu-scope">
                    {roleIcon(currentUser.role)}
                    <div><strong>{roleLabel(currentUser.role)}</strong><small>{scopeName}</small></div>
                  </div>
                  <button type="button" role="menuitem" onClick={() => { closeMenus(); onChangePassword() }}>
                    <KeyRound size={16} /> Đổi mật khẩu
                  </button>
                  <button className="profile-logout" type="button" role="menuitem" onClick={() => { closeMenus(); onLogout() }}>
                    <LogOut size={16} /> Đăng xuất
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="main-content">{children}</main>

        <nav className="mobile-nav" aria-label="Điều hướng nhanh">
          {visibleNav.slice(0, 5).map(({ id, short, icon: Icon }) => (
            <button key={id} className={currentView === id ? 'active' : ''} type="button" onClick={() => navigate(id)}>
              <Icon size={20} />
              <span>{short}</span>
              {id === 'incidents' && urgentCount > 0 && <i />}
            </button>
          ))}
        </nav>
      </div>
    </div>
  )
}
