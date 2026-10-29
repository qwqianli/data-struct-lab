import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 部署到 GitHub Pages 时资源挂在 /data-struct-lab/ 子路径下；
// 本地 dev 保持根路径，否则 localhost:5180/ 会 404、所有深链都要加前缀。
export default defineConfig(({ command }) => ({
  base: command === 'build' ? '/data-struct-lab/' : '/',
  plugins: [vue()],
  server: {
    port: 5180,
    // 端口被占时直接失败，而不是悄悄换一个 —— 换端口会让人以为"服务没起来"
    strictPort: true,
  },
}))
