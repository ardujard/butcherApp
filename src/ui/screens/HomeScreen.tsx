export type Screen = 'home' | 'write' | 'read' | 'settings'

interface Props {
  onNavigate: (screen: Screen) => void
}

export function HomeScreen({ onNavigate }: Props) {
  return (
    <div className="home-grid">
      <button className="home-tile" onClick={() => onNavigate('write')}>
        <span className="icon">✏️</span>
        <span className="label">Aanvullen</span>
      </button>
      <button className="home-tile" onClick={() => onNavigate('read')}>
        <span className="icon">📖</span>
        <span className="label">Controleer</span>
      </button>
      <button className="home-tile" onClick={() => onNavigate('settings')}>
        <span className="icon">⚙️</span>
        <span className="label">Settings</span>
      </button>
    </div>
  )
}
