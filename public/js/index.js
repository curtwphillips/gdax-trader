// instantiated on initial page load
(function () {
  var navbarImportRetries = 0;
  var modalImportRetries = 0;

  importNavBar();
  importModals();

  function importNavBar () {
    // get the import
    var theImport = document.querySelector('#navbar-import');
    // get the imported html
    var htmlDoc = theImport.import;
    // if not compatible browser, htmlDoc is null
    if (!htmlDoc) {
      return setTimeout(function () {
        navbarImportRetries++;
        if (navbarImportRetries < 10) {
          importNavBar();
        }
      }, 100);
    }
    // get the nav elem from the imported html
    var elem = htmlDoc.querySelector('#main-nav');
    // insert the nav element into the html body
    document.body.insertBefore(elem, document.body.childNodes[0]);
  }

  function importModals () {
    // get the import
    var theImport = document.querySelector('#all-modals-import');
    // get the imported html
    var htmlDoc = theImport.import;
    // if not compatible browser, htmlDoc is null
    if (!htmlDoc) {
      return setTimeout(function () {
        modalImportRetries++;
        if (modalImportRetries < 10) {
          importModals();
        }
      }, 100);
    }
    // get the elem from the imported html
    var elem = htmlDoc.querySelector('#modal-import-container');
    // insert the element into the html body
    document.body.appendChild(elem, document.body.childNodes[0]);
  }
}());
