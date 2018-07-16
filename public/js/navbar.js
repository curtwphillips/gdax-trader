var navbar = (function () {
  window.addEventListener('WebComponentsReady', function(e) {
    var loginLink = $('#nav-login-link');
    var logoutLink = $('#nav-logout-link');
    var portalLink = $('#nav-portal-link');

    if (window.location.pathname !== '/portal') {
      portalLink.addClass('active');
    }

    var isAuthorized = true;

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
