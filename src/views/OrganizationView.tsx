import { useMemo, useState, type FormEvent } from 'react'
import {
  Building2,
  ChevronDown,
  Eye,
  FolderTree,
  KeyRound,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Share2,
  ShieldCheck,
  Stethoscope,
  Trash2,
  UserRoundCog,
  UsersRound,
  X,
} from 'lucide-react'
import type { AccessPermission, Branch, BranchId, Department, Device, UserAccount } from '../types'
import { roleLabel } from '../types'
import { PageHeading, StatusBadge } from '../components/Shared'

type Tab = 'structure' | 'permissions' | 'users'

export default function OrganizationView({
  devices,
  departments,
  permissions,
  users,
  branches,
  currentUser,
  activeBranchId,
  scopeName,
  onTogglePermission,
  onAddDepartment,
  onEditDepartment,
  onRemoveDepartment,
  onAddUser,
  onToggleUser,
  onResetPassword,
  onRemoveUser,
}: {
  devices: Device[]
  departments: Department[]
  permissions: AccessPermission[]
  users: UserAccount[]
  branches: Branch[]
  currentUser: UserAccount
  activeBranchId: BranchId | 'all'
  scopeName: string
  onTogglePermission: (permission: AccessPermission, key: 'view' | 'borrow' | 'approve') => void
  onAddDepartment: (department: Partial<Department>) => void
  onEditDepartment: (id: string, changes: Partial<Department>) => void
  onRemoveDepartment: (department: Department) => void
  onAddUser: () => void
  onToggleUser: (user: UserAccount) => void
  onResetPassword: (user: UserAccount) => void
  onRemoveUser: (user: UserAccount) => void
}) {
  const [tab, setTab] = useState<Tab>('users')
  const [permissionSearch, setPermissionSearch] = useState('')
  const [userSearch, setUserSearch] = useState('')
  const [userRoleFilter, setUserRoleFilter] = useState<'all' | UserAccount['role']>('all')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addingDepartment, setAddingDepartment] = useState(false)

  const isAdmin = currentUser.role === 'admin'
  const branchName = (branchId?: BranchId) => branches.find((branch) => branch.id === branchId)?.name ?? 'Toàn hệ thống'
  const branchShort = (branchId?: BranchId) => branches.find((branch) => branch.id === branchId)?.shortName ?? '—'
  const deviceCount = (department: Department) =>
    devices.filter((device) => device.branchId === department.branchId && device.department === department.name).length

  const targetBranchId: BranchId = activeBranchId === 'all'
    ? currentUser.branchId ?? branches[0]?.id ?? 'cu-chi'
    : activeBranchId

  const visiblePermissions = useMemo(
    () => permissions.filter((permission) =>
      permission.name.toLocaleLowerCase('vi').includes(permissionSearch.trim().toLocaleLowerCase('vi'))),
    [permissionSearch, permissions],
  )

  const visibleUsers = useMemo(() => users.filter((user) => {
    const matchesRole = userRoleFilter === 'all' || user.role === userRoleFilter
    const matchesBranch = activeBranchId === 'all' || user.role === 'admin' || user.branchId === activeBranchId
    const haystack = `${user.displayName} ${user.username} ${user.department ?? ''}`.toLocaleLowerCase('vi')
    return matchesRole && matchesBranch && haystack.includes(userSearch.trim().toLocaleLowerCase('vi'))
  }), [activeBranchId, userRoleFilter, userSearch, users])

  const roleCount = (role: UserAccount['role']) => users.filter((user) => user.role === role).length
  const sharedDevices = devices.filter((device) => device.shared).length

  const submitDepartment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onAddDepartment({
      name: String(form.get('name') || '').trim(),
      shortName: String(form.get('shortName') || '').trim(),
      head: String(form.get('head') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
      branchId: (String(form.get('branchId') || targetBranchId)) as BranchId,
    })
    setAddingDepartment(false)
  }

  const submitDepartmentEdit = (event: FormEvent<HTMLFormElement>, department: Department) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    onEditDepartment(department.id, {
      shortName: String(form.get('shortName') || '').trim(),
      head: String(form.get('head') || '').trim(),
      phone: String(form.get('phone') || '').trim(),
    })
    setEditingId(null)
  }

  return (
    <div className="page organization-page">
      <PageHeading
        eyebrow="Quản trị hệ thống"
        title="Đơn vị & phân quyền"
        description={`Cơ cấu khoa/phòng, quyền xem liên khoa và tài khoản của ${scopeName}.`}
        actions={
          tab === 'users'
            ? <button className="button primary" type="button" onClick={onAddUser}><Plus size={17} /> Tạo tài khoản</button>
            : tab === 'structure'
              ? <button className="button primary" type="button" onClick={() => setAddingDepartment(true)}><Plus size={17} /> Thêm khoa/phòng</button>
              : undefined
        }
      />

      <div className="organization-tabs segmented-tabs">
        <button className={tab === 'users' ? 'active' : ''} onClick={() => setTab('users')} type="button">
          <UsersRound size={16} /> Tài khoản <b>{users.length}</b>
        </button>
        <button className={tab === 'permissions' ? 'active' : ''} onClick={() => setTab('permissions')} type="button">
          <KeyRound size={16} /> Quyền xem & mượn
        </button>
        <button className={tab === 'structure' ? 'active' : ''} onClick={() => setTab('structure')} type="button">
          <FolderTree size={16} /> Cơ cấu tổ chức <b>{departments.length}</b>
        </button>
      </div>

      {/* ------------------------------------------------------- structure */}
      {tab === 'structure' && (
        <section className="structure-panel">
          <div className="structure-summary">
            <article><span className="summary-icon blue"><Building2 size={19} /></span><div><strong>{activeBranchId === 'all' ? branches.length : 1}</strong><span>Chi nhánh trong phạm vi</span></div></article>
            <article><span className="summary-icon green"><FolderTree size={19} /></span><div><strong>{departments.length}</strong><span>Khoa/phòng</span></div></article>
            <article><span className="summary-icon amber"><Share2 size={19} /></span><div><strong>{sharedDevices}</strong><span>Thiết bị dùng chung</span></div></article>
          </div>

          {addingDepartment && (
            <form className="inline-form" onSubmit={submitDepartment}>
              <h3>Thêm khoa/phòng mới</h3>
              <div className="form-grid">
                {isAdmin && (
                  <label className="span-2">Chi nhánh
                    <select name="branchId" defaultValue={targetBranchId}>
                      {branches.map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                  </label>
                )}
                <label className="span-2">Tên đầy đủ <input name="name" required placeholder="Ví dụ: Khoa Ung bướu" /></label>
                <label>Tên viết tắt <input name="shortName" placeholder="Ung bướu" /></label>
                <label>Trưởng khoa <input name="head" placeholder="BS. Nguyễn Văn A" /></label>
                <label className="span-2">Số điện thoại nội bộ <input name="phone" placeholder="Ví dụ: 1234" /></label>
              </div>
              <footer className="form-footer">
                <button className="button secondary" type="button" onClick={() => setAddingDepartment(false)}>Hủy</button>
                <button className="button primary" type="submit"><Plus size={16} /> Thêm</button>
              </footer>
            </form>
          )}

          {branches
            .filter((branch) => activeBranchId === 'all' || branch.id === activeBranchId)
            .map((branch) => {
              const branchDepartments = departments.filter((item) => item.branchId === branch.id)
              if (!branchDepartments.length) return null
              return (
                <div className="branch-group" key={branch.id}>
                  <header>
                    <span><Building2 size={17} /></span>
                    <div><strong>{branch.name}</strong><small>{branch.region} · {branchDepartments.length} khoa/phòng</small></div>
                    <b>{devices.filter((device) => device.branchId === branch.id).length} thiết bị</b>
                  </header>
                  <div className="department-grid">
                    {branchDepartments.map((department) => (
                      <article className="department-card" key={department.id}>
                        {editingId === department.id ? (
                          <form className="department-edit" onSubmit={(event) => submitDepartmentEdit(event, department)}>
                            <strong>{department.name}</strong>
                            <input name="shortName" defaultValue={department.shortName} placeholder="Tên viết tắt" />
                            <input name="head" defaultValue={department.head} placeholder="Trưởng khoa" />
                            <input name="phone" defaultValue={department.phone} placeholder="Điện thoại nội bộ" />
                            <div>
                              <button className="button secondary compact-button" type="button" onClick={() => setEditingId(null)}>Hủy</button>
                              <button className="button primary compact-button" type="submit">Lưu</button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="department-head">
                              <span className="department-mark">{department.shortName.slice(0, 3).toUpperCase()}</span>
                              <div>
                                <strong>{department.name}</strong>
                                <small>{department.head || 'Chưa gán trưởng khoa'}{department.phone ? ` · ${department.phone}` : ''}</small>
                              </div>
                            </div>
                            <div className="department-stats">
                              <span><b>{deviceCount(department)}</b> thiết bị</span>
                              <span><b>{users.filter((user) => user.role === 'department' && user.branchId === department.branchId && user.department === department.name).length}</b> tài khoản</span>
                            </div>
                            <footer>
                              <button type="button" onClick={() => setEditingId(department.id)}><Pencil size={14} /> Sửa</button>
                              <button className="danger" type="button" onClick={() => onRemoveDepartment(department)} disabled={deviceCount(department) > 0}>
                                <Trash2 size={14} /> Xóa
                              </button>
                            </footer>
                          </>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              )
            })}
        </section>
      )}

      {/* ----------------------------------------------------- permissions */}
      {tab === 'permissions' && (
        <div className="permissions-layout">
          <section className="permission-info-band">
            <span><ShieldCheck size={22} /></span>
            <div>
              <strong>Chia sẻ thiết bị liên khoa có kiểm soát</strong>
              <p>Khoa được cấp quyền “Xem” sẽ nhìn thấy các thiết bị của khoa khác đã bật <b>Cho phép mượn</b> trong hồ sơ thiết bị. Tắt quyền là khoa đó chỉ còn thấy thiết bị của mình.</p>
            </div>
            <div className="shared-count"><strong>{sharedDevices}</strong><span>thiết bị đang bật cho mượn</span></div>
          </section>

          <section className="permission-table-panel">
            <header>
              <div><strong>Ma trận quyền khoa/phòng</strong><span>Áp dụng cho mọi tài khoản thuộc khoa đó</span></div>
              <label className="list-search small-search">
                <Search size={15} />
                <input value={permissionSearch} onChange={(event) => setPermissionSearch(event.target.value)} placeholder="Tìm khoa/phòng..." />
              </label>
            </header>
            <div className="permission-table-wrap">
              <table className="data-table permission-table">
                <thead>
                  <tr>
                    <th>Khoa/phòng</th>
                    {activeBranchId === 'all' && <th>Chi nhánh</th>}
                    <th><span><Eye size={15} /> Xem thiết bị dùng chung</span></th>
                    <th>Gửi yêu cầu mượn</th>
                    <th>Duyệt cho mượn</th>
                  </tr>
                </thead>
                <tbody>
                  {visiblePermissions.map((item) => (
                    <tr key={item.id}>
                      <td><strong>{item.name}</strong></td>
                      {activeBranchId === 'all' && <td>{branchShort(item.branchId)}</td>}
                      {(['view', 'borrow', 'approve'] as const).map((key) => (
                        <td key={key}>
                          <button
                            className={`switch-control ${item[key] ? 'on' : ''}`}
                            type="button"
                            onClick={() => onTogglePermission(item, key)}
                            aria-label={`Đổi quyền ${key} cho ${item.name}`}
                          >
                            <span />
                          </button>
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!visiblePermissions.length && (
                    <tr><td className="permission-empty" colSpan={5}>Không tìm thấy khoa/phòng phù hợp.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ---------------------------------------------------------- users */}
      {tab === 'users' && (
        <section className="users-panel">
          <div className="user-role-summary">
            <article className={userRoleFilter === 'admin' ? 'active' : ''}>
              <button type="button" onClick={() => setUserRoleFilter(userRoleFilter === 'admin' ? 'all' : 'admin')}>
                <span className="summary-icon dark"><ShieldCheck size={18} /></span>
                <div><strong>{roleCount('admin')}</strong><span>Admin tổng</span></div>
              </button>
            </article>
            <article className={userRoleFilter === 'moderator' ? 'active' : ''}>
              <button type="button" onClick={() => setUserRoleFilter(userRoleFilter === 'moderator' ? 'all' : 'moderator')}>
                <span className="summary-icon blue"><UserRoundCog size={18} /></span>
                <div><strong>{roleCount('moderator')}</strong><span>Quản lý chi nhánh</span></div>
              </button>
            </article>
            <article className={userRoleFilter === 'department' ? 'active' : ''}>
              <button type="button" onClick={() => setUserRoleFilter(userRoleFilter === 'department' ? 'all' : 'department')}>
                <span className="summary-icon green"><Stethoscope size={18} /></span>
                <div><strong>{roleCount('department')}</strong><span>Tài khoản khoa</span></div>
              </button>
            </article>
          </div>

          <header className="users-toolbar">
            <label className="list-search">
              <Search size={16} />
              <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Tìm tên, tài khoản, khoa..." />
              {userSearch && <button type="button" onClick={() => setUserSearch('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}
            </label>
            <div className="select-wrap">
              <select value={userRoleFilter} onChange={(event) => setUserRoleFilter(event.target.value as typeof userRoleFilter)}>
                <option value="all">Tất cả vai trò</option>
                <option value="admin">Admin tổng</option>
                <option value="moderator">Quản lý chi nhánh</option>
                <option value="department">Tài khoản khoa</option>
              </select>
              <ChevronDown size={15} />
            </div>
            <button className="button primary compact-button" type="button" onClick={onAddUser}><Plus size={16} /> Tạo tài khoản</button>
          </header>

          <div className="user-account-list">
            {visibleUsers.map((user) => {
              const manageable = user.id !== currentUser.id
                && (isAdmin ? user.role !== 'admin' : user.role === 'department' && user.branchId === currentUser.branchId)
              return (
                <article className={`user-account-row ${!user.active ? 'inactive' : ''}`} key={user.id}>
                  <span className={`user-account-avatar ${user.role}`}>
                    {user.role === 'admin' ? <ShieldCheck size={18} /> : user.role === 'moderator' ? <UserRoundCog size={18} /> : <Stethoscope size={18} />}
                  </span>
                  <div className="user-account-main">
                    <strong>{user.displayName}</strong>
                    <small>@{user.username} · {roleLabel(user.role)}</small>
                  </div>
                  <div className="user-account-branch">
                    <strong>{user.role === 'department' ? user.department : branchName(user.branchId)}</strong>
                    <small>{user.role === 'department' ? branchName(user.branchId) : user.role === 'admin' ? 'Toàn hệ thống' : 'Phạm vi được gán'}</small>
                  </div>
                  <StatusBadge label={user.active ? 'Đang hoạt động' : 'Đã khóa'} />
                  {manageable ? (
                    <div className="user-account-actions">
                      <button className="user-reset-button" type="button" onClick={() => onResetPassword(user)} title="Đặt lại mật khẩu mặc định">
                        <RotateCcw size={14} /> Đặt lại MK
                      </button>
                      <button className="user-reset-button danger" type="button" onClick={() => onRemoveUser(user)} title="Xóa tài khoản">
                        <Trash2 size={14} />
                      </button>
                      <button
                        className={`switch-control ${user.active ? 'on' : ''}`}
                        type="button"
                        onClick={() => onToggleUser(user)}
                        aria-label={`${user.active ? 'Khóa' : 'Mở khóa'} ${user.username}`}
                        title={user.active ? 'Khóa tài khoản' : 'Mở tài khoản'}
                      >
                        <span />
                      </button>
                    </div>
                  ) : (
                    <span className="user-account-lock" title={user.id === currentUser.id ? 'Tài khoản đang đăng nhập' : 'Ngoài phạm vi quản lý'}>
                      <KeyRound size={15} />
                    </span>
                  )}
                </article>
              )
            })}
            {!visibleUsers.length && <div className="agenda-empty">Không tìm thấy tài khoản phù hợp.</div>}
          </div>
        </section>
      )}
    </div>
  )
}
