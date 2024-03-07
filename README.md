# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

# Garmin products database

I created the [Garmin wizard](https://www.erlendthune.com/docs/garmin/) on my Docusaurus site the following way:

I first used C# to download the Garmin products and specifications. The source code is in my [Garmin repository](https://github.com/erlendthune/garmin). There, you will find instructions on how to create a products.db sqlite3 file that contains all the products and specification for all the Garmin watches.

# Sqlite3 WASM (Web Assembly)
While in the root directory of Docusaurus, I installed the sqlite3 WASM plugin with npm install.

`npm install sql.js`

I then copied the `sql-wasm.js` and `sql-wasm.wasm` files from the `node_modules/sql.js/dist` to the `static/garmin` directory.

# Garmin wizard script

The code for the Garmin wizard is in the `static/garmin/script.js`file. And the styles necessary are in the ´static/garmin/garminstyles.css` file.

# Load the wizard

Docusaurus loads content asynchrounously. This means we cannot run the wizard before the page is ready. To obtain this we must plugin to the Docusaurs [getClientModules lifecycle](https://docusaurus.io/docs/api/plugin-methods/lifecycle-apis#getClientModules). 

- The Garmin wizard client module is `your-onRouteUpdate.script.js`in the `garmin-plugin-script` directory.
