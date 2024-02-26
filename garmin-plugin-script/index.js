export default function (context, options) {
  return {
    name: 'garmin-script-plugin',

    getClientModules() {
      return [require.resolve('./your-onRouteUpdate-script.js')];
    },
    injectHtmlTags({content}) {
      return {
        preBodyTags: [
          {
            tagName: 'script',
            attributes: {
              charset: 'utf-8',
              src: '/garmin/script.js?v=2',
            },
          },
        ]
      };
    },
  };
}
