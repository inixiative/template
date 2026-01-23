import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';

export function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    return <div>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <h1 style={styles.logo}>Inixiative</h1>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.card}>
          <h2 style={styles.cardTitle}>Welcome, {user.name || user.email}!</h2>
          <p style={styles.cardText}>You're logged into the Inixiative platform.</p>

          <div style={styles.userInfo}>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email:</span>
              <span>{user.email}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Email Verified:</span>
              <span>{user.emailVerified ? 'Yes' : 'No'}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>KYC Status:</span>
              <span style={styles.badge}>{user.kycStatus}</span>
            </div>
            <div style={styles.infoRow}>
              <span style={styles.infoLabel}>Member Since:</span>
              <span>{new Date(user.createdAt).toLocaleDateString()}</span>
            </div>
          </div>
        </div>

        <div style={styles.grid}>
          <div style={styles.statCard}>
            <h3 style={styles.statTitle}>Wallets</h3>
            <p style={styles.statValue}>0</p>
            <p style={styles.statDesc}>Connected wallets</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statTitle}>Investments</h3>
            <p style={styles.statValue}>$0</p>
            <p style={styles.statDesc}>Total invested</p>
          </div>
          <div style={styles.statCard}>
            <h3 style={styles.statTitle}>Tokens</h3>
            <p style={styles.statValue}>0</p>
            <p style={styles.statDesc}>Tokens held</p>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 24px',
    backgroundColor: 'white',
    borderBottom: '1px solid #eee',
  },
  logo: {
    margin: 0,
    fontSize: '20px',
    fontWeight: '600',
  },
  logoutButton: {
    padding: '8px 16px',
    backgroundColor: 'transparent',
    border: '1px solid #ddd',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  main: {
    padding: '24px',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  card: {
    backgroundColor: 'white',
    padding: '24px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '24px',
  },
  cardTitle: {
    margin: '0 0 8px 0',
    fontSize: '20px',
  },
  cardText: {
    margin: '0 0 24px 0',
    color: '#666',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  infoRow: {
    display: 'flex',
    gap: '12px',
  },
  infoLabel: {
    fontWeight: '500',
    width: '120px',
    color: '#666',
  },
  badge: {
    backgroundColor: '#e0e7ff',
    color: '#4338ca',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: '500',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  statCard: {
    backgroundColor: 'white',
    padding: '20px',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  statTitle: {
    margin: '0 0 8px 0',
    fontSize: '14px',
    color: '#666',
    fontWeight: '500',
  },
  statValue: {
    margin: '0 0 4px 0',
    fontSize: '28px',
    fontWeight: '600',
  },
  statDesc: {
    margin: 0,
    fontSize: '12px',
    color: '#888',
  },
};
