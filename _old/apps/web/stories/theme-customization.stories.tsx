import type { Meta, StoryObj } from '@storybook/react'
import React from 'react'
import { ThemeProvider, useTheme } from '../providers/theme-provider'
import { Button } from '../components/ui/button'
import { DesignTokens } from '../styles/design-tokens'

const ThemeDemo = () => {
  const { theme, setTheme, setTokens } = useTheme()

  const customTokens: Partial<DesignTokens> = {
    colors: {
      primary: '142.1 76.2% 36.3%',
      primaryForeground: '355.7 100% 97.3%',
    },
  }

  const brandedTokens: Partial<DesignTokens> = {
    colors: {
      primary: '262.1 83.3% 57.8%',
      primaryForeground: '210 20% 98%',
      secondary: '262.1 83.3% 57.8%',
      secondaryForeground: '210 20% 98%',
    },
    radius: {
      md: '1rem',
      lg: '1.5rem',
    },
  }

  return (
    <div className="p-8 space-y-8">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Theme Customization Demo</h2>
        <p className="text-muted-foreground">
          This demonstrates how you can override design tokens at runtime.
        </p>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Theme Toggle</h3>
        <div className="flex gap-4">
          <Button
            variant={theme === 'light' ? 'default' : 'outline'}
            onClick={() => setTheme('light')}
          >
            Light Mode
          </Button>
          <Button
            variant={theme === 'dark' ? 'default' : 'outline'}
            onClick={() => setTheme('dark')}
          >
            Dark Mode
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Dynamic Token Updates</h3>
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setTokens({})}
          >
            Default Theme
          </Button>
          <Button
            variant="outline"
            onClick={() => setTokens(customTokens)}
          >
            Green Theme
          </Button>
          <Button
            variant="outline"
            onClick={() => setTokens(brandedTokens)}
          >
            Purple Theme
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Component Examples</h3>
        <div className="flex flex-wrap gap-4">
          <Button>Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Size Variants</h3>
        <div className="flex items-center gap-4">
          <Button size="sm">Small</Button>
          <Button size="default">Default</Button>
          <Button size="lg">Large</Button>
          <Button size="icon">🎨</Button>
        </div>
      </div>
    </div>
  )
}

const meta = {
  title: 'Design System/Theme Customization',
  component: ThemeDemo,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <ThemeProvider>
        <Story />
      </ThemeProvider>
    ),
  ],
} satisfies Meta<typeof ThemeDemo>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {}