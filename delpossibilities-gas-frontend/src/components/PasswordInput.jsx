import { useState } from 'react'
import { Eye, EyeOff, Lock } from 'lucide-react'

function PasswordInput({ id, value, onChange, placeholder, autoComplete, required, icon: Icon = Lock }) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      {Icon && (
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          strokeWidth={1.8}
          aria-hidden="true"
        />
      )}
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        autoComplete={autoComplete}
        required={required}
        className="input-field pl-9 pr-10"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 transition-colors hover:text-brand-teal"
      >
        {visible ? <EyeOff className="h-4 w-4" strokeWidth={1.8} /> : <Eye className="h-4 w-4" strokeWidth={1.8} />}
      </button>
    </div>
  )
}

export default PasswordInput
