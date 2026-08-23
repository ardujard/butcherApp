import { useState } from 'react'
import { LabelsAdmin } from './LabelsAdmin'
import { ProductsAdmin } from './ProductsAdmin'

type Tab = 'products' | 'labels'

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
      </div>
      {tab === 'products' ? <ProductsAdmin /> : <LabelsAdmin />}
    </div>
  )
}
