import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // 상대 경로를 사용하므로 GitHub Pages의
  // https://USERNAME.github.io/REPOSITORY/ 형태에서도 동작합니다.
  base: "./",
  plugins: [react()],
  build: {
    target: "es2020"
  }
});
