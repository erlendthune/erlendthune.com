import React, { useEffect } from 'react';
import Layout from '@theme/Layout';

const MyCustomPage = (props) => {
  useEffect(() => {
    const script1 = document.createElement('script');
    script1.src = 'http://localhost:3000/garmin/sql-wasm.js';
    document.body.appendChild(script1);

    const script = document.createElement('script');
    script.src = 'http://localhost:3000/garmin/script.js';
    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script1);
      document.body.removeChild(script);
    };
  }, []);

  const customData = props.route.customData;

  return (
    <Layout>
      <h1>{customData.some}</h1>
      At the time of downloading, Garmin had a total of 
    <span id="productCountPlaceholder"></span> on their web pages.

    These watches had a total of <span id="specificationCountPlaceholder"></span> specifications to choose
    between.
      <div id="garmin"></div>
    </Layout>
  );
};

export default MyCustomPage;

// //https://www.tzeyiing.com/posts/how-to-generate-dynamic-pages-for-docusaurus/
// import Layout from "@theme/Layout";
// const MyCustomPage = (props) =>{
//   const customData = props.route.customData
//   return(<Layout>
    
//     <h1>{customData.some}</h1>
//     <div id="garmin"></div>
//     <script src="http://localhost:3000/garmin/script.js">console.log("LOADED");</script>
//   </Layout>)
// }

// export default MyCustomPage