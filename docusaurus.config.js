// @ts-check
// `@type` JSDoc annotations allow editor autocompletion and type checking
// (when paired with `@ts-check`).
// There are various equivalent ways to declare your Docusaurus config.
// See: https://docusaurus.io/docs/api/docusaurus-config

import {themes as prismThemes} from 'prism-react-renderer';

// This runs in Node.js - Don't use client-side code here (browser APIs, JSX...)

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: 'Erlend Thune',
  tagline: 'Invent something smarter',
  favicon: 'img/erlendthune.webp',

  // Set the production url of your site here
  url: 'https://erlendthune.com',
  // Set the /<baseUrl>/ pathname under which your site is served
  // For GitHub pages deployment, it is often '/<projectName>/'
  baseUrl: '/',

  // GitHub pages deployment config.
  // If you aren't using GitHub pages, you don't need these.
  organizationName: 'erlendthune', // Usually your GitHub org/user name.
  projectName: 'erlendthune.com', // Usually your repo name.

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  // Even if you don't use internationalization, you can use this field to set
  // useful metadata like html lang. For example, if your site is Chinese, you
  // may want to replace "en" with "zh-Hans".
  i18n: {
    defaultLocale: 'en',
    locales: ['en'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: './sidebars.js',
        },
        blog: {
          showReadingTime: true,
          feedOptions: {
            type: ['rss', 'atom'],
            xslt: true,
          },
          onInlineTags: 'warn',
          onInlineAuthors: 'warn',
          onUntruncatedBlogPosts: 'warn',
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      // Replace with your project's social card
      image: 'img/erlendthune.webp',
      navbar: {
        title: 'Erlend Thune',
        logo: {
          alt: 'Erlend Thune Logo',
          src: 'img/erlendthune.webp',
        },
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'productsSidebar',
            position: 'left',
            label: 'Products',
          }
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: 'GitHUB',
            items: [
              {
                label: 'Polpriser',
                href: 'https://github.com/polpriser',
              },
              {
                label: 'Garmin wizard',
                href: 'https://github.com/garminwizard',
              },
              {
                label: 'Erlend Thune',
                href: 'https://github.com/erlendthune',
              },
            ],
          },
        ],
        copyright: `Copyright © ${new Date().getFullYear()} Erlend Thune`,
      },
      colorMode: {
        defaultMode: 'light',
        disableSwitch: false,
        respectPrefersColorScheme: true,
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
      },
      customCss: require.resolve('./src/css/custom.css'),
    }),
};

export default config;
