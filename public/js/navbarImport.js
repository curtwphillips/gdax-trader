let retries = 0;

(function () {
  function init () {
    // get the import
    let theImport = document.querySelector('#navbar-import');
    // get the imported html
    let htmlDoc = theImport.import;
    // if not compatible browser, htmlDoc is null
    if (!htmlDoc) {
      return setTimeout(function () {
        retries++;
        if (retries < 10) {
          init();
        }
      }, 100);
    }
    // get the nav elem from the imported html
    let elem = htmlDoc.querySelector('#main-nav');
    // insert the nav element into the html body
    document.body.insertBefore(elem, document.body.childNodes[0]);
  }
  init();
})();
