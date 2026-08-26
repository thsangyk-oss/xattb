import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, TriangleAlert } from 'lucide-react'
import {
  changePasswordOnServer,
  createDepartmentOnServer,
  createDeviceOnServer,
  createEventOnServer,
  createIncidentOnServer,
  createUserOnServer,
  deleteDepartmentOnServer,
  deleteDeviceOnServer,
  deleteDocumentOnServer,
  deleteEventOnServer,
  deleteUserOnServer,
  getCurrentUserOnServer,
  getServerState,
  loginOnServer,
  logoutOnServer,
  setAuthToken,
  updateDepartmentOnServer,
  updateDeviceOnServer,
  updateEventOnServer,
  updateIncidentOnServer,
  updatePermissionOnServer,
  updateUserOnServer,
  uploadDocumentToServer,
  uploadIncidentPhotoToServer,
} from './api'
import AppShell from './components/AppShell'
import {
  DeviceDetailDialog,
  DeviceFormDialog,
  IncidentDetailDialog,
  MaintenanceDetailDialog,
  NewIncidentDialog,
  NewMaintenanceDialog,
  PasswordDialog,
  QrDialog,
  UserAccountDialog,
} from './components/Dialogs'
import { branches as seedBranches, defaultUserPassword, hospitalName } from './data'
import type {
  AccessPermission,
  Branch,
  BranchId,
  Department,
  Device,
  DocumentType,
  Incident,
  IncidentStatus,
  MaintenanceEvent,
  UserAccount,
  ViewId,
} from './types'
import { buildAlerts } from './utils'
import PublicReportView from './views/PublicReportView'
import LoginView from './views/LoginView'

const DashboardView = lazy(() => import('./views/DashboardView'))
const DevicesView = lazy(() => import('./views/DevicesView'))
const IncidentsView = lazy(() => import('./views/IncidentsView'))
const MaintenanceView = lazy(() => import('./views/MaintenanceView'))
const OrganizationView = lazy(() => import('./views/OrganizationView'))
const ReportsView = lazy(() => import('./views/ReportsView'))

type DialogId = 'add-device' | 'new-incident' | 'new-maintenance' | 'add-user' | 'password' | null
type BranchScope = BranchId | 'all'
type AuthSession = { token: string; user: UserAccount }

const SESSION_KEY = 'xuyen-a-session'
const BRANCH_KEY = 'xuyen-a-branch'

function loadStored<T>(key: string, fallback: T): T {
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export default function App() {
  const [view, setView] = useState<ViewId>('dashboard')

  // Dữ liệu luôn đến từ máy chủ và đã được lọc theo quyền của tài khoản.
  // Không cache vào localStorage để tránh rò rỉ dữ liệu ngoài phạm vi.
  const [devices, setDevices] = useState<Device[]>([])
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [events, setEvents] = useState<MaintenanceEvent[]>([])
  const [permissions, setPermissions] = useState<AccessPermission[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [users, setUsers] = useState<UserAccount[]>([])
  const [branchCatalog, setBranchCatalog] = useState<Branch[]>(seedBranches)
  const [hospitalLabel, setHospitalLabel] = useState(hospitalName)
  const [loadingData, setLoadingData] = useState(true)
  const [offline, setOffline] = useState(false)

  const [session, setSession] = useState<AuthSession | null>(() => loadStored<AuthSession | null>(SESSION_KEY, null))
  const [selectedBranchId, setSelectedBranchId] = useState<BranchScope>(() => loadStored<BranchScope>(BRANCH_KEY, 'all'))
  const [authError, setAuthError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(false)

  const [dialog, setDialog] = useState<DialogId>(null)
  const [editingDevice, setEditingDevice] = useState<Device | null>(null)
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null)
  const [qrDeviceId, setQrDeviceId] = useState<string | null>(null)
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null)
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [incidentDeviceId, setIncidentDeviceId] = useState<string | undefined>()
  const [globalSearch, setGlobalSearch] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const [toast, setToast] = useState<{ message: string; tone: 'ok' | 'error' } | null>(null)

  const publicDeviceId = new URLSearchParams(window.location.search).get('device')

  const showToast = useCallback((message: string, tone: 'ok' | 'error' = 'ok') => setToast({ message, tone }), [])
  const showError = useCallback((error: unknown) => {
    showToast(error instanceof Error ? error.message : 'Thao tác không thành công', 'error')
  }, [showToast])

  const role = session?.user.role
  const canManageDevices = role === 'admin' || role === 'moderator'
  const canManageBranch = canManageDevices
  const isDepartmentUser = role === 'department'
  const sessionToken = session?.token

  /* ------------------------------------------------------------ scope */

  const validAdminBranch = selectedBranchId === 'all' || branchCatalog.some((branch) => branch.id === selectedBranchId)
  const effectiveBranchId: BranchScope = role === 'admin'
    ? (validAdminBranch ? selectedBranchId : 'all')
    : session?.user.branchId ?? 'all'
  const selectedBranch = branchCatalog.find((branch) => branch.id === effectiveBranchId)
  const scopeName = isDepartmentUser
    ? `${session?.user.department} · ${selectedBranch?.shortName ?? ''}`.trim()
    : selectedBranch?.name ?? hospitalLabel

  const visibleDevices = useMemo(
    () => effectiveBranchId === 'all' ? devices : devices.filter((device) => device.branchId === effectiveBranchId),
    [devices, effectiveBranchId],
  )
  const visibleDeviceIds = useMemo(() => new Set(visibleDevices.map((device) => device.id)), [visibleDevices])
  const visibleIncidents = useMemo(
    () => incidents.filter((incident) => visibleDeviceIds.has(incident.deviceId)),
    [incidents, visibleDeviceIds],
  )
  const visibleEvents = useMemo(
    () => events.filter((event) => visibleDeviceIds.has(event.deviceId)),
    [events, visibleDeviceIds],
  )
  const visibleDepartments = useMemo(
    () => effectiveBranchId === 'all' ? departments : departments.filter((item) => item.branchId === effectiveBranchId),
    [departments, effectiveBranchId],
  )
  const visiblePermissions = useMemo(
    () => effectiveBranchId === 'all' ? permissions : permissions.filter((item) => item.branchId === effectiveBranchId),
    [permissions, effectiveBranchId],
  )
  const alerts = useMemo(
    () => buildAlerts(visibleDevices, visibleIncidents, visibleEvents),
    [visibleDevices, visibleEvents, visibleIncidents],
  )

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId)
  const qrDevice = devices.find((device) => device.id === qrDeviceId)
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId)
  const selectedEvent = events.find((event) => event.id === selectedEventId)

  /* ------------------------------------------------------------ effects */

  useEffect(() => {
    // Biểu mẫu QR luôn gửi ẩn danh: người quét mã có thể là điều dưỡng bất kỳ,
    // không nên bị chặn bởi phạm vi của tài khoản đang đăng nhập trên máy đó.
    setAuthToken(publicDeviceId ? null : session?.token ?? null)
    if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else window.localStorage.removeItem(SESSION_KEY)
  }, [publicDeviceId, session])

  useEffect(() => window.localStorage.setItem(BRANCH_KEY, JSON.stringify(selectedBranchId)), [selectedBranchId])

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' })
  }, [view, effectiveBranchId])

  const syncFromServer = useCallback(async () => {
    const serverState = await getServerState()
    setDevices(serverState.devices ?? [])
    setIncidents(serverState.incidents ?? [])
    setEvents(serverState.events ?? [])
    setPermissions(serverState.permissions ?? [])
    setDepartments(serverState.departments ?? [])
    setUsers(serverState.users ?? [])
    if (serverState.branches?.length) setBranchCatalog(serverState.branches)
    if (serverState.hospitalName) setHospitalLabel(serverState.hospitalName)
  }, [])

  // Đồng bộ định kỳ trong khi còn phiên đăng nhập
  useEffect(() => {
    if (!sessionToken || publicDeviceId) return undefined
    let active = true

    const run = async (initial: boolean) => {
      try {
        await syncFromServer()
        if (!active) return
        setOffline(false)
      } catch (error) {
        if (!active) return
        if (error instanceof Error && error.message.includes('Phiên')) {
          setAuthToken(null)
          setSession(null)
          return
        }
        setOffline(true)
        if (initial) showToast('Không kết nối được máy chủ', 'error')
      } finally {
        if (active && initial) setLoadingData(false)
      }
    }

    void run(true)
    const interval = window.setInterval(() => void run(false), 20_000)
    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [publicDeviceId, sessionToken, showToast, syncFromServer])

  useEffect(() => {
    if (!sessionToken || publicDeviceId) return undefined
    let active = true
    void getCurrentUserOnServer()
      .then((user) => {
        if (active) setSession((current) => current ? { ...current, user } : current)
      })
      .catch((error: Error) => {
        if (active && error.message.includes('Phiên')) {
          setAuthToken(null)
          setSession(null)
        }
      })
    return () => { active = false }
  }, [publicDeviceId, sessionToken])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 3600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const closeAllOverlays = useCallback(() => {
    setDialog(null)
    setEditingDevice(null)
    setSelectedDeviceId(null)
    setQrDeviceId(null)
    setSelectedIncidentId(null)
    setSelectedEventId(null)
    setNotificationsOpen(false)
  }, [])

  useEffect(() => {
    const handleShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.global-search input')?.focus()
      }
      if (event.key === 'Escape') closeAllOverlays()
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [closeAllOverlays])

  /* ------------------------------------------------------------ auth */

  const login = async (username: string, password: string) => {
    setAuthLoading(true)
    setAuthError(null)
    try {
      const result = await loginOnServer(username, password)
      setAuthToken(result.token)
      setSession({ token: result.token, user: result.user })
      setSelectedBranchId(result.user.role === 'admin' ? 'all' : result.user.branchId ?? 'all')
      setView('dashboard')
      setLoadingData(true)
      showToast(`Xin chào ${result.user.displayName}`)
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : 'Không thể đăng nhập')
    } finally {
      setAuthLoading(false)
    }
  }

  const logout = () => {
    void logoutOnServer().catch(() => undefined)
    setAuthToken(null)
    setSession(null)
    setSelectedBranchId('all')
    setDevices([])
    setIncidents([])
    setEvents([])
    setUsers([])
    closeAllOverlays()
  }

  const changePassword = async (currentPassword: string, newPassword: string) => {
    await changePasswordOnServer(currentPassword, newPassword)
    setDialog(null)
    showToast('Đã đổi mật khẩu')
  }

  const changeBranch = (branchId: BranchScope) => {
    if (role !== 'admin') return
    setSelectedBranchId(branchId)
    closeAllOverlays()
    setIncidentDeviceId(undefined)
  }

  /* ------------------------------------------------------------ devices */

  const saveDevice = (device: Device) => {
    const isEdit = devices.some((item) => item.id === device.id)
    const target = role === 'moderator' ? { ...device, branchId: session!.user.branchId! } : device
    if (isEdit) {
      void updateDeviceOnServer(target.id, target)
        .then((saved) => {
          setDevices((current) => current.map((item) => item.id === saved.id ? saved : item))
          showToast(`Đã cập nhật ${saved.name}`)
        })
        .catch(showError)
    } else {
      void createDeviceOnServer(target)
        .then((saved) => {
          setDevices((current) => [saved, ...current])
          setSelectedDeviceId(saved.id)
          setView('devices')
          showToast(`Đã thêm ${saved.name}`)
        })
        .catch(showError)
    }
    setDialog(null)
    setEditingDevice(null)
  }

  const removeDevice = (device: Device) => {
    if (!window.confirm(`Xóa vĩnh viễn hồ sơ "${device.name}" (${device.code})?`)) return
    void deleteDeviceOnServer(device.id)
      .then(() => {
        setDevices((current) => current.filter((item) => item.id !== device.id))
        setIncidents((current) => current.filter((item) => item.deviceId !== device.id))
        setEvents((current) => current.filter((item) => item.deviceId !== device.id))
        setSelectedDeviceId(null)
        showToast(`Đã xóa ${device.code}`)
      })
      .catch(showError)
  }

  const addDocument = (device: Device, file: File, type: DocumentType) => {
    void uploadDocumentToServer(device.id, file, type)
      .then(({ device: saved }) => {
        setDevices((current) => current.map((item) => item.id === saved.id ? saved : item))
        showToast(`Đã tải lên ${file.name}`)
      })
      .catch(showError)
  }

  const removeDocument = (device: Device, documentId: string) => {
    void deleteDocumentOnServer(device.id, documentId)
      .then((saved) => {
        setDevices((current) => current.map((item) => item.id === saved.id ? saved : item))
        showToast('Đã xóa tài liệu')
      })
      .catch(showError)
  }

  const toggleShared = (device: Device) => {
    const shared = !device.shared
    setDevices((current) => current.map((item) => item.id === device.id ? { ...item, shared } : item))
    void updateDeviceOnServer(device.id, { shared })
      .then(() => showToast(shared ? 'Đã cho phép khoa khác xem và mượn' : 'Đã thu hồi quyền xem liên khoa'))
      .catch((error) => {
        setDevices((current) => current.map((item) => item.id === device.id ? { ...item, shared: !shared } : item))
        showError(error)
      })
  }

  /* ---------------------------------------------------------- incidents */

  const addIncident = (incident: Incident, photo?: File) => {
    void createIncidentOnServer(incident)
      .then((saved) => photo ? uploadIncidentPhotoToServer(saved.id, photo) : saved)
      .then((saved) => {
        if (publicDeviceId) return
        setIncidents((current) => [saved, ...current.filter((item) => item.id !== saved.id)])
        setDevices((current) => current.map((device) => device.id === saved.deviceId
          ? { ...device, status: 'Đang sửa chữa' as const }
          : device))
        setView('incidents')
        setSelectedIncidentId(saved.id)
        showToast(`Đã tiếp nhận ${saved.code}`)
      })
      .catch(showError)
    setDialog(null)
    setIncidentDeviceId(undefined)
  }

  const updateIncidentStatus = (incident: Incident, status: IncidentStatus) => {
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, status } : item))
    if (status === 'Đã hoàn tất') {
      setDevices((current) => current.map((device) => device.id === incident.deviceId
        ? { ...device, status: 'Đang hoạt động' as const }
        : device))
    }
    void updateIncidentOnServer(incident.id, { status })
      .then(() => showToast(`Đã chuyển sang “${status}”`))
      .catch(showError)
  }

  const assignIncident = (incident: Incident, assignee: string) => {
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, assignee } : item))
    void updateIncidentOnServer(incident.id, { assignee })
      .then(() => showToast(`Đã phân công ${assignee}`))
      .catch(showError)
  }

  const addIncidentNote = (incident: Incident, content: string, nextDate: string) => {
    const note = {
      id: `note-${Date.now()}`,
      author: session?.user.displayName ?? 'Phòng TTBYT',
      content,
      time: new Intl.DateTimeFormat('vi-VN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date()),
    }
    const notes = [...incident.notes, note]
    const changes: Partial<Incident> = isDepartmentUser
      ? { notes }
      : {
        notes,
        nextActionDate: nextDate,
        status: incident.status === 'Mới tiếp nhận' ? 'Đang xử lý' : incident.status,
      }
    setIncidents((current) => current.map((item) => item.id === incident.id ? { ...item, ...changes } : item))
    void updateIncidentOnServer(incident.id, changes)
      .then((saved) => {
        setIncidents((current) => current.map((item) => item.id === saved.id ? saved : item))
        showToast('Đã lưu ghi chú xử lý')
      })
      .catch(showError)
  }

  /* ------------------------------------------------------------- events */

  const addMaintenance = (event: MaintenanceEvent) => {
    void createEventOnServer(event)
      .then((saved) => {
        setEvents((current) => [...current, saved].sort((a, b) => a.date.localeCompare(b.date)))
        setView('maintenance')
        showToast('Đã tạo lịch và cài nhắc hẹn')
      })
      .catch(showError)
    setDialog(null)
  }

  const updateMaintenance = (event: MaintenanceEvent, changes: Partial<MaintenanceEvent>) => {
    void updateEventOnServer(event.id, changes)
      .then((saved) => {
        setEvents((current) => current.map((item) => item.id === saved.id ? saved : item))
        if (changes.status === 'Hoàn tất') void syncFromServer().catch(() => undefined)
        showToast('Đã cập nhật lịch công việc')
      })
      .catch(showError)
  }

  const removeMaintenance = (event: MaintenanceEvent) => {
    void deleteEventOnServer(event.id)
      .then(() => {
        setEvents((current) => current.filter((item) => item.id !== event.id))
        setSelectedEventId(null)
        showToast('Đã hủy lịch công việc')
      })
      .catch(showError)
  }

  /* ------------------------------------------------- org & permissions */

  const togglePermission = (permission: AccessPermission, key: 'view' | 'borrow' | 'approve') => {
    const value = !permission[key]
    setPermissions((current) => current.map((item) => item.id === permission.id ? { ...item, [key]: value } : item))
    void updatePermissionOnServer(permission.id, { [key]: value })
      .then(() => showToast('Đã cập nhật quyền truy cập'))
      .catch((error) => {
        setPermissions((current) => current.map((item) => item.id === permission.id ? { ...item, [key]: !value } : item))
        showError(error)
      })
  }

  const addDepartment = (department: Partial<Department>) => {
    void createDepartmentOnServer(department)
      .then((saved) => {
        setDepartments((current) => [...current, saved])
        void syncFromServer().catch(() => undefined)
        showToast(`Đã thêm ${saved.name}`)
      })
      .catch(showError)
  }

  const editDepartment = (id: string, changes: Partial<Department>) => {
    void updateDepartmentOnServer(id, changes)
      .then((saved) => {
        setDepartments((current) => current.map((item) => item.id === saved.id ? saved : item))
        showToast('Đã cập nhật khoa/phòng')
      })
      .catch(showError)
  }

  const removeDepartment = (department: Department) => {
    if (!window.confirm(`Xóa "${department.name}" khỏi cơ cấu?`)) return
    void deleteDepartmentOnServer(department.id)
      .then(() => {
        setDepartments((current) => current.filter((item) => item.id !== department.id))
        setPermissions((current) => current.filter((item) => item.id !== `perm-${department.id}`))
        showToast('Đã xóa khoa/phòng')
      })
      .catch(showError)
  }

  const createUser = (user: Partial<UserAccount> & { password: string }) => {
    void createUserOnServer(user)
      .then((saved) => {
        setUsers((current) => [saved, ...current])
        showToast(`Đã tạo tài khoản ${saved.username}`)
      })
      .catch(showError)
    setDialog(null)
  }

  const toggleUser = (user: UserAccount) => {
    const active = !user.active
    setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active } : item))
    void updateUserOnServer(user.id, { active })
      .then(() => showToast(active ? `Đã mở tài khoản ${user.username}` : `Đã khóa tài khoản ${user.username}`))
      .catch((error) => {
        setUsers((current) => current.map((item) => item.id === user.id ? { ...item, active: !active } : item))
        showError(error)
      })
  }

  const resetPassword = (user: UserAccount) => {
    void updateUserOnServer(user.id, { password: defaultUserPassword })
      .then(() => showToast(`Đã đặt lại mật khẩu mặc định cho ${user.username}`))
      .catch(showError)
  }

  const removeUser = (user: UserAccount) => {
    if (!window.confirm(`Xóa tài khoản "${user.username}"?`)) return
    void deleteUserOnServer(user.id)
      .then(() => {
        setUsers((current) => current.filter((item) => item.id !== user.id))
        showToast(`Đã xóa tài khoản ${user.username}`)
      })
      .catch(showError)
  }

  /* ------------------------------------------------------------ render */

  const openQr = (device: Device) => {
    setSelectedDeviceId(null)
    setQrDeviceId(device.id)
  }

  const newIncident = (deviceId?: string) => {
    setIncidentDeviceId(deviceId)
    setDialog('new-incident')
  }

  const openEdit = (device: Device) => {
    setSelectedDeviceId(null)
    setEditingDevice(device)
    setDialog('add-device')
  }

  if (publicDeviceId) {
    return <PublicReportView deviceId={publicDeviceId} onCreate={addIncident} />
  }

  if (!session) {
    return <LoginView branches={branchCatalog} onLogin={login} error={authError} loading={authLoading} />
  }

  const dialogBranches = role === 'admin'
    ? branchCatalog
    : branchCatalog.filter((branch) => branch.id === session.user.branchId)
  const defaultDeviceBranch: BranchId = effectiveBranchId === 'all'
    ? dialogBranches[0]?.id ?? 'cu-chi'
    : effectiveBranchId
  const departmentNames = (visibleDepartments.length ? visibleDepartments : departments).map((item) => item.name)

  const openAlert = (target: { view: ViewId; deviceId?: string; incidentId?: string; eventId?: string }) => {
    setNotificationsOpen(false)
    setView(target.view)
    if (target.incidentId) setSelectedIncidentId(target.incidentId)
    else if (target.eventId) setSelectedEventId(target.eventId)
    else if (target.deviceId) setSelectedDeviceId(target.deviceId)
  }

  const renderView = () => {
    switch (view) {
      case 'devices':
        return <DevicesView
          devices={visibleDevices}
          currentUser={session.user}
          globalSearch={globalSearch}
          onSearch={setGlobalSearch}
          onAddDevice={canManageDevices ? () => { setEditingDevice(null); setDialog('add-device') } : undefined}
          onOpenDevice={(device) => setSelectedDeviceId(device.id)}
          onShowQr={openQr}
          onReport={(device) => newIncident(device.id)}
          scopeName={scopeName}
        />
      case 'incidents':
        return <IncidentsView
          devices={visibleDevices}
          incidents={visibleIncidents}
          currentUser={session.user}
          onNewIncident={() => newIncident()}
          onOpenIncident={(incident) => setSelectedIncidentId(incident.id)}
          onUpdateStatus={updateIncidentStatus}
          scopeName={scopeName}
        />
      case 'maintenance':
        return <MaintenanceView
          devices={visibleDevices}
          events={visibleEvents}
          canManage={canManageDevices}
          onAddEvent={() => setDialog('new-maintenance')}
          onOpenEvent={(event) => setSelectedEventId(event.id)}
          onComplete={(event) => updateMaintenance(event, { status: 'Hoàn tất' })}
          scopeName={scopeName}
        />
      case 'reports':
        return <ReportsView devices={visibleDevices} onToast={(message) => showToast(message)} scopeName={scopeName} />
      case 'organization':
        return <OrganizationView
          devices={visibleDevices}
          departments={visibleDepartments}
          permissions={visiblePermissions}
          users={users}
          branches={branchCatalog}
          currentUser={session.user}
          activeBranchId={effectiveBranchId}
          scopeName={scopeName}
          onTogglePermission={togglePermission}
          onAddDepartment={addDepartment}
          onEditDepartment={editDepartment}
          onRemoveDepartment={removeDepartment}
          onAddUser={() => setDialog('add-user')}
          onToggleUser={toggleUser}
          onResetPassword={resetPassword}
          onRemoveUser={removeUser}
        />
      default:
        return <DashboardView
          devices={visibleDevices}
          incidents={visibleIncidents}
          events={visibleEvents}
          alerts={alerts}
          currentUser={session.user}
          onNavigate={setView}
          onAddDevice={canManageDevices ? () => { setEditingDevice(null); setDialog('add-device') } : undefined}
          onNewIncident={() => newIncident()}
          onOpenDevice={(device) => setSelectedDeviceId(device.id)}
          onOpenAlert={openAlert}
          scopeName={scopeName}
        />
    }
  }

  return (
    <>
      <AppShell
        currentView={view}
        onNavigate={setView}
        alerts={alerts}
        onOpenAlert={openAlert}
        search={globalSearch}
        onSearch={setGlobalSearch}
        onNewIncident={() => newIncident()}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        notificationsOpen={notificationsOpen}
        setNotificationsOpen={setNotificationsOpen}
        branches={branchCatalog}
        selectedBranchId={effectiveBranchId}
        onBranchChange={changeBranch}
        currentUser={session.user}
        scopeName={scopeName}
        offline={offline}
        onLogout={logout}
        onChangePassword={() => setDialog('password')}
      >
        <Suspense fallback={<div className="view-loading"><span /><strong>Đang tải dữ liệu...</strong></div>}>
          {loadingData ? <div className="view-loading"><span /><strong>Đang tải dữ liệu...</strong></div> : renderView()}
        </Suspense>
      </AppShell>

      {dialog === 'add-device' && canManageDevices && (
        <DeviceFormDialog
          device={editingDevice}
          branches={dialogBranches}
          departments={departmentNames}
          defaultBranchId={defaultDeviceBranch}
          onClose={() => { setDialog(null); setEditingDevice(null) }}
          onSave={saveDevice}
        />
      )}
      {dialog === 'add-user' && canManageBranch && (
        <UserAccountDialog
          branches={dialogBranches}
          departments={departments}
          currentUser={session.user}
          onClose={() => setDialog(null)}
          onCreate={createUser}
        />
      )}
      {dialog === 'password' && (
        <PasswordDialog onClose={() => setDialog(null)} onSubmit={changePassword} />
      )}
      {dialog === 'new-incident' && (
        <NewIncidentDialog
          devices={visibleDevices}
          preselectedDeviceId={incidentDeviceId}
          reporterName={session.user.displayName}
          onClose={() => { setDialog(null); setIncidentDeviceId(undefined) }}
          onCreate={addIncident}
        />
      )}
      {dialog === 'new-maintenance' && canManageDevices && (
        <NewMaintenanceDialog devices={visibleDevices} onClose={() => setDialog(null)} onCreate={addMaintenance} />
      )}
      {selectedDevice && (
        <DeviceDetailDialog
          device={selectedDevice}
          incidents={incidents}
          events={events}
          canManage={canManageDevices}
          onClose={() => setSelectedDeviceId(null)}
          onShowQr={() => openQr(selectedDevice)}
          onEdit={() => openEdit(selectedDevice)}
          onDelete={() => removeDevice(selectedDevice)}
          onAddDocument={(file, type) => addDocument(selectedDevice, file, type)}
          onRemoveDocument={(documentId) => removeDocument(selectedDevice, documentId)}
          onToggleShared={() => toggleShared(selectedDevice)}
          onReport={() => { setSelectedDeviceId(null); newIncident(selectedDevice.id) }}
          onToast={(message) => showToast(message)}
        />
      )}
      {qrDevice && <QrDialog device={qrDevice} onClose={() => setQrDeviceId(null)} onToast={(message) => showToast(message)} />}
      {selectedIncident && (
        <IncidentDetailDialog
          incident={selectedIncident}
          devices={devices}
          canManage={canManageDevices}
          onClose={() => setSelectedIncidentId(null)}
          onUpdateStatus={(status) => updateIncidentStatus(selectedIncident, status)}
          onAssign={(assignee) => assignIncident(selectedIncident, assignee)}
          onAddNote={(content, date) => addIncidentNote(selectedIncident, content, date)}
        />
      )}
      {selectedEvent && (
        <MaintenanceDetailDialog
          event={selectedEvent}
          devices={devices}
          canManage={canManageDevices}
          onClose={() => setSelectedEventId(null)}
          onUpdate={(changes) => updateMaintenance(selectedEvent, changes)}
          onDelete={() => removeMaintenance(selectedEvent)}
        />
      )}

      {toast && (
        <div className={`toast-message ${toast.tone}`} role="status">
          {toast.tone === 'ok' ? <CheckCircle2 size={18} /> : <TriangleAlert size={18} />}
          <span>{toast.message}</span>
        </div>
      )}
    </>
  )
}
