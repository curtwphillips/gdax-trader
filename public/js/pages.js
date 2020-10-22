/*
  general flow:
  receive view change from portal.js
  attach view html
  setup elements for the view
  user makes selections and clicks search
  tear down existing search data
  get new search data
  build table
*/
let pages = (function () {
  let viewElement;
  // save previously attached view ids
  let attachedViews = [];
  let view, viewPath, table;
  // ref to view
  let modals; // fill in after dom loaded
  let defaultShowableIds = [
    { id: "main-content" }, // show for home page
    { id: "portal-container" }, // show for portal page
  ];
  /*
    configures the letious views
    importLinkId is the id of the imported html file's <link> tag
  */
  let views = {
    "/": {
      title: "Home Page",
      showIds: ["main-content"],
    },
    "/live": {
      title: "live",
      namespace: "live",
      importLinkId: "live-import",
      importInnerId: "live-import-container",
      showIds: ["portal-container"],
    },
    "/helpful-links": {
      title: "Helpful Links",
      namespace: "links",
      importLinkId: "helpful-links-import",
      importInnerId: "helpful-links-import-container",
      showIds: ["portal-container"],
    },
    "/settings": {
      title: "Settings",
      importLinkId: "settings-import",
      importInnerId: "settings-import-container",
      namespace: "settings",
      showIds: ["portal-container"],
    },
  };

  // initial set up
  window.addEventListener("WebComponentsReady", function (e) {
    try {
      // set up modal info for when modals are opened
      modals = {
        "list-edit-modal": {
          setupFn: listEditModal.setupModal,
          requiresRows: true,
        },
      };
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  });

  // add an info box to show user selections changed and table has stale data
  function onSelectionsChanged(event) {
    try {
      if (table && table.selectionsChangedMsgId) {
        errors.handleSuccess(
          "selections have changed since last search",
          table.selectionsChangedMsgId
        );
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // used to change the view to imported html
  function attachImport() {
    try {
      if (!viewElement) {
        viewElement = $("#portal-view");
      }
      let importLinkId = view.importLinkId;
      if (importLinkId) {
        let importInnerId = view.importInnerId;
        if (!importInnerId) {
          importInnerId = "import-container";
        }
        for (let i = 0; i < attachedViews.length; i++) {
          if (attachedViews[i] !== importInnerId) {
            $("#portal-view #" + attachedViews[i]).hide();
          }
        }
        if (attachedViews.indexOf(importInnerId) === -1) {
          attachedViews.push(importInnerId);
        } else {
          $("#portal-view #" + importInnerId).show();
          return;
        }
        // get the import
        let imported = document.querySelector("#" + importLinkId);
        // get the imported html from the import
        let html = imported.import;
        // get the inner element from the imported html which gets attached to the dom
        let importElement = html.querySelector("#" + importInnerId);
        viewElement.append(importElement);
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  /**
   * create a table in the dom
   *
   * @param data {rowData: [], ...} contains the properties used to buile
   * the table, requires rowData array
   */
  function buildTable(data) {
    try {
      // make sure view is initialized
      if (!portal.isDomReady()) {
        return setTimeout(function () {
          buildTable(data);
        }, 20);
      }
      // don't process empty results
      if (
        !data ||
        !data.rowData ||
        !Array.isArray(data.rowData) ||
        data.rowData.length === 0
      ) {
        errors.handleError("No data available", data.errorMsgId);
        return { error: true };
      }
      // show buttons that go with data
      // params dataExists, showableIds, showIds, hideIds
      showHideIds(true, data.showableIds, data.showIds);
      // each row object will hold the meta data for the row and the row itself
      data.rows = [];
      if (!data.rowData) {
        throw new Error("table rows were not found");
      } else {
        for (let i = 0; i < data.rowData.length; i++) {
          data.rows.push({
            pristineRow: data.rowData[i],
          });
        }
      }
      // create the table in the dom
      table = tables.create(data);
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    } finally {
      // reset the search button
      // updateSearchButton (false, data.searchButtonId, data.searchButtonText || 'Search');
    }
  }

  // called by export button click on many pages
  function exportToCSV(event) {
    try {
      event.preventDefault();
      tables.exportToCSV(view.title);
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // returns array of original row numbers for checked rows that are unfiltered
  function getCheckedRows() {
    try {
      let checkedRows = [];
      $('input:checked[data-row-checkbox="true"]:visible').each(function () {
        checkedRows.push($(this).attr("row"));
      });
      return checkedRows;
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // get data that should be shown automatically on view load
  function getInitialData() {
    try {
      if (!portal.isDomReady()) {
        return setTimeout(function () {
          getInitialData();
        }, 10);
      }
      if (view.namespace && pages.namespaces[view.namespace]) {
        if (pages.namespaces[view.namespace].viewConfig) {
          for (let key in pages.namespaces[view.namespace].viewConfig) {
            view[key] = pages.namespaces[view.namespace].viewConfig[key];
          }
        }
        if (pages.namespaces[view.namespace].init) {
          pages.namespaces[view.namespace].init();
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // get a row with original order
  function getRowFromOriginalOrder(originalRowNumber, tableData) {
    try {
      let i;
      if (!originalRowNumber && originalRowNumber !== 0) {
        return;
      }
      // use the standard table if no table data is passed in
      if (!tableData) {
        tableData = table;
      }
      for (i = 0; i < table.rows.length; i++) {
        if (table.rows[i].originalOrder == originalRowNumber) {
          return table.rows[i];
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }
  // return selected instance info
  function getSelectedInstancesInfo() {
    return selectedInstancesInfo;
  }
  // return the selected set of rows
  function getSelectedRows() {
    try {
      let checkedRows = getCheckedRows();
      let selectedRows = [];
      // only include selected rows that are not already in the correct state
      for (i = 0; i < checkedRows.length; i++) {
        rowIndex = checkedRows[i];
        // get correct row
        row = getRowFromOriginalOrder(rowIndex);
        if (!row) {
          continue;
        }
        selectedRows.push(row);
      }
      return selectedRows;
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // used to share the current view's title
  function getTitle() {
    return view.title;
  }
  function getView() {
    return view;
  }
  // called by portal.js for changing views
  function initializeView() {
    try {
      if (!portal.isDomReady()) {
        return setTimeout(function () {
          initializeView();
        }, 10);
      }
      // remove all prior added view elems
      $('[removable="true"]').remove();
      $("#table-caption").hide();
      $("#table-caption").text("");
      errors.clear();
      // set title
      // $('#view-title').text(view.title);
      // $('#subtitle-text').text(view.subtitle);
      // $('#export-button').attr('disabled', true);
      showHideIds(null, view.showableIds);
      // get user settings
      // TODO initialize data within namespaces
      getInitialData();
      if (view.initializeFunctions) {
        for (let i = 0; i < view.initializeFunctions.length; i++) {
          initializeFunctions[view.initializeFunctions[i]]();
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // set view information for current view
  function setView(path) {
    view = views[path];
    viewPath = path;
  }

  // show only elements the current view needs
  function showHideIds(dataExists, showableIds, showIds) {
    try {
      let userRole = settings.role;
      showableIds = showableIds || defaultShowableIds;
      let show, i;
      showIds = showIds || view.showIds;
      // for each showable id
      for (i = 0; i < showableIds.length; i++) {
        // default to hide
        show = false;
        let showableData = showableIds[i];
        if (showableData.requiresSearchResults && !dataExists) {
          $("#" + showableData.id).hide();
          continue;
        }
        // if this view uses the id
        if (showIds && showIds.indexOf(showableData.id) !== -1) {
          // if there are special roles for this view
          if (showableData.viewRoles && showableData.viewRoles[view.title]) {
            // if this role is allowed for this view
            if (showableData.viewRoles[view.title].indexOf(userRole) !== -1) {
              show = true;
            }
            // if view role is not specified use default roles
          } else if (showableData.roles) {
            if (showableData.roles.indexOf(userRole) !== -1) {
              show = true;
            }
            // if roles are not specified show to anyone
          } else {
            show = true;
          }
        }
        // show or hide elements in dom
        if (show) {
          $("#" + showableData.id).show();
        } else {
          $("#" + showableData.id).hide();
        }
      }
      // for each showId not in showable ids
      if (showIds) {
        for (i = 0; i < showIds.length; i++) {
          let showableId = showIds[i];
          show = true;
          for (let j = 0; j < showableIds.length; j++) {
            if (showableIds[j].id === showableId) {
              show = false;
              break;
            }
          }
          if (show) {
            $("#" + showableId).show();
          }
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // show a modal
  function showModal(event, modalName, tableData, origRowNum, crudType) {
    try {
      event.preventDefault();
      errors.clear();
      if (!tableData) {
        tableData = table;
      }
      let errorMsgId = table.errorMsgId;
      let opts = {
        rowIndex: origRowNum,
        crudType: crudType,
        tableData: tableData,
      };
      let selectedRows = [];
      let checkedRows;
      // erase saved selected instances
      selectedInstancesInfo = null;
      // set new selected instances if required, crons modal does not use pre-selected instances
      // TODO remove 'Crons view check' ? ******************************
      // TODO instance code should be in aws namespace ? ******************************
      if (
        modals[modalName] &&
        modals[modalName].requiresInstances &&
        view.title !== "Crons"
      ) {
        // if a row was passed in
        if (origRowNum || origRowNum === 0) {
          // get correct row
          row = getRowFromOriginalOrder(origRowNum);
          if (!row) {
            return errors.handleError(
              "There was a problem finding the selected instances.",
              errorMsgId
            );
          }
          selectedRows = [row];
        } else {
          checkedRows = getCheckedRows();
          for (i = 0; i < checkedRows.length; i++) {
            selectedRows.push(getRowFromOriginalOrder(checkedRows[i]));
          }
        }
        selectedInstancesInfo = aws.getInstanceInfoFromRows(
          selectedRows,
          tableData
        );
        if (!selectedInstancesInfo || !selectedInstancesInfo.length) {
          return errors.handleError(
            "Please make a selection by clicking the checkboxes and try again.",
            tables.getLastTable().errorMsgId || errorMsgId
          );
        }
        let selectedInstancesIds = _.map(selectedInstancesInfo, function (
          instInfo
        ) {
          return instInfo.identifier;
        });
        // add instance list
        let ulElement = $("#" + modalName + "-instance-ids-ul");
        let ulElementInnerHTML = "";
        for (let j = 0; j < selectedInstancesIds.length; j++) {
          ulElementInnerHTML += "<li>" + selectedInstancesIds[j] + "</li>";
        }
        ulElement.html(ulElementInnerHTML);
        ulElement.show();
      }
      if (modals[modalName] && modals[modalName].requiresRows) {
        selectedRows = getSelectedRows();
        if (!selectedRows || !selectedRows.length) {
          return errors.handleError(
            "Please make a selection by clicking the checkboxes and try again.",
            errorMsgId
          );
        }
      }
      // pass table data to the modals setup function
      if (modals[modalName] && modals[modalName].setupFn) {
        modals[modalName].setupFn(tableData, opts);
      }
      // show the modal
      $("#" + modalName).modal("show");
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // enable or disable search button when searching for table data
  function updateSearchButton(isSearching, id, text) {
    try {
      id = id || "search-button";
      let searchButton = $("#" + id);
      if (isSearching) {
        text = text || "Searching...";
        searchButton.prop("disabled", true);
        searchButton.text(text);
      } else {
        text = text || "Search";
        searchButton.prop("disabled", false);
        searchButton.text(text);
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // delete selection from db
  function deleteSelection(event, origRow) {
    try {
      event.preventDefault();

      let i;
      // get correct rows
      if (origRow || origRow == 0) {
        selectedRows = [getRowFromOriginalOrder(origRow)];
      } else {
        selectedRows = getSelectedRows();
      }

      if (!selectedRows || !selectedRows.length) {
        return errors.handleError(
          "Please make a selection by clicking the checkboxes and try again.",
          errorMsgId
        );
      }

      let confirmation = confirm(
        "Are you sure you want to delete the selected item/s"
      );
      if (!confirmation) {
        return;
      }

      // turn off the crons to delete, ignore errors
      if (view.title === "Crons") {
        crons.startStopCrons(event, "stop", selectedRows, true, null);
      }
      let opts = {
        _ids: [],
        type: tables.getLastTable().type,
      };
      // get the ids for the selected rows
      selectedRows.forEach(function (item) {
        opts._ids.push(item.pristineRow._id);
      });
      // send the request
      $.post("/api/data/remove/ids", opts)
        .done(function (data) {
          if (data.error) {
            let table = tables.getLastTable();
            return errors.handleError(data.error, table.errorMsgId);
          }
          // TODO initialize data within namespaces
          getInitialData();
        })
        .fail(function (err) {
          errors.handleError(err, errorMsgId);
        });
      return;
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  // make functions and data public
  return {
    attachImport: attachImport,
    buildTable: buildTable,
    deleteSelection: deleteSelection,
    exportToCSV: exportToCSV,
    getCheckedRows: getCheckedRows,
    getRowFromOriginalOrder: getRowFromOriginalOrder,
    getSelectedInstancesInfo: getSelectedInstancesInfo,
    getSelectedRows: getSelectedRows,
    getTitle: getTitle,
    getView: getView,
    initializeView: initializeView,
    namespaces: {},
    onSelectionsChanged: onSelectionsChanged,
    setView: setView,
    showModal: showModal,
    updateSearchButton: updateSearchButton,
    views: views,
  };
})();
