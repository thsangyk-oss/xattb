import type { ReactNode } from 'react'
import {
  Activity,
  AirVent,
  ChevronRight,
  CircleGauge,
  Droplets,
  FileText,
  FlaskConical,
  HeartPulse,
  Microscope,
  Monitor,
  ScanLine,
  Stethoscope,
  Syringe,
  Waves,
  X,
} from 'lucide-react'
import { toneForStatus } from '../utils'

export function StatusBadge({ label, dot = true }: { label: string; dot?: boolean }) {
  return (
    <span className={`status-badge ${toneForStatus(label)}`}>
      {dot && <span className="status-dot" />}
      {label}
    </span>
  )
}

const deviceIcons = [
  { match: 'Hô hấp', icon: AirVent, tone: 'mint' },
  { match: 'Chẩn đoán', icon: ScanLine, tone: 'blue' },
  { match: 'Theo dõi', icon: Monitor, tone: 'coral' },
  { match: 'Tiêm truyền', icon: Syringe, tone: 'violet' },
  { match: 'Xét nghiệm', icon: FlaskConical, tone: 'amber' },
  { match: 'Nội soi', icon: Microscope, tone: 'blue' },
  { match: 'Tim mạch', icon: HeartPulse, tone: 'coral' },
  { match: 'Gây mê', icon: Stethoscope, tone: 'mint' },
  { match: 'nhiễm khuẩn', icon: Activity, tone: 'amber' },
  { match: 'Lọc máu', icon: Droplets, tone: 'blue' },
  { match: 'Phẫu thuật', icon: CircleGauge, tone: 'violet' },
]

export function DeviceVisual({ category, size = 'md' }: { category: string; size?: 'sm' | 'md' | 'lg' }) {
  const config = deviceIcons.find(({ match }) => category.includes(match)) ?? {
    icon: Waves,
    tone: 'mint',
  }
  const Icon = config.icon
  return (
    <span className={`device-visual ${config.tone} ${size}`} aria-hidden="true">
      <Icon />
    </span>
  )
}

export function Modal({
  title,
  eyebrow,
  children,
  onClose,
  width = 'medium',
  footer,
}: {
  title: string
  eyebrow?: string
  children: ReactNode
  onClose: () => void
  width?: 'small' | 'medium' | 'large' | 'drawer'
  footer?: ReactNode
}) {
  return (
    <div className="modal-layer" role="presentation" onMouseDown={onClose}>
      <section
        className={`modal-panel modal-${width}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id="modal-title">{title}</h2>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  )
}

export function PageHeading({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string
  title: string
  description?: string
  actions?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function SectionHeading({
  title,
  detail,
  action,
}: {
  title: string
  detail?: string
  action?: ReactNode
}) {
  return (
    <div className="section-heading">
      <div>
        <h2>{title}</h2>
        {detail && <p>{detail}</p>}
      </div>
      {action}
    </div>
  )
}

export function EmptyState({
  icon = <FileText size={24} />,
  title,
  detail,
  action,
}: {
  icon?: ReactNode
  title: string
  detail: string
  action?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <h3>{title}</h3>
      <p>{detail}</p>
      {action}
    </div>
  )
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  )
}

export function TextLink({ children, onClick }: { children: ReactNode; onClick?: () => void }) {
  return (
    <button className="text-link" type="button" onClick={onClick}>
      {children}
      <ChevronRight size={15} />
    </button>
  )
}
