# Website

This website is built using [Docusaurus](https://docusaurus.io/), a modern static website generator.

# Garmin

I created the [Garmin wizard](https://www.erlendthune.com/docs/garmin/) on my Docusaurus site the following way:

- I first used C# to download the Garmin products and specifications. The source code is in my [Garmin repository](https://github.com/erlendthune/garmin). You will find instructions on how to create a products.db sqlite3 file that contains all the products and specification for all the Garmin watches.

- I then installed the sqlite3 WASM plugin with npm install.