module.exports = {
  appId: "com.relic.database-admin",
  productName: "Relic",
  electronVersion: "30.5.1",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "package.json",
    "../web/public/applogo.png",
  ],
  extraResources: [
    {
      from: "../web/.next/standalone",
      to: "web/.next/standalone",
      filter: ["**/*"],
    },
    {
      from: "../web/.next/static",
      to: "web/.next/static",
      filter: ["**/*"],
    },
    {
      from: "../web/public/applogo.png",
      to: "applogo.png",
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    target: ["dmg", "zip"],
    icon: "../web/public/applogo.png",
  },
  win: {
    target: ["nsis", "portable"],
    icon: "../web/public/applogo.png",
  },
  linux: {
    target: ["AppImage", "deb"],
    category: "Development",
    icon: "../web/public/applogo.png",
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
  },
};
