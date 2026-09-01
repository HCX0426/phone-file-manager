import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const root = process.cwd()

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'src/main/index.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      lib: {
        entry: resolve(root, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(root, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(root, 'src/renderer/index.html')
        }
      }
    },
    plugins: [react()],
    resolve: {
      alias: {
        '@': resolve(root, 'src/renderer/src')
      }
    }
  }
})
