let navbar = (function () {
  window.addEventListener('WebComponentsReady', function(e) {
    let loginLink = $('#nav-login-link');
    let logoutLink = $('#nav-logout-link');
    let portalLink = $('#nav-portal-link');

    if (window.location.pathname !== '/portal') {
      portalLink.addClass('active');
    }

    let isAuthorized = true;

    if (isAuthorized) {
      loggedIn();
    }

    function loggedIn () {
      loginLink.hide();
      logoutLink.show();
      portalLink.show();
    }

    function loggedOut () {
      loginLink.show();
      logoutLink.hide();
      portalLink.hide();
    }

    // listen for auth changes
    document.addEventListener('authChange', function (e) {
      if (e.detail.isAuthorized) {
        loggedIn();
      } else {
        loggedOut();
      }
    });
  });

  return {};
}());
