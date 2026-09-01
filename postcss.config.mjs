const config = {
  plugins: {
    "@tailwindcss/postcss": {
      // Scope class-candidate scanning to the app source only. Tailwind's
      // default scans the whole project (including markdown/docs in the root,
      // e.g. DEFECTS.md, whose prose code samples contain `text-[var(...)]`).
      // Those literals compile to broken utilities (`color: var(...)`) and
      // crash the PostCSS transform. Scanning `./src` excludes prose entirely.
      base: "./src",
    },
  },
};

export default config;
