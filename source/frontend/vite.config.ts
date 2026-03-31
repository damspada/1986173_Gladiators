import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [tailwindcss(), react()],
    define: {
      'import.meta.env.VITE_FRONTEND_VERSION': JSON.stringify(env.VITE_FRONTEND_VERSION || process.env.npm_package_version || '0.0.0'),
      'import.meta.env.VITE_BUILD_COMMIT': JSON.stringify(env.VITE_BUILD_COMMIT || process.env.GIT_COMMIT || 'unknown'),
      'import.meta.env.VITE_BUILD_TIMESTAMP': JSON.stringify(env.VITE_BUILD_TIMESTAMP || new Date().toISOString()),
      'import.meta.env.VITE_BACKEND_IMAGE_TAG': JSON.stringify(env.VITE_BACKEND_IMAGE_TAG || 'untracked'),
    },
  }
})
