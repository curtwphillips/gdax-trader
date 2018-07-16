var settings = (function () {
  var userSettings;

  var environmentSelectId = 'settings-env-select';
  var regionSelectId = 'settings-region-select';
  var hideColumnsSelectId = 'settings-columns-select';
  var gdaxEnvsSelectId = 'settings-gdax-env-select';

  var successMsgId = 'settings-success-msg';
  var errorMsgId = 'settings-error-msg'

  function init () { setUserSelections(); }

  function setUserSelections (ignoreIfSet) { // setup settings.html from db user info

  }

  function saveSettings (event) { // save changes to user settings on settings.html
    try {
      event.preventDefault();
      var opts = {};
      opts.envs = $('#'+environmentSelectId).val();
      opts.regions = $('#'+regionSelectId).val();
      opts.hiddenColumns = $('#'+hideColumnsSelectId).val();
      opts.gdaxHideEnvs = $('#'+gdaxEnvsSelectId).val();
      var params = {
        authToken: auth.getAuthToken(),
        settings: opts,
      };
      $.ajax({
        url: '/api/user',
        type: 'PUT',
        data: params
      })
      .done(function (data) {
        if (data.error) {
          return errors.handleError(data.error, errorMsgId);
        }
        auth.changeUserSettings({settings: opts});
        errors.handleSuccess('', successMsgId);
      })
      .fail(function (err) {
        errors.handleError(err, errorMsgId);
      });
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  document.addEventListener('changeUserSettings', function (e) {
    try {
      userSettings = e.detail;
      setUserSelections(true);
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  });

  pages.namespaces.settings = {
    init: init,
    saveSettings: saveSettings,
    setUserSelections: setUserSelections,
  }
  return pages.namespaces.settings;
}());
