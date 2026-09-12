import { useMemo, useState } from 'react'
import {
  BarChart3,
  Check,
  ChevronDown,
  Download,
  FileChartColumn,
  FileClock,
  FileSpreadsheet,
  Plus,
  RotateCcw,
  Save,
  Search,
  SlidersHorizontal,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Device } from '../types'
import { createCsv, downloadText, formatCurrency, formatDate, normalizeText } from '../utils'
import { PageHeading } from '../components/Shared'

type ColumnKey =
  | 'code'
  | 'hisCode'
  | 'name'
  | 'category'
  | 'model'
  | 'serial'
  | 'manufacturer'
  | 'origin'
  | 'manufactureYear'
  | 'department'
  | 'room'
  | 'supplier'
  | 'contractDate'
  | 'handoverDate'
  | 'acceptanceDate'
  | 'usageDate'
  | 'warrantyStart'
  | 'warrantyEnd'
  | 'maintenanceCycle'
  | 'nextMaintenance'
  | 'status'
  | 'shared'
  | 'documents'
  | 'price'

const reportColumns: { key: ColumnKey; label: string; group: string }[] = [
  { key: 'code', label: 'Mã thiết bị', group: 'Nhận dạng' },
  { key: 'hisCode', label: 'Mã HIS', group: 'Nhận dạng' },
  { key: 'name', label: 'Tên thiết bị', group: 'Nhận dạng' },
  { key: 'category', label: 'Nhóm thiết bị', group: 'Nhận dạng' },
  { key: 'model', label: 'Model', group: 'Thông số' },
  { key: 'serial', label: 'Số seri', group: 'Thông số' },
  { key: 'manufacturer', label: 'Hãng sản xuất', group: 'Thông số' },
  { key: 'origin', label: 'Nước sản xuất', group: 'Thông số' },
  { key: 'manufactureYear', label: 'Năm sản xuất', group: 'Thông số' },
  { key: 'department', label: 'Khoa/phòng', group: 'Vị trí & sở hữu' },
  { key: 'room', label: 'Phòng sử dụng', group: 'Vị trí & sở hữu' },
  { key: 'supplier', label: 'Công ty cung cấp', group: 'Vị trí & sở hữu' },
  { key: 'contractDate', label: 'Ngày ký hợp đồng', group: 'Vòng đời' },
  { key: 'handoverDate', label: 'Ngày bàn giao', group: 'Vòng đời' },
  { key: 'acceptanceDate', label: 'Ngày nghiệm thu', group: 'Vòng đời' },
  { key: 'usageDate', label: 'Ngày đưa vào sử dụng', group: 'Vòng đời' },
  { key: 'warrantyStart', label: 'Bảo hành từ', group: 'Vòng đời' },
  { key: 'warrantyEnd', label: 'Bảo hành đến', group: 'Vòng đời' },
  { key: 'maintenanceCycle', label: 'Chu kỳ bảo trì (tháng)', group: 'Vòng đời' },
  { key: 'nextMaintenance', label: 'Bảo trì tiếp theo', group: 'Vòng đời' },
  { key: 'status', label: 'Tình trạng', group: 'Vòng đời' },
  { key: 'shared', label: 'Cho mượn liên khoa', group: 'Vị trí & sở hữu' },
  { key: 'documents', label: 'Số tài liệu đính kèm', group: 'Tài chính' },
  { key: 'price', label: 'Nguyên giá', group: 'Tài chính' },
]

const dateColumns: ColumnKey[] = ['contractDate', 'handoverDate', 'acceptanceDate', 'usageDate', 'warrantyStart', 'warrantyEnd', 'nextMaintenance']

const defaultColumns: ColumnKey[] = ['code', 'name', 'model', 'manufactureYear', 'department', 'supplier', 'status']

const getReportValue = (device: Device, key: ColumnKey): string | number => {
  if (dateColumns.includes(key)) return formatDate(String(device[key as keyof Device] ?? ''))
  if (key === 'price') return formatCurrency(device.price)
  if (key === 'shared') return device.shared ? 'Có' : 'Không'
  if (key === 'documents') return device.documents.length
  return device[key] as string | number
}

const presets = [
  { name: 'Thiết bị theo khoa', detail: 'Phân bổ và tình trạng', icon: FileChartColumn, columns: ['code', 'name', 'category', 'department', 'room', 'status'] as ColumnKey[] },
  { name: 'Theo model & năm SX', detail: 'Tổng hợp cấu hình máy', icon: BarChart3, columns: ['name', 'model', 'manufacturer', 'origin', 'manufactureYear', 'status'] as ColumnKey[] },
  { name: 'Máy hỏng, sửa chữa', detail: 'Thiết bị ngừng hoạt động', icon: FileClock, columns: ['code', 'name', 'model', 'department', 'supplier', 'status'] as ColumnKey[] },
  { name: 'Bảo hành & bảo trì', detail: 'Các mốc sắp đến hạn', icon: FileSpreadsheet, columns: ['code', 'name', 'department', 'warrantyEnd', 'nextMaintenance', 'supplier'] as ColumnKey[] },
  { name: 'Hồ sơ pháp lý', detail: 'Hợp đồng, nghiệm thu, chứng từ', icon: FileClock, columns: ['code', 'name', 'supplier', 'contractDate', 'handoverDate', 'acceptanceDate', 'documents'] as ColumnKey[] },
]

const requiredFields: Array<{ key: keyof Device; label: string }> = [
  { key: 'hisCode', label: 'Mã HIS' },
  { key: 'serial', label: 'Số seri' },
  { key: 'contractDate', label: 'Ngày hợp đồng' },
  { key: 'acceptanceDate', label: 'Ngày nghiệm thu' },
  { key: 'warrantyEnd', label: 'Hạn bảo hành' },
  { key: 'supplier', label: 'Nhà cung cấp' },
]

export default function ReportsView({
  devices,
  onToast,
  scopeName,
  canSeePrice,
}: {
  devices: Device[]
  onToast: (message: string) => void
  scopeName: string
  canSeePrice: boolean
}) {
  // Nguyên giá là trường riêng của admin tổng: bỏ hẳn khỏi bộ chọn cột, biểu đồ và tệp xuất.
  const availableColumns = useMemo(
    () => canSeePrice ? reportColumns : reportColumns.filter((column) => column.key !== 'price'),
    [canSeePrice],
  )
  const [selectedColumns, setSelectedColumns] = useState<ColumnKey[]>(defaultColumns)
  const [department, setDepartment] = useState('Tất cả khoa/phòng')
  const [year, setYear] = useState('Tất cả năm')
  const [status, setStatus] = useState('Tất cả tình trạng')
  const [supplier, setSupplier] = useState('Tất cả nhà cung cấp')
  const [search, setSearch] = useState('')
  const [groupBy, setGroupBy] = useState<'Khoa/phòng' | 'Năm sản xuất' | 'Hãng sản xuất'>('Khoa/phòng')

  const departments = ['Tất cả khoa/phòng', ...new Set(devices.map((device) => device.department))]
  const years = ['Tất cả năm', ...new Set(devices.map((device) => String(device.manufactureYear)).sort().reverse())]
  const suppliers = ['Tất cả nhà cung cấp', ...new Set(devices.map((device) => device.supplier))]

  const filtered = useMemo(() => devices.filter((device) => {
    const haystack = normalizeText(`${device.name} ${device.code} ${device.model} ${device.manufacturer}`)
    return (department === 'Tất cả khoa/phòng' || device.department === department)
      && (year === 'Tất cả năm' || String(device.manufactureYear) === year)
      && (status === 'Tất cả tình trạng' || device.status === status)
      && (supplier === 'Tất cả nhà cung cấp' || device.supplier === supplier)
      && (!search || haystack.includes(normalizeText(search)))
  }), [department, devices, search, status, supplier, year])

  const chartData = useMemo(() => {
    const aggregate = new Map<string, number>()
    filtered.forEach((device) => {
      const key = groupBy === 'Khoa/phòng'
        ? device.department.replace('Khoa ', '')
        : groupBy === 'Năm sản xuất'
          ? String(device.manufactureYear)
          : device.manufacturer
      aggregate.set(key, (aggregate.get(key) ?? 0) + 1)
    })
    return [...aggregate.entries()]
      .map(([name, value]) => ({ name: name.length > 18 ? `${name.slice(0, 16)}…` : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 7)
  }, [filtered, groupBy])

  const dataQuality = useMemo(() => {
    if (!filtered.length) return { rate: 0, gaps: [] as Array<{ label: string; count: number }> }
    const gaps = requiredFields
      .map((field) => ({
        label: field.label,
        count: filtered.filter((device) => {
          const value = device[field.key]
          return value === undefined || value === null || value === '' || value === 'Chưa đồng bộ'
        }).length,
      }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count)
    const missing = gaps.reduce((total, item) => total + item.count, 0)
    const rate = Math.round((1 - missing / (filtered.length * requiredFields.length)) * 1000) / 10
    return { rate, gaps }
  }, [filtered])

  const toggleColumn = (key: ColumnKey) => {
    setSelectedColumns((current) => current.includes(key)
      ? current.length === 1 ? current : current.filter((item) => item !== key)
      : [...current, key])
  }

  const exportReport = () => {
    const rows = filtered.map((device) => Object.fromEntries(selectedColumns.map((key) => {
      const column = reportColumns.find((item) => item.key === key)!
      return [column.label, getReportValue(device, key)]
    })))
    downloadText(createCsv(rows), `bao-cao-thiet-bi-${new Date().toISOString().slice(0, 10)}.csv`)
    onToast(`Đã xuất ${filtered.length} dòng dữ liệu`)
  }

  const resetFilters = () => {
    setDepartment('Tất cả khoa/phòng')
    setYear('Tất cả năm')
    setStatus('Tất cả tình trạng')
    setSupplier('Tất cả nhà cung cấp')
    setSearch('')
  }

  return (
    <div className="page reports-page">
      <PageHeading
        eyebrow="Phân tích dữ liệu"
        title="Báo cáo & thống kê"
        description={`Tạo báo cáo linh hoạt từ dữ liệu thiết bị và xuất tệp dùng ngay trong Excel cho ${scopeName}.`}
        actions={
          <>
            <button className="button secondary" type="button" onClick={() => setSelectedColumns(availableColumns.map((item) => item.key))}><Save size={17} /> Chọn mọi trường</button>
            <button className="button primary" type="button" onClick={exportReport}><Download size={17} /> Xuất CSV</button>
          </>
        }
      />

      <section className="report-presets">
        {presets.map(({ name, detail, icon: Icon, columns }) => (
          <button type="button" key={name} onClick={() => {
            setSelectedColumns(columns)
            if (name.includes('Máy hỏng')) setStatus('Đang sửa chữa')
            else setStatus('Tất cả tình trạng')
            onToast(`Đã áp dụng mẫu: ${name}`)
          }}>
            <span><Icon size={19} /></span>
            <div><strong>{name}</strong><small>{detail}</small></div>
            <Plus size={16} />
          </button>
        ))}
      </section>

      <div className="report-builder">
        <aside className="field-selector">
          <header><span><SlidersHorizontal size={17} /></span><div><strong>Trường báo cáo</strong><small>Đã chọn {selectedColumns.length}/{availableColumns.length} trường</small></div></header>
          <div className="column-actions">
            <button type="button" onClick={() => setSelectedColumns(availableColumns.map((item) => item.key))}>Chọn tất cả</button>
            <button type="button" onClick={() => setSelectedColumns(defaultColumns)}>Mặc định</button>
          </div>
          <div className="field-groups">
            {[...new Set(availableColumns.map((column) => column.group))].map((group) => (
              <div className="field-group" key={group}>
                <strong>{group}</strong>
                {availableColumns.filter((column) => column.group === group).map((column) => (
                  <label key={column.key}>
                    <input type="checkbox" checked={selectedColumns.includes(column.key)} onChange={() => toggleColumn(column.key)} />
                    <span className="custom-checkbox">{selectedColumns.includes(column.key) && <Check size={12} />}</span>
                    {column.label}
                  </label>
                ))}
              </div>
            ))}
          </div>
        </aside>

        <section className="report-main">
          <div className="report-filter-bar">
            <label className="list-search report-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tên, mã, model..." /></label>
            <div className="select-wrap"><select value={department} onChange={(event) => setDepartment(event.target.value)}>{departments.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
            <div className="select-wrap"><select value={year} onChange={(event) => setYear(event.target.value)}>{years.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
            <div className="select-wrap"><select value={status} onChange={(event) => setStatus(event.target.value)}><option>Tất cả tình trạng</option><option>Đang hoạt động</option><option>Đang sửa chữa</option><option>Chờ bảo trì</option><option>Ngừng sử dụng</option></select><ChevronDown size={14} /></div>
            <div className="select-wrap supplier-select"><select value={supplier} onChange={(event) => setSupplier(event.target.value)}>{suppliers.map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></div>
            <button className="icon-button border-button" type="button" onClick={resetFilters} aria-label="Đặt lại bộ lọc" title="Đặt lại"><RotateCcw size={16} /></button>
          </div>

          <div className="report-summary">
            <div><span>Kết quả lọc</span><strong>{filtered.length} <small>thiết bị mẫu</small></strong></div>
            <div><span>Đang hoạt động</span><strong>{filtered.filter((device) => device.status === 'Đang hoạt động').length}</strong></div>
            {canSeePrice
              ? <div><span>Tổng nguyên giá</span><strong>{(filtered.reduce((sum, device) => sum + (device.price ?? 0), 0) / 1_000_000_000).toFixed(1)} <small>tỷ đồng</small></strong></div>
              : <div><span>Có tài liệu đính kèm</span><strong>{filtered.filter((device) => device.documents.length > 0).length}</strong></div>}
            <div className="group-control"><span>Nhóm biểu đồ theo</span><div className="select-wrap"><select value={groupBy} onChange={(event) => setGroupBy(event.target.value as typeof groupBy)}><option>Khoa/phòng</option><option>Năm sản xuất</option><option>Hãng sản xuất</option></select><ChevronDown size={14} /></div></div>
          </div>

          <div className="report-chart-preview">
            <div className="report-chart">
              <header><strong>Phân bổ theo {groupBy.toLowerCase()}</strong><span>{filtered.length} thiết bị</span></header>
              <div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical" margin={{ top: 4, right: 22, left: 14, bottom: 4 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf0ee" />
                    <XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#7d8883' }} />
                    <YAxis type="category" dataKey="name" width={95} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#4d5b55' }} />
                    <Tooltip cursor={{ fill: '#f2f5f3' }} />
                    <Bar dataKey="value" name="Thiết bị" fill="#1c8c72" radius={[0, 3, 3, 0]} maxBarSize={18} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="report-health">
              <header><strong>Chất lượng hồ sơ</strong><span>{filtered.length} thiết bị đang lọc</span></header>
              <div className="health-score"><strong>{dataQuality.rate}%</strong><span>Trường bắt buộc đã nhập</span></div>
              <div className="health-bar"><i style={{ width: `${Math.max(dataQuality.rate, 0)}%` }} /></div>
              {dataQuality.gaps.length ? (
                <ul className="health-gaps">
                  {dataQuality.gaps.slice(0, 4).map((gap) => (
                    <li key={gap.label}><span>{gap.label}</span><b>{gap.count} hồ sơ thiếu</b></li>
                  ))}
                </ul>
              ) : <p>Tất cả hồ sơ trong kết quả lọc đã nhập đủ trường bắt buộc.</p>}
            </div>
          </div>

          <div className="report-table-panel">
            <header><div><strong>Xem trước dữ liệu</strong><span>{selectedColumns.length} cột · {filtered.length} dòng</span></div><button type="button" onClick={exportReport}><Download size={15} /> Tải CSV</button></header>
            <div className="report-table-scroll">
              <table className="data-table report-table">
                <thead><tr>{selectedColumns.map((key) => <th key={key}>{reportColumns.find((column) => column.key === key)?.label}</th>)}</tr></thead>
                <tbody>
                  {filtered.slice(0, 8).map((device) => (
                    <tr key={device.id}>{selectedColumns.map((key) => <td key={key}>{getReportValue(device, key)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </div>
            <footer>Đang xem tối đa 8 dòng. Tệp xuất sẽ bao gồm toàn bộ {filtered.length} dòng dữ liệu.</footer>
          </div>
        </section>
      </div>
    </div>
  )
}
