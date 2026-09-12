import { useMemo, useState } from 'react'
import {
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  Eye,
  FolderTree,
  ListFilter,
  Plus,
  QrCode,
  Search,
  Share2,
  Siren,
  SlidersHorizontal,
  X,
} from 'lucide-react'
import type { Branch, Device, DeviceStatus, UserAccount } from '../types'
import { createCsv, daysFromToday, downloadText, dueLabel, formatDate, matchesDeviceSearch } from '../utils'
import { BranchChip, DeviceVisual, EmptyState, PageHeading, StatusBadge } from '../components/Shared'

const statuses: Array<'Tất cả' | DeviceStatus> = [
  'Tất cả',
  'Đang hoạt động',
  'Đang sửa chữa',
  'Chờ bảo trì',
  'Ngừng sử dụng',
]

type Ownership = 'all' | 'mine' | 'shared'

export default function DevicesView({
  devices,
  currentUser,
  globalSearch,
  onSearch,
  onAddDevice,
  onOpenDevice,
  onShowQr,
  onReport,
  scopeName,
  branches,
}: {
  devices: Device[]
  currentUser: UserAccount
  globalSearch: string
  onSearch: (value: string) => void
  onAddDevice?: () => void
  onOpenDevice: (device: Device) => void
  onShowQr: (device: Device) => void
  onReport: (device: Device) => void
  scopeName: string
  branches?: Branch[]
}) {
  const isDepartmentUser = currentUser.role === 'department'
  const [status, setStatus] = useState<(typeof statuses)[number]>('Tất cả')
  const [department, setDepartment] = useState('Tất cả khoa/phòng')
  const [category, setCategory] = useState('Tất cả nhóm thiết bị')
  const [branchFilter, setBranchFilter] = useState('Tất cả chi nhánh')
  const [ownership, setOwnership] = useState<Ownership>(isDepartmentUser ? 'mine' : 'all')
  const [selected, setSelected] = useState<string[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [showAllDepartments, setShowAllDepartments] = useState(false)

  const departments = ['Tất cả khoa/phòng', ...new Set(devices.map((device) => device.department))]
  const categories = ['Tất cả nhóm thiết bị', ...new Set(devices.map((device) => device.category))]

  const ownDepartmentCount = devices.filter((device) => device.department === currentUser.department).length
  const sharedCount = devices.filter((device) => device.department !== currentUser.department && device.shared).length

  const matchesOwnership = (device: Device) => {
    if (ownership === 'all') return true
    if (ownership === 'mine') return isDepartmentUser ? device.department === currentUser.department : true
    return device.shared && (!isDepartmentUser || device.department !== currentUser.department)
  }

  const filtered = useMemo(
    () => devices.filter((device) =>
      matchesDeviceSearch(device, globalSearch)
      && (status === 'Tất cả' || device.status === status)
      && (department === 'Tất cả khoa/phòng' || device.department === department)
      && (category === 'Tất cả nhóm thiết bị' || device.category === category)
      && (branchFilter === 'Tất cả chi nhánh' || device.branchId === branchFilter)
      && matchesOwnership(device)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [branchFilter, category, department, devices, globalSearch, ownership, status],
  )

  const visibleDepartments = showAllDepartments ? departments.slice(1) : departments.slice(1, 8)
  const hiddenDepartmentCount = Math.max(0, departments.length - 8)
  const hasActiveFilters = Boolean(globalSearch)
    || status !== 'Tất cả'
    || department !== 'Tất cả khoa/phòng'
    || category !== 'Tất cả nhóm thiết bị'
    || branchFilter !== 'Tất cả chi nhánh'
    || ownership !== (isDepartmentUser ? 'mine' : 'all')
  const allFilteredSelected = filtered.length > 0 && filtered.every((device) => selected.includes(device.id))

  const resetFilters = () => {
    onSearch('')
    setStatus('Tất cả')
    setDepartment('Tất cả khoa/phòng')
    setCategory('Tất cả nhóm thiết bị')
    setBranchFilter('Tất cả chi nhánh')
    setOwnership(isDepartmentUser ? 'mine' : 'all')
  }

  const toggleAll = () => {
    if (allFilteredSelected) setSelected((current) => current.filter((id) => !filtered.some((device) => device.id === id)))
    else setSelected((current) => [...new Set([...current, ...filtered.map((device) => device.id)])])
  }

  const toggleOne = (id: string) => {
    setSelected((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  const exportDevices = () => {
    const rows = (selected.length ? devices.filter((device) => selected.includes(device.id)) : filtered).map((device) => ({
      'Mã thiết bị': device.code,
      'Mã HIS': device.hisCode,
      'Tên thiết bị': device.name,
      Model: device.model,
      Seri: device.serial,
      'Hãng sản xuất': device.manufacturer,
      'Nước sản xuất': device.origin,
      'Năm sản xuất': device.manufactureYear,
      'Khoa/phòng': device.department,
      Phòng: device.room,
      'Ngày sử dụng': formatDate(device.usageDate),
      'Hạn bảo hành': formatDate(device.warrantyEnd),
      'Tình trạng': device.status,
      'Bảo trì tiếp theo': formatDate(device.nextMaintenance),
    }))
    downloadText(createCsv(rows), `danh-sach-thiet-bi-${new Date().toISOString().slice(0, 10)}.csv`)
  }

  return (
    <div className="page devices-page">
      <PageHeading
        eyebrow="Quản lý tài sản"
        title="Danh mục thiết bị"
        description={`${devices.length} hồ sơ thiết bị trong phạm vi ${scopeName}.`}
        actions={
          <>
            <button className="button secondary" type="button" onClick={exportDevices}>
              <Download size={17} /> Xuất dữ liệu
            </button>
            {onAddDevice && (
              <button className="button primary" type="button" onClick={onAddDevice}>
                <Plus size={17} /> Thêm thiết bị
              </button>
            )}
          </>
        }
      />

      {isDepartmentUser && (
        <div className="ownership-tabs segmented-tabs">
          <button className={ownership === 'mine' ? 'active' : ''} type="button" onClick={() => setOwnership('mine')}>
            Thiết bị khoa tôi <b>{ownDepartmentCount}</b>
          </button>
          <button className={ownership === 'shared' ? 'active' : ''} type="button" onClick={() => setOwnership('shared')}>
            <Share2 size={15} /> Dùng chung <b>{sharedCount}</b>
          </button>
          <button className={ownership === 'all' ? 'active' : ''} type="button" onClick={() => setOwnership('all')}>
            Tất cả <b>{devices.length}</b>
          </button>
        </div>
      )}

      <div className="device-layout">
        {filtersOpen && <button className="filter-panel-scrim" type="button" onClick={() => setFiltersOpen(false)} aria-label="Đóng bộ lọc" />}
        <aside className={`filter-sidebar ${filtersOpen ? 'mobile-open' : ''}`}>
          <div className="filter-mobile-head">
            <strong>Bộ lọc</strong>
            <button className="icon-button" onClick={() => setFiltersOpen(false)} aria-label="Đóng bộ lọc"><X size={18} /></button>
          </div>

          <div className="filter-block">
            <div className="filter-title"><FolderTree size={16} /><strong>Cơ cấu đơn vị</strong></div>
            <button className={`tree-item ${department === 'Tất cả khoa/phòng' ? 'active' : ''}`} type="button" onClick={() => setDepartment('Tất cả khoa/phòng')}>
              <Building2 size={16} /><span>{scopeName}</span><b>{devices.length}</b>
            </button>
            {visibleDepartments.map((item) => (
              <button
                className={`tree-item child ${department === item ? 'active' : ''}`}
                type="button"
                key={item}
                onClick={() => setDepartment(item)}
              >
                <ChevronRight size={14} /><span>{item.replace('Khoa ', '')}</span>
                <b>{devices.filter((device) => device.department === item).length}</b>
              </button>
            ))}
            {hiddenDepartmentCount > 0 && (
              <button className="tree-more" type="button" onClick={() => setShowAllDepartments((show) => !show)}>
                {showAllDepartments ? 'Thu gọn' : `Xem thêm ${hiddenDepartmentCount} đơn vị`}
                <ChevronDown className={showAllDepartments ? 'rotated' : ''} size={14} />
              </button>
            )}
          </div>

          {branches && (
            <div className="filter-block">
              <div className="filter-title"><Building2 size={16} /><strong>Chi nhánh</strong></div>
              <div className="check-filter-list">
                <button type="button" onClick={() => setBranchFilter('Tất cả chi nhánh')} className={branchFilter === 'Tất cả chi nhánh' ? 'selected' : ''}>
                  <span className="fake-check">{branchFilter === 'Tất cả chi nhánh' && <Check size={12} />}</span>
                  <span>Tất cả ({devices.length})</span>
                </button>
                {branches.map((branch) => {
                  const count = devices.filter((device) => device.branchId === branch.id).length
                  return (
                    <button key={branch.id} type="button" onClick={() => setBranchFilter(branch.id)} className={branchFilter === branch.id ? 'selected' : ''}>
                      <span className="fake-check">{branchFilter === branch.id && <Check size={12} />}</span>
                      <span>{branch.shortName}</span>
                      <b>{count}</b>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <div className="filter-block">
            <div className="filter-title"><ListFilter size={16} /><strong>Tình trạng</strong></div>
            <div className="check-filter-list">
              {statuses.map((item) => (
                <button type="button" key={item} onClick={() => setStatus(item)} className={status === item ? 'selected' : ''}>
                  <span className="fake-check">{status === item && <Check size={12} />}</span>
                  <span>{item}</span>
                  <b>{item === 'Tất cả' ? devices.length : devices.filter((device) => device.status === item).length}</b>
                </button>
              ))}
            </div>
          </div>

          {!isDepartmentUser && (
            <div className="filter-block compact-block">
              <div className="filter-title"><Share2 size={16} /><strong>Phạm vi chia sẻ</strong></div>
              <label className="toggle-filter">
                <input type="checkbox" checked={ownership === 'shared'} onChange={(event) => setOwnership(event.target.checked ? 'shared' : 'all')} />
                <span /> Chỉ thiết bị cho phép mượn
              </label>
            </div>
          )}
        </aside>

        <section className="device-list-panel">
          <div className="list-toolbar">
            <div className="segmented-tabs" role="tablist" aria-label="Lọc nhanh trạng thái">
              <button className={status === 'Tất cả' ? 'active' : ''} onClick={() => setStatus('Tất cả')} type="button">Tất cả <b>{devices.length}</b></button>
              <button className={status === 'Đang hoạt động' ? 'active' : ''} onClick={() => setStatus('Đang hoạt động')} type="button">Hoạt động <b>{devices.filter((device) => device.status === 'Đang hoạt động').length}</b></button>
              <button className={status === 'Đang sửa chữa' ? 'active' : ''} onClick={() => setStatus('Đang sửa chữa')} type="button">Có sự cố <b>{devices.filter((device) => device.status === 'Đang sửa chữa').length}</b></button>
              <button className={status === 'Chờ bảo trì' ? 'active' : ''} onClick={() => setStatus('Chờ bảo trì')} type="button">Sắp bảo trì <b>{devices.filter((device) => device.status === 'Chờ bảo trì').length}</b></button>
            </div>
            <button className="filter-mobile-button" type="button" onClick={() => setFiltersOpen(true)}><SlidersHorizontal size={16} /> Bộ lọc</button>
          </div>

          <div className="table-tools">
            <label className="list-search">
              <Search size={16} />
              <input value={globalSearch} onChange={(event) => onSearch(event.target.value)} placeholder="Tìm mã, tên, model, seri..." />
              {globalSearch && <button type="button" onClick={() => onSearch('')} aria-label="Xóa tìm kiếm"><X size={15} /></button>}
            </label>
            <div className="select-wrap">
              <select value={department} onChange={(event) => setDepartment(event.target.value)} aria-label="Lọc theo khoa phòng">
                {departments.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
            <div className="select-wrap category-filter">
              <select value={category} onChange={(event) => setCategory(event.target.value)} aria-label="Lọc theo nhóm thiết bị">
                {categories.map((item) => <option key={item}>{item}</option>)}
              </select>
              <ChevronDown size={15} />
            </div>
            {hasActiveFilters && <button className="filter-reset-button" type="button" onClick={resetFilters}><X size={15} /> Xóa lọc</button>}
          </div>

          {selected.length > 0 && (
            <div className="bulk-bar">
              <strong>Đã chọn {selected.length} thiết bị</strong>
              <button type="button" onClick={exportDevices}><Download size={15} /> Xuất dữ liệu</button>
              <button type="button" onClick={() => setSelected([])}>Bỏ chọn</button>
            </div>
          )}

          <div className="data-table-wrap">
            {filtered.length ? (
              <>
                <table className="data-table device-table">
                  <thead>
                    <tr>
                      <th className="check-col"><input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} aria-label="Chọn tất cả" /></th>
                      <th>Thiết bị</th>
                      <th>Mã HIS</th>
                      <th>Model / Seri</th>
                      <th>Vị trí sử dụng</th>
                      <th>Bảo trì tiếp theo</th>
                      <th>Tình trạng</th>
                      <th className="action-col" />
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((device) => {
                      const days = daysFromToday(device.nextMaintenance)
                      return (
                        <tr key={device.id} className={selected.includes(device.id) ? 'selected-row' : ''}>
                          <td className="check-col"><input type="checkbox" checked={selected.includes(device.id)} onChange={() => toggleOne(device.id)} aria-label={`Chọn ${device.name}`} /></td>
                          <td>
                            <button className="device-name-cell" type="button" onClick={() => onOpenDevice(device)}>
                              <DeviceVisual category={device.category} />
                              <span><strong>{device.name}</strong><small><b className="cell-code">{device.code}</b> · {device.category}</small></span>
                            </button>
                          </td>
                          <td>
                            <strong className="cell-primary cell-code">{device.hisCode}</strong>
                            <small className="cell-sub">{device.manufacturer}</small>
                          </td>
                          <td><strong className="cell-primary">{device.model}</strong><small className="cell-sub">S/N: {device.serial}</small></td>
                          <td>
                            <strong className="cell-primary">{device.department}{device.shared && <i className="shared-flag" title="Cho phép mượn liên khoa"><Share2 size={12} /></i>}</strong>
                            <small className="cell-sub">{device.room}{branches && <> · <BranchChip branchId={device.branchId} branches={branches} /></>}</small>
                          </td>
                          <td>
                            <strong className={`cell-primary ${days < 0 ? 'date-overdue' : days <= 7 ? 'date-soon' : ''}`}>{formatDate(device.nextMaintenance)}</strong>
                            <small className="cell-sub">{dueLabel(device.nextMaintenance)}</small>
                          </td>
                          <td><StatusBadge label={device.status} /></td>
                          <td className="action-col">
                            <div className="row-actions">
                              <button type="button" onClick={() => onReport(device)} aria-label={`Báo hỏng ${device.name}`} title="Báo hỏng"><Siren size={17} /></button>
                              <button type="button" onClick={() => onShowQr(device)} aria-label={`Mã QR ${device.name}`} title="Mã QR"><QrCode size={17} /></button>
                              <button type="button" onClick={() => onOpenDevice(device)} aria-label={`Xem chi tiết ${device.name}`} title="Xem chi tiết"><Eye size={17} /></button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>

                <div className="device-card-list">
                  {filtered.map((device) => (
                    <article className="device-card" key={device.id}>
                      <button className="device-card-main" type="button" onClick={() => onOpenDevice(device)}>
                        <DeviceVisual category={device.category} />
                        <div>
                          <strong>{device.name}</strong>
                          <small>{device.code} · {device.model}</small>
                          <small>{device.department} · {device.room}</small>
                          {branches && <BranchChip branchId={device.branchId} branches={branches} />}
                        </div>
                        <StatusBadge label={device.status} />
                      </button>
                      <footer>
                        <span className={daysFromToday(device.nextMaintenance) < 0 ? 'date-overdue' : ''}>
                          Bảo trì: {dueLabel(device.nextMaintenance)}
                        </span>
                        <div>
                          <button type="button" onClick={() => onReport(device)} aria-label="Báo hỏng"><Siren size={16} /></button>
                          <button type="button" onClick={() => onShowQr(device)} aria-label="Mã QR"><QrCode size={16} /></button>
                        </div>
                      </footer>
                    </article>
                  ))}
                </div>
              </>
            ) : (
              <EmptyState
                title="Không tìm thấy thiết bị"
                detail="Thử bỏ bớt bộ lọc hoặc tìm bằng mã thiết bị, model hay số seri."
                action={<button className="button secondary" type="button" onClick={resetFilters}>Xóa bộ lọc</button>}
              />
            )}
          </div>

          <footer className="table-footer">
            <span>Đang hiển thị <strong>{filtered.length}</strong> / <strong>{devices.length}</strong> hồ sơ</span>
            {hasActiveFilters && <button className="table-footer-reset" type="button" onClick={resetFilters}>Hiển thị tất cả</button>}
          </footer>
        </section>
      </div>
    </div>
  )
}
