import { useState } from 'react'
import { LabelsAdmin } from './LabelsAdmin'
import { ProductsAdmin } from './ProductsAdmin'
import { BackupAdmin } from './BackupAdmin'

type Tab = 'products' | 'labels' | 'backup'

export function SettingsScreen() {
  const [tab, setTab] = useState<Tab>('products')

  return (
    <div>
      <div className="tabs">
        <button className={tab === 'products' ? 'active' : ''} onClick={() => setTab('products')}>
          Products
        </button>
        <button className={tab === 'labels' ? 'active' : ''} onClick={() => setTab('labels')}>
          Labels
        </button>
        <button className={tab === 'backup' ? 'active' : ''} onClick={() => setTab('backup')}>
          Backup
        </button>
      </div>
      {tab === 'products' ? <ProductsAdmin /> : tab === 'labels' ? <LabelsAdmin /> : <BackupAdmin />}
    </div>
  )
}
