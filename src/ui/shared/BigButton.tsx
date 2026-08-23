import type { ButtonHTMLAttributes } from 'react'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'primary' | 'danger'
}

export function BigButton({ variant = 'default', className = '', ...rest }: Props) {
  const variantClass = variant === 'default' ? '' : ` ${variant}`
  return <button type="button" className={`big-button${variantClass} ${className}`} {...rest} />
}
