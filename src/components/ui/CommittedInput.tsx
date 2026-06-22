import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react'
import { Input } from './Input'

interface CommittedInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  label?: string
  error?: string
  value: string
  onCommit: (value: string) => void | Promise<void>
}

export function CommittedInput({ value, onCommit, onBlur, onKeyDown, onCompositionEnd, ...props }: CommittedInputProps) {
  const [draft, setDraft] = useState(value)
  const [isFocused, setIsFocused] = useState(false)
  const isComposingRef = useRef(false)
  const latestValueRef = useRef(value)

  useEffect(() => {
    latestValueRef.current = value
    if (!isFocused && !isComposingRef.current) {
      setDraft(value)
    }
  }, [isFocused, value])

  function commit(nextValue = draft) {
    if (nextValue !== latestValueRef.current) {
      latestValueRef.current = nextValue
      void onCommit(nextValue)
    }
  }

  return (
    <Input
      {...props}
      value={draft}
      onFocus={(event) => {
        setIsFocused(true)
        props.onFocus?.(event)
      }}
      onChange={(event) => setDraft(event.target.value)}
      onCompositionStart={(event) => {
        isComposingRef.current = true
        props.onCompositionStart?.(event)
      }}
      onCompositionEnd={(event) => {
        isComposingRef.current = false
        setDraft(event.currentTarget.value)
        commit(event.currentTarget.value)
        onCompositionEnd?.(event)
      }}
      onBlur={(event) => {
        setIsFocused(false)
        commit(event.currentTarget.value)
        onBlur?.(event)
      }}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && !isComposingRef.current) {
          commit(event.currentTarget.value)
          event.currentTarget.blur()
        }
        onKeyDown?.(event)
      }}
    />
  )
}
