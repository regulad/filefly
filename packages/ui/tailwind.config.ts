import sharedConfig from "@repo/tailwind-config";
import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.tsx"],
  prefix: "ui-",
  presets: [sharedConfig],
  corePlugins: {
    preflight: false, // if we don't disable preflight in this package, we will run into a conflict with the preflight from the shared config overriding the styles set in individual apps
  },
};

export default config;
