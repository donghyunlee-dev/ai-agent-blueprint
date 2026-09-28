import sfoodPreset from "@sfood/ui/tailwind.config.js";

export default {
  presets: [sfoodPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@sfood/ui/dist/**/*.js",
  ],
};
