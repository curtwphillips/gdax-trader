let live = (function () {
  /*
BUILDING A STANDARD TABLE
let  tableData = _.extend({}, defaultTableData, reports[report].tableData);
tableData.rowData = data;
let  role = auth.getUserSettings().role;
if (role === 'Admin' || role === 'Manager') {
  tableData.checkable = true;
}
pages.buildTable(tableData);
*/

  let viewConfig = {
    columnOrder: ["hostname", "time"],
    notRemovable: true,
    keysToIds: true,
    checkable: false,
    noFilters: true,
  };
  let tableOrder = [
    // display order on live.html
    "os",
    "general",
    "btc",
    "ltc",
    "switches",
    "delays",
    "thresholds",
  ];
  let errorMsgId = "live-error-msg";
  let fullData = {};
  let tableMade = {};
  let hostOrder = []; // fill with hostnames
  let notReady = true; // init hasn't run
  let cbTracker = {}; // keep track of checkboxes
  let userSettings = {};

  function init() {
    $("#no-data-div").show();
    notReady = false;
  }

  let defaultTableData = {
    title: "",
    caption: "results",

    errorMsgId: errorMsgId,
    // showableIds: showableIds,
    // showIds: showIds,
    checkable: false, // show checkboxes
    tableId: "live-table",
    sortRebuild: true,
    tableContainerId: "live-table-container",
    captionId: "live-table-caption",
    headerId: "live-table-header-tr",
    filterId: "live-table-filters-tr",
    rowsId: "live-table-tbody",
    allCheckedId: "live-all-checked-checkbox",
    exportButtonId: "live-export-button",
    headerConversions: {
      // replace key with value in headers list
      Tags: "live Tags",
      dayOfWeek: "Days",
      Bytes: "GB",
    },
    columnWidths: {
      time: "120px",
    },
    ignoreColumns: [],
    columnOrder: [],
    nowrapColumns: [],
  };

  function cbChanged(dataOwner) {
    let cb = document.getElementById("live-" + dataOwner + "-checkbox");
    if (cb && cbTracker[dataOwner] && !cb.checked) {
      // unchecked
      cbTracker[dataOwner] = false;
      delete fullData[dataOwner];
      $('[hostname="' + dataOwner + '"]').hide();
      return;
    } else if (cb && !cb.checked) {
      delete fullData[dataOwner];
      return; // skip this host
    } else if (cb && !cbTracker[dataOwner] && cb.checked) {
      delete fullData[dataOwner];
      cbTracker[dataOwner] = true;
      $('[hostname="' + dataOwner + '"]').show();
    }
  }

  function receive(data, noRedo) {
    try {
      let dataEdit;
      data.original.actual.type = "original actual";
      data.current.actual.type = "current actual";
      data.original.conversions.BTC.type = "original converted to BTC";
      data.current.holding.BTC.type = "current holding converted to BTC";
      data.current.conversions.BTC.type = "current converted to BTC";
      data.original.conversions.ETH.type = "original converted to ETH";
      data.current.holding.ETH.type = "current holding converted to ETH";
      data.current.conversions.ETH.type = "current converted to ETH";
      data.original.conversions.LTC.type = "original converted to LTC";
      data.current.holding.LTC.type = "current holding converted to LTC";
      data.current.conversions.LTC.type = "current converted to LTC";
      data.original.conversions.USD.type = "original converted to USD";
      data.current.holding.USD.type = "current holding converted to USD";
      data.current.conversions.USD.type = "current converted to USD";

      dataEdit = [
        data.original.actual,
        data.current.actual,
        data.original.conversions.BTC,
        data.current.holding.BTC,
        data.current.conversions.BTC,
        data.original.conversions.ETH,
        data.current.holding.ETH,
        data.current.conversions.ETH,
        data.original.conversions.LTC,
        data.current.holding.LTC,
        data.current.conversions.LTC,
        data.original.conversions.USD,
        data.current.holding.USD,
        data.current.conversions.USD,
      ];

      makeTable("Holdings", data, "host", dataEdit);

      return;
      data = { holdings: dataEdit };
      dataOwner = "home";
      if (notReady) return;
      if (pages.getTitle() !== "live") return;
      let freezeCheckbox = document.getElementById("live-frozen-checkbox");
      if (freezeCheckbox && freezeCheckbox.checked) return; // updating turned off
      let rowData;
      let make = []; // holds tableNames that do not exist yet
      for (let tableName in data) {
        // make key available for comparison
        let tableExists = document.getElementById(
          "live-" + tableName + "-table"
        );
        if (!tableExists) make.push(tableName);
        let rowExists = false;
        for (let k in data[tableName]) {
          // data[tableName][k] = tables.replaceChars(data[tableName][k], errorMsgId);
          data[tableName][k] = JSON.stringify(data[tableName][k]);
          if (tableExists) {
            let colElem = $(
              "#live-" + tableName + '-table th[header-text="' + k + '"]'
            );
            let headerText = colElem.attr("header-text");
            if (!headerText) {
              // create the column
              if (k !== "hostname") {
                tables.buildCol("live-" + tableName, k);
              }
            }
            let rowElem = $(
              "#live-" +
                tableName +
                '-table-tbody tr[hostname="' +
                dataOwner +
                '"]'
            );
            // let  rowElem = $('#live-'+tableName+'-table-tbody');
            if (rowElem) {
              let rowNum = rowElem.attr("row-num");
              if (rowNum) {
                rowExists = true;
                let elem = $(
                  "#live-" + tableName + "-table-tbody #row-" + rowNum + "-" + k
                );
                if (elem) {
                  let elemText = elem.text();
                  let updateText = data[tableName][k]; // update value in table
                  if (elemText != updateText) {
                    elem.text(updateText);
                  }
                }
              }
            }
          }
        }
        if (tableExists && !rowExists) {
          console.log("rowExists: " + rowExists);
          let rowNum = null;
          // function buildRow (table, rowNum, rowData, tbodyElem) {
          tables.buildRow(
            "live-" + tableName,
            rowNum,
            { pristineRow: data[tableName] },
            null,
            dataOwner
          );
        }
      }
      if (make.length > 0) {
        let orderedTables = [];
        for (let i = 0; i < tableOrder.length; i++) {
          // get ordered columns
          let index = make.indexOf(tableOrder[i]);
          if (index !== -1) {
            orderedTables.push(tableOrder[i]); // add column to ordered list
            make.splice(index, 1); // remove the column from original list
          }
        }
        for (let i = 0; i < make.length; i++) {
          // get unordered columns
          orderedTables.push(make[i]);
        }
        for (let i = 0; i < orderedTables.length; i++) {
          // make tables
          makeTable(orderedTables[i], data, dataOwner, rowData);
        }
      }
    } catch (error) {
      console.log("error: " + error.stack);
      errors.handleError(error, errorMsgId);
    }
  }

  function makeTable(tableName, data, hostname, rowData) {
    try {
      // if (!data[tableName]) return;
      let appendElem = document.getElementById("live-tables-container");
      let rowData = rowData || [data[tableName]];
      // console.log('rowData: ' + JSON.stringify(rowData));
      tableInfo = {
        title: "live-" + tableName,
        errorMsgId: errorMsgId,
        store: true, // keep a copy of the data around
        rowData: rowData,
        caption: tableName,
        noFilters: true,
        notSortable: true,
        tableContainerId: "live-" + tableName + "-table-container",
        tableId: "live-" + tableName + "-table",
        captionId: "live-" + tableName + "-table-caption",
        headerId: "live-" + tableName + "-table-header-tr",
        rowsId: "live-" + tableName + "-table-tbody",
        filterId: "live-" + tableName + "-table-filters-tr",
        keysToIds: true,
        columnOrder: [
          "hostname",
          "id",
          "type",
          "lastStarted",
          "lastCompleted",
          "time",
          "inProgress",
          "lastPrice",
          "price",
          "lastOrderDate",
          "allTimeHigh",
          "increment",
          "precision",
          "useSize",
        ],
        removeColumns: ["hostname"],
        columnWidths: {
          started: "100px",
          time: "100px",
        },
        htmlProperties: ["hostname"], // hostname row element property set in html
        htmlValues: {
          hostname: hostname,
        },
      };
      if (!$("#live-" + tableName + "-table-container").length) {
        // build the base html if not exists
        let container = document.createElement("div");
        container.id = "live-" + tableName + "-table-container";
        tableInfo.tableContainerId = "live-" + tableName + "-table-container";
        tableInfo.title = "live-" + tableName;
        appendElem.appendChild(container);
      }
      pages.buildTable(tableInfo); // fill in the table
      $("#no-data-div").hide();
    } catch (error) {
      console.log("error: " + error);
      errors.handleError(error, errorMsgId);
    }
  }

  pages.namespaces.live = {
    init: init,
    cbChanged: cbChanged,
    receive: receive,
    viewConfig: viewConfig,
  };
  return pages.namespaces.live;
})();
