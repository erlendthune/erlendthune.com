//https://docusaurus.io/docs/advanced/client#client-modules

export function onRouteDidUpdate({location, previousLocation}) {
  // Don't execute if we are still on the same page; the lifecycle may be fired
  // because the hash changes (e.g. when navigating between headings)
  console.log("OnRouteDidUpdate " +location.pathname);
  if(location.pathname.includes("/docs/garmin/garminwizard")) {
    startGarminWizard();
  }
}

export function onRouteUpdate({location, previousLocation}) {
  console.log("onRouteUpdate " + location.pathname);
}