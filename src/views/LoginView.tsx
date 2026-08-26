import { useState, type FormEvent } from 'react'
import { ArrowRight, Building2, HeartPulse, KeyRound, LockKeyhole, ShieldCheck, Stethoscope, UserRound, UserRoundCog } from 'lucide-react'
import type { Branch } from '../types'
import { defaultUserPassword, departmentCatalog, slugify } from '../data'

export default function LoginView({
  branches,
  onLogin,
  error,
  loading,
}: {
  branches: Branch[]
  onLogin: (username: string, password: string) => Promise<void>
  error: string | null
  loading: boolean
}) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [helperBranch, setHelperBranch] = useState<Branch | null>(null)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await onLogin(username, password)
  }

  const fill = (account: string) => {
    setUsername(account)
    setPassword(defaultUserPassword)
  }

  return (
    <main className="login-page">
      <section className="login-shell">
        <div className="login-brand-panel">
          <div className="login-brand">
            <span><HeartPulse size={23} /></span>
            <div><strong>Xuyên Á</strong><small>Quản lý thiết bị y tế</small></div>
          </div>

          <div className="login-intro">
            <span className="eyebrow">Hệ thống nội bộ</span>
            <h1>Bệnh viện Đa khoa Xuyên Á</h1>
            <p>Quản lý tập trung hồ sơ thiết bị, bảo trì và yêu cầu sửa chữa trên toàn hệ thống chi nhánh.</p>
          </div>

          <div className="login-roles">
            <article><span><ShieldCheck size={17} /></span><div><strong>Admin tổng</strong><small>Toàn quyền trên cả {branches.length} chi nhánh</small></div></article>
            <article><span><UserRoundCog size={17} /></span><div><strong>Quản lý chi nhánh</strong><small>Toàn quyền trong chi nhánh được gán</small></div></article>
            <article><span><Stethoscope size={17} /></span><div><strong>Tài khoản khoa</strong><small>Xem thiết bị khoa mình và báo hỏng</small></div></article>
          </div>

          <div className="login-trust"><ShieldCheck size={16} /><span>Dữ liệu lưu trong mạng nội bộ Tailscale của bệnh viện</span></div>
        </div>

        <div className="login-form-panel">
          <div className="login-form-heading">
            <span className="mobile-login-mark"><HeartPulse size={18} /></span>
            <span className="eyebrow">Đăng nhập hệ thống</span>
            <h2>Chào mừng trở lại</h2>
            <p>Sử dụng tài khoản được cấp để tiếp tục.</p>
          </div>

          <form className="login-form" onSubmit={submit}>
            <label>
              <span>Tên đăng nhập</span>
              <div className="login-input">
                <UserRound size={17} />
                <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" placeholder="admin" required />
              </div>
            </label>
            <label>
              <span>Mật khẩu</span>
              <div className="login-input">
                <LockKeyhole size={17} />
                <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" placeholder="Nhập mật khẩu" required />
              </div>
            </label>
            {error && <div className="login-error"><KeyRound size={15} />{error}</div>}
            <button className="button primary login-submit" type="submit" disabled={loading}>
              {loading ? 'Đang xác thực...' : 'Đăng nhập'}{!loading && <ArrowRight size={17} />}
            </button>
          </form>

          <div className="login-accounts">
            <div className="login-accounts-heading">
              <strong>Tài khoản khởi tạo</strong>
              <span>Mật khẩu mặc định: <b>{defaultUserPassword}</b></span>
            </div>

            <button type="button" className="login-account-row admin" onClick={() => fill('admin')}>
              <span><ShieldCheck size={16} /></span>
              <div><strong>admin</strong><small>Admin tổng · toàn hệ thống</small></div>
              <ArrowRight size={15} />
            </button>

            <div className="login-account-grid">
              {branches.map((branch) => (
                <button type="button" className="login-account-row" key={branch.id} onClick={() => fill(`moderator-${branch.id}`)}>
                  <span><Building2 size={15} /></span>
                  <div><strong>moderator-{branch.id}</strong><small>{branch.shortName}</small></div>
                </button>
              ))}
            </div>

            <details className="login-department-help" open={Boolean(helperBranch)}>
              <summary>Tài khoản khoa · {departmentCatalog.length} khoa × {branches.length} chi nhánh</summary>
              <p>Chọn chi nhánh để xem tên đăng nhập của từng khoa.</p>
              <div className="login-branch-chips">
                {branches.map((branch) => (
                  <button
                    type="button"
                    key={branch.id}
                    className={helperBranch?.id === branch.id ? 'active' : ''}
                    onClick={() => setHelperBranch(helperBranch?.id === branch.id ? null : branch)}
                  >
                    {branch.shortName}
                  </button>
                ))}
              </div>
              {helperBranch && (
                <div className="login-department-list">
                  {departmentCatalog.map((item) => (
                    <button type="button" key={item.name} onClick={() => fill(`${slugify(item.shortName)}.${helperBranch.id}`)}>
                      <strong>{slugify(item.shortName)}.{helperBranch.id}</strong>
                      <small>{item.name}</small>
                    </button>
                  ))}
                </div>
              )}
            </details>
          </div>

          <p className="login-footer">Cần hỗ trợ tài khoản? Liên hệ Phòng TTBYT hoặc quản trị hệ thống.</p>
        </div>
      </section>
    </main>
  )
}
