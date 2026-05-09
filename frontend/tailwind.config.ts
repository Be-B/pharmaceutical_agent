import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "var(--font-sans)",
          "Pretendard",
          "Noto Sans KR",
          "system-ui",
          "sans-serif",
        ],
      },
    },
  },
  plugins: [animate],
};

export default config;
