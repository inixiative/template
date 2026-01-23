import { swagger } from '@elysiajs/swagger'

export const openApi = swagger({
  provider: 'scalar',
  documentation: {
    info: {
      title: 'API Documentation',
      version: '1.0.0',
      description: 'API documentation with Scalar UI'
    }
  },
  scalarConfig: {
    theme: 'purple',
    darkMode: true,
    hideDownloadButton: false,
    showSidebar: true
  },
  path: '/docs',
  exclude: ['/docs', '/docs/json']
})
