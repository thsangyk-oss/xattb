import { useEffect, useState, type FormEvent } from 'react'
import { Camera, CheckCircle2, HeartPulse, ImagePlus, MapPin, ShieldCheck, Siren } from 'lucide-react'
import { getPublicDevice, type PublicDevice } from '../api'
import type { Incident, Priority } from '../types'
import { isoOffset } from '../utils'
import { DeviceVisual } from '../components/Shared'

export default function PublicReportView({
  deviceId,
  onCreate,
}: {
  deviceId: string
  onCreate: (incident: Incident, photo?: File) => void
}) {
  const [device, setDevice] = useState<PublicDevice | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitted, setSubmitted] = useState<Incident | null>(null)
  const [priority, setPriority] = useState<Priority>('Cao')
  const [photo, setPhoto] = useState<File | undefined>()

  useEffect(() => {
    let active = true
    void getPublicDevice(deviceId)
      .then((result) => { if (active) setDevice(result) })
      .catch(() => { if (active) setDevice(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [deviceId])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!device) return
    const data = new FormData(event.currentTarget)
    const stamp = Date.now()
    const incident: Incident = {
      id: `inc-qr-${stamp}`,
      code: `SC-${new Date().getFullYear()}-${String(stamp).slice(-4)}`,
      deviceId: device.id,
      title: String(data.get('title')),
      description: String(data.get('description')),
      priority,
      status: 'Mới tiếp nhận',
      reporter: String(data.get('reporter')),
      reporterDepartment: device.department,
      createdAt: new Date().toISOString(),
      assignee: 'Chưa phân công',
      nextActionDate: isoOffset(1),
      hasPhoto: Boolean(photo),
      notes: [],
    }
    onCreate(incident, photo)
    setSubmitted(incident)
  }

  if (loading) {
    return <main className="public-report-page"><div className="view-loading"><span /><strong>Đang tải thông tin thiết bị...</strong></div></main>
  }

  if (!device) {
    return (
      <main className="public-report-page">
        <div className="public-card invalid-qr">
          <Siren size={30} />
          <h1>Mã QR không hợp lệ</h1>
          <p>Không tìm thấy thiết bị tương ứng. Vui lòng liên hệ Phòng Trang thiết bị y tế.</p>
        </div>
      </main>
    )
  }

  if (submitted) {
    return (
      <main className="public-report-page">
        <div className="public-brand"><span><HeartPulse size={20} /></span><strong>Xuyên Á</strong></div>
        <section className="public-card public-success">
          <span className="success-check"><CheckCircle2 size={38} /></span>
          <h1>Đã gửi báo cáo</h1>
          <p>Phòng Trang thiết bị y tế đã nhận được yêu cầu và sẽ phản hồi sớm.</p>
          <div className="ticket-code"><span>Mã yêu cầu</span><strong>{submitted.code}</strong></div>
          <div className="response-note">
            <ShieldCheck size={18} />
            <span>Sự cố mức <b>{submitted.priority}</b> sẽ được ưu tiên theo quy trình của bệnh viện.</span>
          </div>
          <button className="button secondary full-button" type="button" onClick={() => { setSubmitted(null); setPhoto(undefined) }}>
            Gửi báo cáo khác
          </button>
        </section>
      </main>
    )
  }

  return (
    <main className="public-report-page">
      <div className="public-brand"><span><HeartPulse size={20} /></span><strong>Xuyên Á</strong><small>· Báo hỏng thiết bị</small></div>
      <section className="public-card">
        <div className="public-device">
          <DeviceVisual category={device.category} size="lg" />
          <div>
            <span>{device.code}</span>
            <h1>{device.name}</h1>
            <p><MapPin size={14} /> {device.department} · {device.room}</p>
          </div>
        </div>
        <form className="public-form" onSubmit={handleSubmit}>
          <div className="public-section">
            <h2>Thiết bị đang gặp vấn đề gì?</h2>
            <label>Mô tả ngắn <input name="title" required placeholder="Ví dụ: Máy không lên nguồn" /></label>
            <label>Chi tiết tình trạng <textarea name="description" required rows={4} placeholder="Mô tả biểu hiện, thời điểm xảy ra..." /></label>
          </div>
          <div className="public-section">
            <h2>Mức độ ảnh hưởng</h2>
            <div className="public-priority">
              {(['Khẩn cấp', 'Cao', 'Trung bình', 'Thấp'] as Priority[]).map((item) => (
                <button type="button" key={item} className={priority === item ? 'active' : ''} onClick={() => setPriority(item)}>
                  <span />{item}
                </button>
              ))}
            </div>
          </div>
          <div className="public-section">
            <h2>Ảnh tình trạng hư hỏng</h2>
            <label className="public-photo">
              <input type="file" accept="image/*" capture="environment" onChange={(event) => setPhoto(event.target.files?.[0])} />
              {photo
                ? <><Camera size={24} /><strong>{photo.name}</strong><span>Chạm để chọn lại ảnh</span></>
                : <><ImagePlus size={25} /><strong>Chụp hoặc chọn ảnh</strong><span>Ảnh rõ màn hình lỗi hoặc vị trí hư hỏng</span></>}
            </label>
          </div>
          <div className="public-section">
            <h2>Thông tin người báo</h2>
            <label>Họ và tên <input name="reporter" required placeholder="Nhập họ tên của bạn" /></label>
          </div>
          <button className="button primary public-submit" type="submit"><Siren size={18} /> Gửi báo cáo hư hỏng</button>
          <p className="public-privacy"><ShieldCheck size={14} /> Thông tin chỉ được sử dụng trong nội bộ bệnh viện.</p>
        </form>
      </section>
    </main>
  )
}
