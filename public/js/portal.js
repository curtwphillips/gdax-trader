var domReady = false;

var portal = (function () {
  // used for logging
  var file = '\nportal.js ';
  var env = 'prod';
  var hostname = location.hostname;
  if (hostname === 'localhost') {
    document.title = 'Gdax Trader';
    env = 'local'
  }

  // user role such as admin, manager, staff
  var userRole;

  // user settings, such as default selections
  var userSettings;

  // reference to current view title
  var currentViewTitle = '/';

  // listen for userSettings changes
  document.addEventListener('userSettingsChange', function (e) {
    userSettings = e.detail;
    userRole = userSettings.role;
  });

  // initial set up
  document.addEventListener("DOMContentLoaded", function(event) {
    // changeView(window.location.pathname);
    changeView('/live');
  });
  var retries = 0;
  // replace the current view
  function changeView (path, event) {
    try {
      if (event) {
        event.preventDefault();
      }
      if (currentViewTitle === path && window.location.pathname === path) {
        showBody();
        return;
      }
      if (!domReady) {
        setTimeout(function () {
          changeView (path);
        }, 10);
        return;
      }
      if (!window.pages) {
        retries++;
        if (retries < 30) {
          setTimeout(function () {
            changeView(path);
          }, 10);
        }
        return;
      }
      window.history.pushState("", "", path);
      // set the page view
      pages.setView(path);
      // attach the import if it is different from the current view's import
      if (!pages.views[path]) {
        throw new Error('path not in views: ' + path);
      }
      if (currentViewTitle && !pages.views[currentViewTitle]) {
        throw new Error('currentViewTitle not in views: ' + currentViewTitle);
      }
      var pathImportLinkId = pages.views[path].importLinkId;
      var currentImportLinkId = pages.views[currentViewTitle].importLinkId;
      if (!currentViewTitle || pathImportLinkId !== currentImportLinkId) {
        pages.attachImport();
      }
      currentViewTitle = path;
      updateView();
    } catch (error) {
      console.log('error: ' + error);
    }
  }

  function updateView () {
    if (!domReady) {
      return setTimeout(function () {
        updateView;
      }, 10);
    }
    pages.initializeView();
    showBody();
  }

  function showBody () {
    setTimeout(function () {
      $(document.body).show();
    }, 0);
  }

  function isArray(test) {
    return Array.isArray(test);
  }

  function isDomReady () {
    return domReady;
  }

  return {
    changeView: changeView,
    env: env,
    isDomReady: isDomReady,
  };
}());

window.addEventListener('WebComponentsReady', function(e) {
  // give dom extra ms before sharing that it is ready
  setTimeout(function () {
    domReady = true;
    sockets.init();
  }, 100);
});
