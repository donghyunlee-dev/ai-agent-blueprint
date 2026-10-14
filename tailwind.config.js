import sharedUiPreset from "@sfood/ui/tailwind.config.js";

export default {
  presets: [sharedUiPreset],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx}",
    "./node_modules/@sfood/ui/dist/**/*.js",
  ],
};
