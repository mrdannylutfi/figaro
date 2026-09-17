// tailwind.config.js
const figmaTheme = require('./theme.json');

module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: figmaTheme.colors,
      spacing: figmaTheme.spacing,
    },
  },
  plugins: [],
};
