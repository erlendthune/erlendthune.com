module.exports = async function myPlugin(context, options) {
  return {
    name: 'garmin-plugin',
    async loadContent() {
      debugger;
      console.log('Plugin: Load content');
      // Perform any asynchronous tasks to load content
      // For example, fetching data from an external API
      return {some: "data"} ;
    },
    async contentLoaded({ content, actions }) {
      const {some}  = content
      // optional: use Promise.all to execute multiple async functions at once
      // this will speed things up by creating pages in parallel
      return actions.addRoute({
        // this is the path slug
        path: "/some",
        // the page component used to render the page
        component: require.resolve( "/Users/erlendthune/github/erlendthune.com/src/MyCustomPage.js"),
        // will only match for exactly matching paths
        exact: true,
        // you can use this to optionally overwrite certain theme components
        // see here: https://github.com/facebook/docusaurus/blob/main/packages/docusaurus-plugin-content-blog/src/index.ts#L343
        modules: {},
        // any extra custom data keys are passed to the page
        customData: content
      });
    }    
  };
};
