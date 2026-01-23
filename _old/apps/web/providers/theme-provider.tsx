'use client'

import React, { createContext, useContext, useEffect } from 'react'
import { DesignTokens, defaultTokens, darkTokens } from '@/styles/design-tokens'

interface ThemeContextType {
  tokens: DesignTokens
  setTokens: (tokens: Partial<DesignTokens>) => void
  theme: 'light' | 'dark'
  setTheme: (theme: 'light' | 'dark') => void
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined)

export function useTheme() {
  const context = useContext(ThemeContext)
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider')
  }
  return context
}

function mergeTokens(base: DesignTokens, overrides: Partial<DesignTokens>): DesignTokens {
  return {
    colors: { ...base.colors, ...overrides.colors },
    spacing: { ...base.spacing, ...overrides.spacing },
    radius: { ...base.radius, ...overrides.radius },
    fontSize: { ...base.fontSize, ...overrides.fontSize },
    fontWeight: { ...base.fontWeight, ...overrides.fontWeight },
    lineHeight: { ...base.lineHeight, ...overrides.lineHeight },
    shadows: { ...base.shadows, ...overrides.shadows },
    transitions: { ...base.transitions, ...overrides.transitions },
  }
}

function applyTokensToCSS(tokens: DesignTokens, isDark: boolean) {
  const root = document.documentElement
  
  // Apply color tokens
  Object.entries(tokens.colors).forEach(([key, value]) => {
    const cssKey = key.replace(/([A-Z])/g, '-$1').toLowerCase()
    root.style.setProperty(`--color-${cssKey}`, value)
  })
  
  // Apply spacing tokens
  Object.entries(tokens.spacing).forEach(([key, value]) => {
    root.style.setProperty(`--spacing-${key}`, value)
  })
  
  // Apply radius tokens
  Object.entries(tokens.radius).forEach(([key, value]) => {
    root.style.setProperty(`--radius-${key}`, value)
  })
  
  // Apply font size tokens
  Object.entries(tokens.fontSize).forEach(([key, value]) => {
    root.style.setProperty(`--font-size-${key}`, value)
  })
  
  // Apply font weight tokens
  Object.entries(tokens.fontWeight).forEach(([key, value]) => {
    root.style.setProperty(`--font-weight-${key}`, String(value))
  })
  
  // Apply line height tokens
  Object.entries(tokens.lineHeight).forEach(([key, value]) => {
    root.style.setProperty(`--line-height-${key}`, String(value))
  })
  
  // Apply shadow tokens
  Object.entries(tokens.shadows).forEach(([key, value]) => {
    root.style.setProperty(`--shadow-${key}`, value)
  })
  
  // Apply transition tokens
  Object.entries(tokens.transitions).forEach(([key, value]) => {
    root.style.setProperty(`--transition-${key}`, value)
  })
}

interface ThemeProviderProps {
  children: React.ReactNode
  defaultTheme?: 'light' | 'dark'
  customTokens?: Partial<DesignTokens>
}

export function ThemeProvider({ 
  children, 
  defaultTheme = 'light',
  customTokens = {}
}: ThemeProviderProps) {
  const [theme, setTheme] = React.useState<'light' | 'dark'>(defaultTheme)
  const [tokens, setTokensState] = React.useState<DesignTokens>(() => 
    mergeTokens(defaultTokens, customTokens)
  )
  
  const setTokens = React.useCallback((newTokens: Partial<DesignTokens>) => {
    setTokensState(current => mergeTokens(current, newTokens))
  }, [])
  
  useEffect(() => {
    const isDark = theme === 'dark'
    const currentTokens = isDark 
      ? mergeTokens(mergeTokens(defaultTokens, darkTokens), customTokens)
      : mergeTokens(defaultTokens, customTokens)
    
    applyTokensToCSS(currentTokens, isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [theme, tokens, customTokens])
  
  return (
    <ThemeContext.Provider value={{ tokens, setTokens, theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}