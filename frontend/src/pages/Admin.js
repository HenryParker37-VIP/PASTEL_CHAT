import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../contexts/AuthContext';

const Admin = () => {
  const [users, setUsers] = useState([]);
  const [feedback, setFeedback] = useState({ bug: [], feature: [], feedback: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If somehow a non-admin gets here, kick them out
    if (user && user.loginCode !== 'ADMN-0307' && !user.isAdmin) {
      navigate('/home');
      return;
    }

    const fetchStats = async () => {
      try {
        const { data } = await api.get('/admin/dashboard');
        setUsers(data.users);
        
        const categorized = { bug: [], feature: [], feedback: [] };
        data.feedback.forEach(f => {
          if (categorized[f.type]) categorized[f.type].push(f);
        });
        setFeedback(categorized);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to load admin stats');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [navigate, user]);

  if (loading) {
    return <div className="center"><p>Loading Admin Base...</p></div>;
  }

  if (error) {
    return (
      <div className="center">
        <div className="card pop-in" style={{ textAlign: 'center' }}>
          <h2>Access Denied</h2>
          <p>{error}</p>
          <button className="btn btn-blue" onClick={() => navigate('/home')}>Return to Home</button>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ maxWidth: 1200 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 30 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, color: 'var(--pink)' }}>🛡️ Admin Hub</h1>
          <p style={{ margin: 0, color: '#888' }}>Monitor PastoralChat health and users</p>
        </div>
        <button className="btn btn-ghost" onClick={logout}>Log out Admin</button>
      </div>

      {/* Users Section */}
      <div className="card pop-in" style={{ animationDelay: '0.1s', marginBottom: 30, overflowX: 'auto' }}>
        <h2 style={{ fontSize: 20, margin: '0 0 16px' }}>👥 All Registered Users ({users.length})</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 600 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--soft-pink)', color: '#888' }}>
              <th style={{ padding: '10px 8px' }}>Avatar</th>
              <th style={{ padding: '10px 8px' }}>Name</th>
              <th style={{ padding: '10px 8px' }}>Joined Date</th>
              <th style={{ padding: '10px 8px' }}>Last Logged In</th>
              <th style={{ padding: '10px 8px' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <tr key={u._id} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '8px' }}><img src={u.avatar} alt="avatar" style={{ width: 32, height: 32, borderRadius: '50%' }} /></td>
                <td style={{ padding: '8px', fontWeight: 'bold' }}>{u.name} {u.isAdmin ? '👑' : ''}</td>
                <td style={{ padding: '8px', fontSize: 13, color: '#666' }}>{new Date(u.createdAt).toLocaleString()}</td>
                <td style={{ padding: '8px', fontSize: 13, color: '#666' }}>{new Date(u.lastSeen).toLocaleString()}</td>
                <td style={{ padding: '8px' }}>
                  <span className="badge" style={{ background: u.isOnline ? '#e6f4ea' : '#f1f3f4', color: u.isOnline ? '#1e8e3e' : '#5f6368' }}>
                    {u.isOnline ? 'Online' : 'Offline'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Feedback Windows */}
      <div>
        <h2 style={{ fontSize: 20, margin: '0 0 16px', color: 'var(--text)' }}>📬 User Requests & Tickets</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
          
          {/* Bugs Window */}
          <div className="card pop-in" style={{ animationDelay: '0.2s', borderTop: '4px solid #e57373' }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              🐞 Bugs ({feedback.bug.length})
            </h3>
            {feedback.bug.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>No bugs reported! 🎉</p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.bug.map(b => (
                <div key={b._id} style={{ background: '#fdf3f3', padding: 12, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{b.message}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>user ID: {b.userId} • {new Date(b.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Features Window */}
          <div className="card pop-in" style={{ animationDelay: '0.3s', borderTop: '4px solid var(--mint)' }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              💡 Features ({feedback.feature.length})
            </h3>
            {feedback.feature.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>No feature requests.</p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.feature.map(f => (
                <div key={f._id} style={{ background: '#f0f9fa', padding: 12, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{f.message}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>user ID: {f.userId} • {new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* General Feedback Window */}
          <div className="card pop-in" style={{ animationDelay: '0.4s', borderTop: '4px solid var(--blue)' }}>
            <h3 style={{ margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
              💌 Feedback ({feedback.feedback.length})
            </h3>
            {feedback.feedback.length === 0 ? <p style={{ color: '#888', fontSize: 14 }}>No feedback messages.</p> : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {feedback.feedback.map(f => (
                <div key={f._id} style={{ background: '#f0f4f8', padding: 12, borderRadius: 10 }}>
                  <p style={{ margin: 0, fontSize: 14 }}>{f.message}</p>
                  <p style={{ margin: '6px 0 0', fontSize: 11, color: '#aaa' }}>user ID: {f.userId} • {new Date(f.createdAt).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Admin;
