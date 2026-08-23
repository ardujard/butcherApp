import { useState } from 'react'
import { HomeScreen, type Screen } from './ui/screens/HomeScreen'
import { WriteScreen } from './ui/write/WriteScreen'
import { ReadScreen } from './ui/read/ReadScreen'
import { SettingsScreen } from './ui/settings/SettingsScreen'

const TITLES: Record<Exclude<Screen, 'home'>, string> = {
  write: 'Write',
  read: 'Read',
  settings: 'Settings',
}

function App() {
  const [screen, setScreen] = useState<Screen>('home')

  return (
    <div className="app-shell">
      {screen !== 'home' && (
        <div className="top-bar">
          <button className="back-button" onClick={() => setScreen('home')} aria-label="Back to home">
            🏠
          </button>
          <h1>{TITLES[screen]}</h1>
        </div>
      )}
      {screen === 'home' && <HomeScreen onNavigate={setScreen} />}
      {screen === 'write' && <WriteScreen />}
      {screen === 'read' && <ReadScreen />}
      {screen === 'settings' && <SettingsScreen />}
    </div>
  )
}

export default App
