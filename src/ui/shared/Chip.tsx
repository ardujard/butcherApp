interface Props {
  label: string
  selected?: boolean
  onClick: () => void
}

export function Chip({ label, selected = false, onClick }: Props) {
  return (
    <button type="button" className={`chip${selected ? ' selected' : ''}`} onClick={onClick}>
      {label}
    </button>
  )
}
