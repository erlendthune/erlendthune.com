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
              src: '/garmin/script.js',
            },
          },
        ]
      };
    },
  };
}

// module.exports = function (context, options) {
//   return {
//     name: 'docusaurus-plugin-special-script',
//     injectHtmlTags() {
//       const { siteConfig } = context;
//       const { baseUrl } = siteConfig;

//       // Identify special documents based on their file paths
//       const specialDocumentPaths = ['/docs/garmin/garminwizard.md']; // Adjust this based on your actual special documents

//       // Get the current path
//       const { routeBasePath, routePath } = context;

//       // Check if the current route path matches any special document path
//       console.log(routePath)
//       if (specialDocumentPaths.includes(routePath)) {
//         return {
//           headTags: [
//             {
//               tagName: 'script',
//               attributes: {
//                 src: `/garmin/script.js`,
//               },
//             },
//           ],
//         };
//       }

//       return {};
//     },
//   };
// };
