module.exports = {
  appId: "com.relic.database-admin",
  productName: "Relic",
  electronVersion: "30.5.1",
  copyright: "Copyright © 2024 Relic Team",
  directories: {
    output: "release",
  },
  files: [
    "dist/**/*",
    "package.json",
  ],
  extraResources: [
    {
      from: "../web/.next/standalone",
      to: "web/.next/standalone",
      filter: ["**/*"],
    },
    {
      from: "../web/.next/static",
      to: "web/.next/standalone/projects/relic/apps/web/.next/static",
      filter: ["**/*"],
    },
    {
      from: "../web/public",
      to: "web/.next/standalone/projects/relic/apps/web/public",
      filter: ["**/*"],
    },
    {
      from: "../web/public/applogo.png",
      to: "applogo.png",
    },
  ],
  linux: {
    target: [
      {
        target: "AppImage",
        arch: ["x64"],
      },
      {
        target: "deb",
        arch: ["x64"],
      },
    ],
    category: "Development",
    icon: "../web/public/applogo.png",
    executableName: "relic",
    artifactName: "${productName}-${version}-${arch}.${ext}",
  },
  deb: {
    maintainer: "Relic Team <contact@relic.dev>",
    packageName: "relic",
    icon: "../web/public/applogo.png",
  },
};
