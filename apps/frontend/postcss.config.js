module.exports = {
  plugins: {
    // Tailwind v4 ships its own PostCSS plugin; autoprefixer is now built in.
    // Theme/content config is loaded from tailwind.config.js via the `@config`
    // directive in src/app/globals.css.
    '@tailwindcss/postcss': {},
  },
};
