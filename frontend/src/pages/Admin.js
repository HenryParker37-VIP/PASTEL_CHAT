import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLang } from '../i18n';
import { useConfirm, useToast } from '../components/Toast';
import PastelIcon from '../components/PastelIcon';

const initialForm = { version: '', title: '', summary: '', features: '', fixes: '', improvements: '', important: false, pushEnabled: false };
const initialAnnouncement = { title: '', body: '', scope: 'test', pushEnabled: false };
const list = (value) => String(value || '').split(/\n|,/).map((item) => item.trim()).filter(Boolean);
const formatDate = (value) => value ? new Date(value).toLocaleString() : '—';

const Admin = () => {
  const { logout, user } = useAuth();
  const { lang } = useLang();
  const { confirm } = useConfirm();
  const { push } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [presenceFilter, setPresenceFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sort, setSort] = useState('lastActive');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState(null);
  const [release, setRelease] = useState(initialForm);
  const [releasePreview, setReleasePreview] = useState(null);
  const [announcement, setAnnouncement] = useState(initialAnnouncement);

  const isVi = lang === 'vi';
  const l = (en, vi) => isVi ? vi : en;
  const reload = useCallback(async () => {
    if (!user || user.isAdmin !== true) return;
    setLoading(true); setError('');
    try {
      const response = await api.get('/admin/dashboard', { params: { q: query, presence: presenceFilter, status: statusFilter, sort, page, pageSize: 25 } });
      setData(response.data);
    } catch (err) {
      setError(err.response?.data?.message || l('Unable to load Admin Hub', 'Không thể tải Trung tâm quản trị'));
    } finally { setLoading(false); }
  }, [page, presenceFilter, query, sort, statusFilter, user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && user.isAdmin !== true) { navigate('/home'); return undefined; }
    const timer = window.setTimeout(reload, query ? 260 : 0);
    return () => window.clearTimeout(timer);
  }, [navigate, query, reload, user]);

  const act = async (request, success) => {
    try { await request(); push({ title: success, tone: 'success', icon: 'check' }); await reload(); }
    catch (err) { push({ title: err.response?.data?.message || l('Action failed', 'Thao tác thất bại'), tone: 'danger', icon: 'alert' }); }
  };
  const userAction = async (kind, target) => {
    const isSuspend = kind === 'suspend';
    const accepted = await confirm({ title: isSuspend ? l('Suspend account?', 'Tạm khóa tài khoản?') : l('Force logout?', 'Đăng xuất bắt buộc?'), message: isSuspend ? l('This revokes active sessions and blocks sign-in until an admin unsuspends the account.', 'Thao tác này thu hồi phiên hiện tại và chặn đăng nhập cho đến khi quản trị viên mở khóa.') : l('All active sessions for this account will be revoked.', 'Tất cả phiên đang hoạt động của tài khoản sẽ bị thu hồi.'), tone: isSuspend ? 'danger' : 'default', confirmLabel: l('Continue', 'Tiếp tục') });
    if (!accepted) return;
    await act(() => api.post(`/admin/users/${target._id}/${isSuspend ? 'suspend' : 'force-logout'}`, {}), isSuspend ? l('Account suspended', 'Đã tạm khóa tài khoản') : l('Sessions revoked', 'Đã thu hồi phiên đăng nhập'));
    setSelectedUser(null);
  };
  const updateTicket = async (ticket, status) => {
    const isReport = ticket.kind === 'report';
    const accepted = await confirm({ title: l('Update workflow status?', 'Cập nhật trạng thái xử lý?'), message: l('This administrative action is recorded in the audit log.', 'Thao tác quản trị này sẽ được ghi vào nhật ký kiểm toán.'), confirmLabel: l('Update', 'Cập nhật') });
    if (accepted) await act(() => api.patch(`/admin/${isReport ? 'reports' : 'tickets'}/${ticket._id}`, { status }), l('Ticket updated', 'Đã cập nhật yêu cầu'));
  };
  const publishRelease = async () => {
    if (!releasePreview) return;
    const accepted = await confirm({ title: l('Publish this release?', 'Xuất bản bản phát hành này?'), message: l('This saves the release and creates one deduplicated in-app notification per user. Push is sent only when explicitly enabled for an important release.', 'Bản phát hành sẽ được lưu và tạo một thông báo trong ứng dụng cho mỗi người dùng. Push chỉ gửi khi được bật rõ ràng cho bản phát hành quan trọng.'), confirmLabel: l('Publish release', 'Xuất bản'), icon: 'sparkles' });
    if (!accepted) return;
    await act(() => api.post('/admin/releases', { ...releasePreview, confirmed: true }), l('Release published', 'Đã xuất bản bản phát hành'));
    setRelease(initialForm); setReleasePreview(null);
  };
  const createAnnouncement = async () => {
    if (!announcement.title.trim() || !announcement.body.trim()) return push({ title: l('Add a title and message first', 'Hãy thêm tiêu đề và nội dung'), tone: 'danger', icon: 'alert' });
    const needsConfirm = announcement.scope === 'all' || announcement.pushEnabled;
    if (needsConfirm && !(await confirm({ title: l('Send this announcement?', 'Gửi thông báo này?'), message: l('Review the recipient scope carefully. This action is recorded and cannot be recalled.', 'Hãy kiểm tra kỹ phạm vi người nhận. Thao tác này được ghi lại và không thể thu hồi.'), tone: 'danger', confirmLabel: l('Send announcement', 'Gửi thông báo') }))) return;
    await act(() => api.post('/admin/announcements', { ...announcement, confirmed: needsConfirm }), l('Announcement delivered', 'Đã gửi thông báo'));
    setAnnouncement(initialAnnouncement);
  };
  const metrics = data?.metrics || {};
  const tickets = useMemo(() => data?.tickets || [], [data]);
  const ticketGroups = useMemo(() => ({ bug: tickets.filter((item) => item.kind === 'bug'), feature: tickets.filter((item) => item.kind === 'feature'), feedback: tickets.filter((item) => item.kind === 'feedback'), report: tickets.filter((item) => item.kind === 'report') }), [tickets]);
  const chartMax = Math.max(1, ...(data?.analytics || []).map((item) => Math.max(item.registrations, item.activeUsers, item.messages, item.tickets)));

  if (!user || user.isAdmin !== true) return null;
  if (loading && !data) return <div className="center"><p>{l('Loading Admin Hub…', 'Đang tải Trung tâm quản trị…')}</p></div>;
  if (error && !data) return <div className="center"><div className="card admin-error"><PastelIcon name="shield-heart" size={42} /><h2>{l('Admin access unavailable', 'Không thể truy cập quản trị')}</h2><p>{error}</p><button className="btn btn-blue" onClick={() => navigate('/home')}>{l('Return home', 'Về trang chủ')}</button></div></div>;

  return (
    <main className="page-frame admin-hub">
      <div className="container admin-hub__container">
        <header className="admin-hub__header">
          <div><span className="admin-eyebrow"><PastelIcon name="shield-heart" size={15} /> {l('Operations', 'Vận hành')}</span><h1>{l('Admin Hub', 'Trung tâm quản trị')}</h1><p>{l('Monitor PastelChat health and users', 'Theo dõi sức khỏe PastelChat và người dùng')}</p></div>
          <button className="btn btn-ghost" onClick={logout}>{l('Log out admin', 'Đăng xuất quản trị')}</button>
        </header>

        <section className="admin-metrics" aria-label={l('Overview metrics', 'Chỉ số tổng quan')}>
          {[[ 'users', l('Total users', 'Tổng người dùng'), metrics.totalUsers ], ['online', l('Online now', 'Đang online'), metrics.onlineNow], ['users', l('Active today', 'Hoạt động hôm nay'), metrics.activeToday], ['sparkles', l('New today', 'Mới hôm nay'), metrics.newUsersToday], ['chat-friends', l('Messages today', 'Tin nhắn hôm nay'), metrics.messagesToday], ['alert', l('Open tickets', 'Yêu cầu mở'), metrics.openTickets], ['globe', l('Version', 'Phiên bản'), data?.version || '—'], ['lock', l('Build ID', 'Mã build'), data?.buildId || '—']].map(([icon, label, value]) => <div className="admin-metric" key={label}><PastelIcon name={icon} size={19} /><span>{label}</span><strong title={String(value)}>{value}</strong></div>)}
        </section>

        <section className="admin-panel admin-health"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="pulse" size={15} /> {l('Live checks', 'Kiểm tra trực tiếp')}</span><h2>{l('System health', 'Sức khỏe hệ thống')}</h2></div><button className="btn btn-ghost btn-small" onClick={reload}>{l('Refresh', 'Làm mới')}</button></div><div className="admin-health__grid">{Object.entries(data?.health || {}).map(([key, item]) => <div className="admin-health__item" key={key}><span className={`status-dot status-dot--${String(item.status).toLowerCase()}`} /><div><strong>{key === 'mongodb' ? 'MongoDB' : key === 'pwa' ? 'PWA / service worker' : key === 'releaseSystem' ? l('Release system', 'Hệ thống phát hành') : key === 'push' ? l('Push notifications', 'Thông báo push') : key.toUpperCase()}</strong><small>{item.status} · {item.detail}</small></div></div>)}</div></section>

        <section className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="users" size={15} /> {l('Account operations', 'Vận hành tài khoản')}</span><h2>{l('Users', 'Người dùng')} <small>({data?.pagination?.total || 0})</small></h2></div></div><div className="admin-toolbar"><label className="admin-search"><PastelIcon name="search" size={17} /><input value={query} onChange={(event) => { setPage(1); setQuery(event.target.value); }} placeholder={l('Search name, username, or login code', 'Tìm tên, username hoặc mã đăng nhập')} aria-label={l('Search users', 'Tìm người dùng')} /></label><select value={presenceFilter} onChange={(event) => { setPage(1); setPresenceFilter(event.target.value); }} aria-label={l('Presence filter', 'Lọc trạng thái')}><option value="">{l('All presence', 'Mọi trạng thái')}</option><option value="online">Online</option><option value="idle">Idle</option><option value="offline">Offline</option></select><select value={statusFilter} onChange={(event) => { setPage(1); setStatusFilter(event.target.value); }} aria-label={l('Account filter', 'Lọc tài khoản')}><option value="">{l('All accounts', 'Mọi tài khoản')}</option><option value="suspended">{l('Suspended', 'Đã khóa')}</option><option value="new">{l('New (7 days)', 'Mới (7 ngày)')}</option></select><select value={sort} onChange={(event) => setSort(event.target.value)} aria-label={l('Sort users', 'Sắp xếp người dùng')}><option value="lastActive">{l('Last active', 'Hoạt động gần nhất')}</option><option value="joined">{l('Joined date', 'Ngày tham gia')}</option><option value="name">{l('Name', 'Tên')}</option></select></div><div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>{l('User', 'Người dùng')}</th><th>{l('Presence', 'Trạng thái')}</th><th>{l('Joined', 'Tham gia')}</th><th>{l('Last seen', 'Truy cập cuối')}</th><th>{l('Status', 'Tình trạng')}</th><th><span className="sr-only">{l('Actions', 'Thao tác')}</span></th></tr></thead><tbody>{(data?.users || []).map((item) => <tr key={item._id}><td><button className="admin-user-button" onClick={() => api.get(`/admin/users/${item._id}`).then((response) => setSelectedUser(response.data.user)).catch(() => push({ title: l('Could not load user', 'Không thể tải người dùng'), tone: 'danger', icon: 'alert' }))}><img src={item.avatar} alt="" /><span><strong>{item.name}</strong><small>{item._id.slice(0, 12)}{item.isAdmin ? ` · ${l('Admin', 'Quản trị')}` : ''}</small></span></button></td><td><span className={`presence-pill presence-pill--${item.presence.toLowerCase()}`}><span />{item.presence}</span></td><td>{formatDate(item.createdAt)}</td><td>{item.lastSeenLabel}</td><td>{item.isSuspended ? <span className="tag tag--danger">{l('Suspended', 'Đã khóa')}</span> : <span className="tag tag--ok">{l('Active', 'Đang hoạt động')}</span>}</td><td><button className="btn btn-ghost btn-small" onClick={() => setSelectedUser(item)}>{l('View', 'Xem')}</button></td></tr>)}</tbody></table></div><div className="admin-pagination"><span>{l('Page', 'Trang')} {data?.pagination?.page || 1} / {data?.pagination?.pages || 1}</span><div><button className="btn btn-ghost btn-small" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>{l('Previous', 'Trước')}</button><button className="btn btn-ghost btn-small" disabled={page >= (data?.pagination?.pages || 1)} onClick={() => setPage((value) => value + 1)}>{l('Next', 'Sau')}</button></div></div></section>

        <section className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="bell" size={15} /> {l('Triage', 'Phân loại')}</span><h2>{l('User requests & tickets', 'Yêu cầu & phiếu hỗ trợ')}</h2></div></div><div className="admin-ticket-grid">{[['bug', 'alert', l('Bugs', 'Lỗi'), '#e57373', l('No bugs reported.', 'Chưa có lỗi nào.')], ['feature', 'sparkles', l('Features', 'Tính năng'), 'var(--mint)', l('No feature requests.', 'Chưa có yêu cầu tính năng.')], ['feedback', 'chat-friends', l('Feedback', 'Phản hồi'), 'var(--blue)', l('No feedback messages.', 'Chưa có phản hồi.')], ['report', 'shield-heart', l('Reports', 'Báo cáo'), 'var(--lavender)', l('No user reports.', 'Chưa có báo cáo nào.')]].map(([kind, icon, title, color, empty]) => <article className="admin-ticket" key={kind} style={{ '--ticket-accent': color }}><div className="admin-ticket__title"><h3><PastelIcon name={icon} size={18} />{title}</h3><span>{ticketGroups[kind].length}</span></div>{!ticketGroups[kind].length ? <p className="admin-empty">{empty}</p> : <div className="admin-ticket__items">{ticketGroups[kind].slice(0, 4).map((ticket) => <div className="admin-ticket__item" key={ticket._id}><p>{ticket.message}</p><small>{ticket.reporter?.name || `ID ${ticket.userId || ticket.reporterId}`} · {formatDate(ticket.createdAt)}</small><div className="admin-ticket__actions"><span className="tag">{ticket.status || 'Open'}</span><select value={ticket.status || 'Open'} onChange={(event) => updateTicket(ticket, event.target.value)} aria-label={l('Update ticket status', 'Cập nhật trạng thái')}><option>Open</option><option>Reviewing</option>{kind !== 'report' && <option>In Progress</option>}<option>Resolved</option>{kind !== 'report' && <option>Closed</option>}{kind === 'report' && <option>Dismissed</option>}</select></div></div>)}</div>}</article>)}</div></section>

        <section className="admin-columns"><div className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="sparkles" size={15} /> {l('Protected publishing', 'Xuất bản bảo vệ')}</span><h2>{l('Release Center', 'Trung tâm phát hành')}</h2></div></div><div className="admin-form-grid"><label>{l('Version', 'Phiên bản')}<input value={release.version} onChange={(e) => setRelease({ ...release, version: e.target.value })} placeholder="1.2.0" /></label><label>{l('Title', 'Tiêu đề')}<input value={release.title} onChange={(e) => setRelease({ ...release, title: e.target.value })} /></label><label className="admin-form-grid__wide">{l('Summary', 'Tóm tắt')}<textarea value={release.summary} onChange={(e) => setRelease({ ...release, summary: e.target.value })} rows="2" /></label><label>{l('Features', 'Tính năng')}<textarea value={release.features} onChange={(e) => setRelease({ ...release, features: e.target.value })} placeholder={l('One item per line', 'Mỗi dòng một mục')} rows="3" /></label><label>{l('Fixes', 'Sửa lỗi')}<textarea value={release.fixes} onChange={(e) => setRelease({ ...release, fixes: e.target.value })} rows="3" /></label><label>{l('Improvements', 'Cải thiện')}<textarea value={release.improvements} onChange={(e) => setRelease({ ...release, improvements: e.target.value })} rows="3" /></label></div><div className="admin-checks"><label><input type="checkbox" checked={release.important} onChange={(e) => setRelease({ ...release, important: e.target.checked })} /> {l('Important release', 'Bản phát hành quan trọng')}</label><label><input type="checkbox" checked={release.pushEnabled} onChange={(e) => setRelease({ ...release, pushEnabled: e.target.checked })} /> {l('Enable push (important only)', 'Bật push (chỉ bản quan trọng)')}</label></div><div className="admin-actions"><button className="btn btn-ghost" onClick={() => setReleasePreview({ ...release, features: list(release.features), fixes: list(release.fixes), improvements: list(release.improvements) })}>{l('Preview', 'Xem trước')}</button><button className="btn btn-blue" disabled={!releasePreview} onClick={publishRelease}>{l('Publish', 'Xuất bản')}</button></div>{releasePreview && <div className="admin-preview"><span className="tag">v{releasePreview.version}</span><h3>{releasePreview.title}</h3><p>{releasePreview.summary || l('No summary provided.', 'Chưa có tóm tắt.')}</p><small>{l('Preview only — publish requires confirmation.', 'Chỉ xem trước — xuất bản cần xác nhận.')}</small></div>}</div>
          <div className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="bell" size={15} /> {l('Controlled delivery', 'Gửi có kiểm soát')}</span><h2>{l('Announcement Center', 'Trung tâm thông báo')}</h2></div></div><div className="admin-form-grid admin-form-grid--single"><label>{l('Title', 'Tiêu đề')}<input value={announcement.title} onChange={(e) => setAnnouncement({ ...announcement, title: e.target.value })} /></label><label>{l('Message', 'Nội dung')}<textarea value={announcement.body} onChange={(e) => setAnnouncement({ ...announcement, body: e.target.value })} rows="5" /></label><label>{l('Recipient scope', 'Phạm vi người nhận')}<select value={announcement.scope} onChange={(e) => setAnnouncement({ ...announcement, scope: e.target.value })}><option value="test">{l('Test accounts only', 'Chỉ tài khoản kiểm thử')}</option><option value="selected">{l('Selected users (API)', 'Người dùng chọn (API)')}</option><option value="all">{l('All eligible users', 'Tất cả người dùng đủ điều kiện')}</option></select></label><label className="admin-check"><input type="checkbox" checked={announcement.pushEnabled} onChange={(e) => setAnnouncement({ ...announcement, pushEnabled: e.target.checked })} /> {l('Also send push', 'Gửi thêm push')}</label></div><div className="admin-actions"><button className="btn btn-blue" onClick={createAnnouncement}>{l('Review & deliver', 'Kiểm tra & gửi')}</button></div><p className="admin-help">{l('Test scope is the safe default. Mass or push delivery always requires a second confirmation.', 'Phạm vi kiểm thử là mặc định an toàn. Gửi hàng loạt hoặc push luôn cần xác nhận lần hai.')}</p></div></section>

        <section className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="pulse" size={15} /> {l('Seven-day view', 'Tổng quan 7 ngày')}</span><h2>{l('Analytics', 'Phân tích')}</h2></div></div><div className="admin-analytics">{(data?.analytics || []).map((item) => <div className="admin-analytics__day" key={item.date}><div className="admin-analytics__bars"><span style={{ height: `${Math.max(4, item.registrations / chartMax * 100)}%` }} title={`${item.registrations} registrations`} /><span style={{ height: `${Math.max(4, item.activeUsers / chartMax * 100)}%` }} title={`${item.activeUsers} active users`} /><span style={{ height: `${Math.max(4, item.messages / chartMax * 100)}%` }} title={`${item.messages} messages`} /></div><small>{item.date.slice(5)}</small></div>)}</div><div className="admin-legend"><span><i />{l('Registrations', 'Đăng ký')}</span><span><i />{l('Active users', 'Người dùng hoạt động')}</span><span><i />{l('Messages', 'Tin nhắn')}</span></div></section>

        <section className="admin-panel"><div className="admin-panel__heading"><div><span className="admin-eyebrow"><PastelIcon name="lock" size={15} /> {l('Traceability', 'Truy vết')}</span><h2>{l('Audit log', 'Nhật ký kiểm toán')}</h2></div></div><div className="admin-audit-list">{(data?.auditLogs || []).slice(0, 20).map((item) => <div key={item._id}><span className="tag">{item.action}</span><p>{item.targetType} {item.targetId ? `· ${String(item.targetId).slice(0, 12)}` : ''}</p><small>{formatDate(item.createdAt)}</small></div>)}{!(data?.auditLogs || []).length && <p className="admin-empty">{l('No administrative events yet.', 'Chưa có sự kiện quản trị.')}</p>}</div></section>
      </div>
      {selectedUser && <div className="admin-modal-backdrop" role="presentation" onMouseDown={() => setSelectedUser(null)}><section className="admin-user-modal" role="dialog" aria-modal="true" aria-labelledby="admin-user-title" onMouseDown={(event) => event.stopPropagation()}><button className="admin-modal-close" onClick={() => setSelectedUser(null)} aria-label={l('Close', 'Đóng')}><PastelIcon name="close" size={18} /></button><img className="admin-user-modal__avatar" src={selectedUser.avatar} alt="" /><h2 id="admin-user-title">{selectedUser.name}</h2><span className="presence-pill">{selectedUser.presence}</span><dl><dt>{l('Account ID', 'Mã tài khoản')}</dt><dd>{selectedUser._id}</dd><dt>{l('Joined', 'Tham gia')}</dt><dd>{formatDate(selectedUser.createdAt)}</dd><dt>{l('Last active', 'Hoạt động gần nhất')}</dt><dd>{selectedUser.lastSeenLabel} · {formatDate(selectedUser.lastSeen)}</dd><dt>{l('Friends', 'Bạn bè')}</dt><dd>{selectedUser.friendCount}</dd><dt>{l('Sign-in method', 'Phương thức đăng nhập')}</dt><dd>{selectedUser.loginMethod}</dd><dt>{l('Active sessions', 'Phiên đang hoạt động')}</dt><dd>{selectedUser.security?.activeSessions ?? 0}</dd></dl><p className="admin-privacy-note"><PastelIcon name="lock" size={15} /> {l('Private message contents are not shown in Admin Hub.', 'Trung tâm quản trị không hiển thị nội dung tin nhắn riêng tư.')}</p><div className="admin-actions">{selectedUser.isSuspended ? <button className="btn btn-blue" onClick={() => act(() => api.post(`/admin/users/${selectedUser._id}/unsuspend`), l('Account unsuspended', 'Đã mở khóa tài khoản'))}>{l('Unsuspend', 'Mở khóa')}</button> : <button className="btn btn-danger" disabled={selectedUser.isAdmin} onClick={() => userAction('suspend', selectedUser)}>{l('Suspend', 'Tạm khóa')}</button>}<button className="btn btn-ghost" onClick={() => userAction('logout', selectedUser)}>{l('Force logout', 'Đăng xuất bắt buộc')}</button></div></section></div>}
    </main>
  );
};

export default Admin;
