import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5180,
    // 端口被占时直接失败，而不是悄悄换一个 —— 换端口会让人以为"服务没起来"
    strictPort: true,
  },
})
