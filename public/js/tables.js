var tables = (function () {
  var file = '\ntables.js '; // used for logging
  var dayNames = ['Sun', ' Mon', ' Tues', ' Wed', ' Thur', ' Fri', ' Sat'];
  var lastTable; // tracks the most recently setup table
  var found = false;
  var madeTables = {};
  // headers added by us
  var bpTagsHeader = 'BP Tags';
  var bpNotesHeader = 'BP Notes';
  var startStopHeader = 'Start/Stop';

  var tableIsRendering = false;

  function getLastTable () {
    return lastTable;
  }

  function create (table) {
    try {
      if (!table || !table.rows || !table.rows[0]) return table;
      if (!table.filters) table.filters = [];
      if (!table.checkedList) table.checkedList = [];
      if (table.searchButtonId) {
        document.getElementById(table.searchButtonId).innerText = 'Rendering...';
      }
      table.allowStartStop = enableStartStopTable(table);
      addTagsNotesColumns(table);
      setHeaders(table);
      setRows(table);
      lastTable = table;
      if (table.preFilters) {
        filterColumns(table.preFilters);
      } else {
        buildTable(table);
      }
      if (table.store) {
        madeTables[table.title] = table;
      }
      return table;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function setHeaders (table) {
    try {
      var columnOrder = table.columnOrder;
      var headers = [];
      var rows = table.rows; // { pristineRow: [...] }
      var i, j, header, row;
      // Go through each row and save keys as headers
      for (i = 0; i < rows.length; i++) {
        row = rows[i];
        for (var key in row.pristineRow) {
          if (headers.indexOf(key) === -1 && (!table.removeColumns || table.removeColumns.indexOf(key) === -1)) {
              headers.push(key);
          }
        }
      };
      // sort the headers into their display order
      if (columnOrder) {
        var sortedHeaders = [];
        for (i = 0; i < columnOrder.length; i++) {
          var columnName = columnOrder[i];
            // if the header exists
            if (headers.indexOf(columnName) > -1) {
              // add it to sorted headers in order
              sortedHeaders.push(columnName);
            }
        };
        // put remaining headers into the list
        for (i = 0; i < headers.length; i++) {
          header = headers[i];
          // if the header exists and was not in the columnOrder list
          if (sortedHeaders.indexOf(header) === -1) {
            // add it to the end of the sorted headers
            sortedHeaders.push(header);
          }
        };
        headers = sortedHeaders;
      }
      // some rows won't have all headers, set missing headers to be blank
      for (i = 0; i < rows.length; i++) {
        row = rows[i];
        for (j = 0; j < headers.length; j++) {
          header = headers[j];
          // convert values
          if (row.pristineRow[header] && table.convertColumns && table.convertColumns[header]) {
            row.pristineRow[header] = utility[table.convertColumns[header]](row.pristineRow[header]);
          } else {
            row.pristineRow[header] = row.pristineRow[header] || '';
          }
        };
      };

      // each header gets a filter

      for (i = 0; i < headers.length; i++) {
        header = headers[i];
        table.filters.push('');
      };
      table.headers = headers;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function allCheckedClicked (event, table) {
    try {
      var i, row;
      if (event.target.checked) {
        for (i = 0; i < table.rows.length; i++) {
          row = table.rows[i];
          if (row.filteredOut === true) {
            row.checked = false;
            setChecked(table, i, false);
          }else {
            row.checked = true;
            setChecked(table, i, true);
          }
        };
      }else {
        for (i = 0; i < table.rows.length; i++) {
          row = table.rows[i];
          row.checked = false;
        };
        table.checkedList = [];
      }
      for (var i = 0; i < table.rows.length; i++) {
        if (table.rows[i].checked) {
          document.getElementById(table.title + '-checkbox-' + i).setAttribute('checked', true);
          // $("[id='"+table.title + '-checkbox-' + i).prop('checked', true);
        } else {
          document.getElementById(table.title + '-checkbox-' + i).setAttribute('checked', false);
          // $("[id='"+table.title + '-checkbox-' + i).prop('checked', false);
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function setRow (table, i) {
    try {
      var tagIncludeKeys = ['Name', 'Description'];
      var j, k, row, header;
      var headers = table.headers;
      row = table.rows[i];
      row.filteredCells = [];
      row.tableRow = {};
      // set text used for sorting
      row.text = {};
      // set start/stop values, double check for valid instance id
      var hasInstanceId = false;
      if (row.pristineRow && row.pristineRow.InstanceId && row.pristineRow.InstanceId.length > 3) {
        hasInstanceId = true;
      }

      if (row.pristineRow.State && table.allowStartStop && hasInstanceId) {
        row.allowStartStop = enableStartStopRow (table, i);
        if (row.allowStartStop) {
          row.tableRow[startStopHeader] = row.pristineRow.State.Name === 'running' ? 'Stop' : 'Start';
          row.text[startStopHeader] = row.tableRow[startStopHeader];
          // used to decide whether to add a column for start/stop
          addedStartStopColumn = true;
        }
      }
// EACH HEADER
      for (j = 0; j < headers.length; j++) {
        header = headers[j];
        // default to unfiltered
        row.filteredCells.push(false);
        // only show name in the AWS Tags column
        if (header === 'Tags') {
          row.tableRow.Tags = [];
          for (k = 0; k < tagIncludeKeys.length; k++) {
            tagIncludeKeysFound = null;
            tagIncludeKeysFound = _.findWhere(row.pristineRow.Tags, {Key: tagIncludeKeys[k]});
            if (tagIncludeKeysFound) {
              row.tableRow.Tags.push(tagIncludeKeysFound.Value);
            }
          }
        } else {
          if (table.dayColumns && table.dayColumns.indexOf(header) !== -1) {
            // convertOn = false;
            row.tableRow[header] = row.pristineRow[header].map(function (dayNum) {
              return dayNames[dayNum];
            });
          }
          // combine columns
          if (table.combineColumns && table.combineColumns[header]) {
            row.tableRow[header] = [row.pristineRow[header]];
            for (k = 0; k < table.combineColumns[header].length; k++) {
              if (row.pristineRow[table.combineColumns[header][k]]) {
                row.tableRow[header].push(row.pristineRow[table.combineColumns[header][k]]);
              }
            };
          }

          if (table.timeColumns && table.timeColumns.indexOf(header) !== -1) {
            row.tableRow[header] = formatTimeColumns(row.pristineRow[header]);
          }
          // combine nested objects into flat array
          if (!table.skipFlattening || table.skipFlattening.indexOf(header) === -1) {
            row.tableRow[header] = getNewRowValue(table, row, header);
          } else {
            row.tableRow[header] = JSON.stringify(row.pristineRow[header]);
          }
          if (table.numericColumns && table.numericColumns.indexOf(header) > -1 && table.useRoundNumbers) {
            row.tableRow[header] = utility.prettyNumber(row.tableRow[header]);
          }
          // get rid of extra JSON characters
          if (header !== bpTagsHeader && header!== bpNotesHeader && typeof row.tableRow[header] === 'string') {
            if (!table.noReplaceChars) {
              row.tableRow[header] = replaceChars(row.tableRow[header], table.errorMsgId);
            }
          }
          if (table.formatDateColumns && table.formatDateColumns.indexOf(header) !== -1) {
            row.tableRow[header] = utility.getTime(new Date(row.tableRow[header]), true);
          }
        }
        // text value for sorting
        row.text[header] = row.tableRow[header].toString().toLowerCase();
      };
      if (table.tags) {
        var tagsColumn = bpTagsHeader;
        row.tableRow[tagsColumn] = [];
        for (j = 0; j < table.tags.length; j++) {
          var tag = table.tags[j];
          for (k = 0; k < tag.usedBy.length; k++) {
            var usedBy = tag.usedBy[k];
            if (usedBy.kind === table.title && usedBy.identifier === row.pristineRow[table.identifier]) {
              row.tableRow[tagsColumn].push(tag.text);
              if (!row.text[tagsColumn]) {
                row.text[tagsColumn] = '';
              }
              row.text[tagsColumn] += tag.text + ',';
            }
          };
        };
      }
      if (table.notes) {
        var notesColumn = bpNotesHeader;
        row.tableRow[notesColumn] = [];
        var associationColumn = table.identifier;
        for (j = 0; j < table.notes.length; j++) {
          var note = table.notes[j];
          if (note.kind === table.title && note.identifier === row.pristineRow[associationColumn]) {
            if (!row.text[notesColumn]) {
              row.text[notesColumn] = '';
            }
            row.text[notesColumn] += note.text;
          }
        };
      }
      var regionColumn = 'Region';
      if (table.headers.indexOf(regionColumn) !== -1) {
        if (Array.isArray(row.tableRow[regionColumn])) {
          row.tableRow[regionColumn] = row.tableRow[regionColumn][0].trim();
        } else {
          row.tableRow[regionColumn] = row.tableRow[regionColumn].trim();
        }
      }
      // add the initial order to each row, when rows are sorted use this to match with other arrays
      row.originalSortOrder = i;
      // this order does not change, matches row attributes and id names even after sorting
      row.originalOrder = i;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function setRows (table) {
    try {
      for (var i = 0; i < table.rows.length; i++) {
        setRow(table, i);
      }
      if (table.rows[0].allowStartStop) { // add the Start/Stop header
        table.headers.unshift(startStopHeader);
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function formatTimeColumns (timeData) {
    try {
      if (!timeData.hour || !timeData.minute) {
        return timeData;
      }
      var ampm = 'am';
      var hour = timeData.hour;
      if (hour > 12) {
        hour = hour - 12;
        ampm = 'pm';
      }
      var minute = timeData.minute.toString();
      if (minute.length === 1) {
        minute = '0' + minute;
      }
      return hour + ':' + minute + ' ' + ampm;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function getNewRowValue(table, row, header) {
    try {
      var i;
      var newValue = [];
      var spacer = '---------';
      var keyConversions;
      if (table.keyConversions && table.keyConversions[header]) {
        keyConversions = table.keyConversions[header];
      }
      var columnData = row.tableRow[header] ? row.tableRow[header] : row.pristineRow[header];
      newValue = objToArray(keyConversions, columnData);

      if (Array.isArray(newValue)) {
        if (newValue[newValue.length - 1] === spacer) {
          newValue.pop();
        }
        for (i = 0; i < newValue.length; i++) {
          if (!table.noReplaceChars) {
            newValue[i] = replaceChars(newValue[i], table.errorMsgId);
          } else {
            newValue[i] = newValue[i];
          }
        };
      }

      return newValue;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function objToArray(keyConversions, obj) {
    try{
      var i;
      var newValue = [];
      var convertedKey;
      var that = this;
      if (Array.isArray(obj)) {
        for (i = 0; i < obj.length; i++) {
          newValue.push(objToArray(keyConversions, obj[i]));
        };
      }else if (_.isObject(obj)) {
        for (var key in obj) {
          if (keyConversions && (keyConversions[key] || keyConversions[key] === '')) {
            convertedKey = keyConversions[key];
          } else {
            convertedKey = key;
          }
          if (convertedKey !== '') {
            if (_.isObject(obj[key] || Array.isArray(obj[key]))) {
              newValue.push(objToArray(keyConversions, obj[key]));
            } else {
              newValue.push(convertedKey + ': ' + JSON.stringify(obj[key]));
            }
          }
        }
      } else {
          newValue.push(obj);
      }
      return _.flatten(newValue);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

// *********************************************
// todo: verify no replace chars will be needed and remove if so
// *********************************************
  function replaceChars(text, errorMsgId) {
    try {
      if (!text && text !== 0) return text;
      text = JSON.stringify(text);
      text = text.replace(/"/g,'');
      text = text.replace(/{/g,'');
      text = text.replace(/}/g,'');
      text = text.replace(/\[/g,'');
      text = text.replace(/\]/g,'');
      text = text.replace(/\\/g,' ');
      if (text == 0) text = "0";
      return text;
    } catch (error) {
      console.log(error);
      errors.handleError(error, errorMsgId);
    }
  }

  /**
   * adds tags and/or notes properties to the first row so that the table
   * has a column for tags and/or notes
   *
   * @param table {} of table data
   */
  function addTagsNotesColumns(table) {
    try {
      // if table does not need tags or notes, stop
      if (!table.showTagsNotes || (!table.showTagsNotes.tags && !table.showTagsNotes.notes)) {
        return;
      }
      // rows to check
      var rows = table.rows;
      // requirements for showing tags and notes columns
      var reqs = table.showTagsNotesRequirements;
      if (reqs) {
        var show = true;
        for (var key in table.showTagsNotesRequirements) {
          if (show && table.showTagsNotesRequirements.hasOwnProperty(key)) {
            if (Array.isArray(reqs[key])) {
              if (reqs[key].indexOf(table[key]) === -1) {
                show = false;
              }
            } else if (table[key] !== reqs[key]) {
              show = false;
            }
          }
        }
        if (show) {
          // add a column for tags and notes if view uses them
          if (table.showTagsNotes.tags) {
            rows[0].pristineRow[bpTagsHeader] = '';
          }
          if (table.showTagsNotes.notes) {
            rows[0].pristineRow[bpNotesHeader] = '';
          }
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function exportToCSV(csvTitle) {
    try {
      var i, j, row, cell;
      var table = getLastTable();
      if (!table || !table.headers || !table.headers.length) {
        return;
      }
      var csvContent = '';

      for (i = 0; i < table.headers.length; i++) {
        csvContent += table.headers[i].replace(/,/g,';') + ',';
      };
      csvContent += '\n';
      for (i = 0; i < table.rows.length; i++) {
        row = table.rows[i];
        if (!row.filteredOut) {
          if (Array.isArray(row.tableRow)) {
            for (k = 0; k < row.tableRow.length; k++) {
              cell = row.tableRow[k];
              if (Array.isArray(cell)) {
                var csvData = cell.join('; ');
                csvContent += csvData.replace(/,/g,';') + ',';
              } else {
                csvContent += JSON.stringify(cell).replace(/,/g,';') + ',';
              }
            };
          } else {
            for (k in row.tableRow) {
              cell = row.tableRow[k];
              if (Array.isArray(cell)) {
                var csvData = cell.join('; ');
                csvContent += csvData.replace(/,/g,';') + ',';
              } else {
                csvContent += JSON.stringify(cell).replace(/,/g,';') + ',';
              }
            };
          }
          csvContent += '\n';
        }
      };
      var filename = 'Portal-'+csvTitle.replace(/ /g,'')+'.csv'; //gen a filename using the csvTitle without spaces
      var blob = new Blob([csvContent], { 'type': 'text/csv;charset=utf-8;' });
      if (navigator.msSaveBlob) { // IE 10+
        navigator.msSaveBlob(blob, filename);
      } else {
        //create a link and click it
        var link = document.createElement('a');
        if (link.download !== undefined) {
          // Browsers that support HTML5 download attribute
          var url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function sortRebuild (table, colNum) {
    try {
      var i, j, k, l, index, moveTo;
      var dataLen = table.rows.length;
      // sort the rows into the expected order
      if (colNum === table.lastSortColumn) { // reversing last search
        table.lastSortAsc = !table.lastSortAsc;
        table.rows = reverseOrder(table.rows);
      } else {
        table.lastSortColumn = colNum; // zero based, -1 default
        table.lastSortAsc = true;
        var isNumeric;
        if (table.numericColumns) {
          isNumeric = table.numericColumns.indexOf(table.headers[colNum]) > -1;
        }
        table.rows = mergeSort(table.rows, colNum, isNumeric);
      }
      buildTable(table);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
      tableIsRendering = false;
      headerElem.removeClass('green');
      headerElem.text(table.headers[colNum]);
    }
  }

  function sortBy (table, colNum) {
    try {
      if (tableIsRendering) {
        return;
      }
      tableIsRendering = true;
      // mark column as sorting class
      var headerElem = $('#'+table.title + '-headers-' + colNum + ' div');
      headerElem.addClass('green');
      headerElem.text('Sorting by ' + table.headers[colNum] + '...');

      var i, j, k, l, index, moveTo;
      var dataLen = table.rows.length;
      // sort the rows into the expected order
      if (colNum === table.lastSortColumn) { // reversing last search
        table.lastSortAsc = !table.lastSortAsc;
        table.rows = reverseOrder(table.rows);
      } else {
        table.lastSortColumn = colNum; // zero based, -1 default
        table.lastSortAsc = true;
        var isNumeric;
        if (table.numericColumns) {
          isNumeric = table.numericColumns.indexOf(table.headers[colNum]) > -1;
        }
        table.rows = mergeSort(table.rows, colNum, isNumeric);
      }

      buildTable(table);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
      tableIsRendering = false;
      headerElem.removeClass('green');
      headerElem.text(table.headers[colNum]);
    }
  }

  function mergeSort (items, col, isNumeric){
    try {
      if (items.length < 2) {
        return items;
      }

      var work = [], i, len;

      for (i=0, len=items.length; i < len; i++){
        work.push([items[i]]);
      }

      work.push([]);  //in case of odd number of items

      for (var lim=len; lim > 1; lim = Math.floor((lim+1)/2)){
        for (var j=0,k=0; k < lim; j++, k+=2){
          work[j] = merge(work[k], work[k+1], col, isNumeric);
        }
        work[j] = [];  //in case of odd number of items
      }
      return work[0];
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function merge (left, right, col, isNumeric) {
    try {
      var result  = [];
      var table = getLastTable();
      while (left.length > 0 && right.length > 0) {
        if (isNumeric) {
          if (Number(left[0].text[table.headers[col]].replace(',', '')) <= Number(right[0].text[table.headers[col]].replace(',', ''))) {
            result.push(left.shift());
          } else {
            result.push(right.shift());
          }
        } else {
          if (left[0].text[table.headers[col]] <= right[0].text[table.headers[col]]){
            result.push(left.shift());
          } else {
            result.push(right.shift());
          }
        }
      }
      result = result.concat(left).concat(right);
      //make sure remaining arrays are empty
      left.splice(0, left.length);
      right.splice(0, right.length);
      return result;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function reverseOrder (arr) {
    try {
      var result = [];
      var len = arr.length;
      for (var i = len - 1; i !== -1; i--) {
        result.push(arr[i]);
      }
      return result;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function setFilterEvent (table, elem, i) {
    try {
      elem.oninput = utility.debounce(function (e) {
        filterBy(table, i);
      }, 400, false);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function addStartStopClickEvent (elem, table, i) {
    try {
      elem.addEventListener('click', function (event) {
        if (event) {
          event.preventDefault();
        }
        var startOrStop = $(event.target).text();
        aws.startStopInstances(event, startOrStop, table, i);
      });
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function buildTable (table) {
    try {
      if (table.limitRowsInputId) {
        table.limitRowsAmount = document.getElementById(table.limitRowsInputId).value;
        if (table.limitRowsAmount < 1) {
          table.limitRowsAmount = table.rows.length;
        }
      } else {
        table.limitRowsAmount = table.rows.length;
      }
      tableIsRendering = true;
      var i, j, k, elem, elem1, elem2, elem3, elem4, innerHTML, className;
      var title = table.title;
      table.rowCount = table.rows.length;
      table.unfilteredCount = table.rows.length;
      var tableContainer = document.getElementById(table.tableContainerId);
      var tableElem = document.createElement('table');
      tableElem.id = table.title + '-table';
      tableElem.className = 'table table-striped';
      var captionElem = document.createElement('caption');
      captionElem.id = table.title + '-table-caption';
      captionElem.className = 'table-caption';
      captionElem.setAttribute('search-removable', true);
      var theadElem = document.createElement('thead');
      var theadTrElem = document.createElement('tr');
      theadTrElem.id = table.title + '-table-header-tr';
      var tbodyElem = document.createElement('tbody');
      tbodyElem.id = table.title + '-table-tbody';
      var tbodyTrElem = document.createElement('tr');
      tbodyTrElem.id = table.title + '-table-filters-tr';

      tableElem.appendChild(captionElem);
      tableElem.appendChild(theadElem);
      theadElem.appendChild(theadTrElem);
      tableElem.appendChild(tbodyElem);
      tbodyElem.appendChild(tbodyTrElem);

// HEADER ROW CHECKBOX
      // create the checkbox cell
      if (table.checkable) {
        elem = document.createElement('th');
        elem.className = 'checkColumn';
        elem1 = document.createElement('input');
        if (!table.notRemovable) {
          elem.setAttribute('removable', true);
          elem.setAttribute('search-removable', true);
        }
        elem1.setAttribute('type', 'checkbox');
        elem1.setAttribute('id', table.allCheckedId.substring(1));
        elem1.addEventListener('click', function (event) {
          allCheckedClicked(event, table);
        });
        theadTrElem.appendChild(elem);
        elem.appendChild(elem1);
      }
// HEADER ROW EDIT
      if (table.editColumn) {
        // create the empty cell
        elem = document.createElement('th');
        elem.className = 'nowrap';
        if (!table.notRemovable) {
          elem.setAttribute('removable', true);
          elem.setAttribute('search-removable', true);
        }
        elem1 = document.createElement('div');
        elem1.textContent = 'Edit';
        elem.append(elem1);
        if (table.columnWidths && table.columnWidths.Edit) {
          elem1.style.width = table.columnWidths.Edit;
        }
        theadTrElem.appendChild(elem);
      }
// HEADERS
      // create the headers
      for (i = 0; i < table.headers.length; i++) {
        elem = document.createElement('th');
        elem.id = table.title + '-headers-' + i;
        elem.className = 'nowrap';
        if (!table.notRemovable) {
          elem.setAttribute('removable', true);
          elem.setAttribute('search-removable', true);
        }
        if (!table.notSortable) {
          addSortListener(elem, i, table);
        }
        elem1 = document.createElement('div');
        var headerText = '';
        if (table.headerConversions && table.headerConversions[table.headers[i]]) {
          headerText = table.headerConversions[table.headers[i]];
          elem1.textContent = headerText;
        } else {
          headerText = table.headers[i];
          elem1.textContent = headerText;
        }
        elem.setAttribute('header-text', headerText);
        if (table.columnWidths && table.columnWidths[table.headers[i]]) {
          elem1.style.width = table.columnWidths[table.headers[i]];
        }
        elem.appendChild(elem1);
        theadTrElem.appendChild(elem);
      }

      // create the filters
      if (!table.noFilters) {
        var filtersTr = $('#'+table.filterId);
  // FILTER CHECKBOX SLOT
        if (table.checkable) {
          // create the empty cell
          elem = document.createElement('td');
          elem.className = 'checkColumn';
          if (!table.notRemovable) {
            elem.setAttribute('removable', true);
            elem.setAttribute('search-removable', true);
          }
          tbodyTrElem.appendChild(elem);
        }
  // FILTER EDIT COLUMN SLOT
        if (table.editColumn) {
          // create the empty cell
          elem = document.createElement('td');
          if (!table.notRemovable) {
            elem.setAttribute('removable', true);
            elem.setAttribute('search-removable', true);
          }
          tbodyTrElem.appendChild(elem);
        }
  // FILTERS
        for (i = 0; i < table.headers.length; i++) {
          elem = document.createElement('td');
          elem1 = document.createElement('div');
          if (!table.notRemovable) {
            elem.setAttribute('removable', true);
            elem.setAttribute('search-removable', true);
          }
          elem2 = document.createElement('input');
          elem2.setAttribute('id', title + '-filter-' + i);
          if (!table.filterButtonId) {
            setFilterEvent(table, elem2, i);
          }
          // set text from previous entries
          if (table.filteredColumns && table.filteredColumns[i]) {
            elem2.value = table.filteredColumns[i];
          }
          tbodyTrElem.appendChild(elem);
          elem.appendChild(elem1);
          elem1.appendChild(elem2);
        }
        if (table.noFilters) {
          tbodyTrElem.style.display = 'none';
        }
      }

// TABLE BODY ROWS
      captionElem.className = 'table-caption green';
      // chunk updates so that page refresh still works
      var rowCount = table.rows.length;
      var divideInto = Math.ceil(rowCount / 4000);
      var chunkSize = Math.ceil(rowCount/divideInto);
      var iteration = 0;
      table.filteredCount = 0;
      table.visibleRows = 0;
      setTimeout(function buildRows () {
        var base = (chunkSize) * iteration;
        for (i = 0; i < chunkSize; i++) {
          var based_i = base+i;
          // stop if passing qty of rows in data
          if (based_i > table.rows.length - 1) {
            break;
          }
          // stop if reached user input limit
          if (table.limitRowsAmount && table.visibleRows >= table.limitRowsAmount) {
            break;
          }
          buildRow(table, based_i, table.rows[based_i], tbodyElem);
        }
        iteration++;
        if (iteration < divideInto) {
          setTimeout(buildRows, 0);
        } else {
      // TOTAL
          if (table.totalColumns) {
            setTotalColumns(table);
          }
      // CAPTION
          if (table.noFilters) {
            captionElem.textContent = table.caption;
          } else {
            captionElem.textContent = 'Showing ' + table.visibleRows.toLocaleString() + ' of ' + table.rows.length.toLocaleString() + ' ' + table.caption;
          }
          tableIsRendering = false;
          captionElem.className = 'table-caption';

          if (!table.leaveContainer) {
            while (tableContainer.firstChild) {
              tableContainer.removeChild(tableContainer.firstChild);
            }
          }

          tableContainer.appendChild(tableElem);
          // it takes less than a ms for each row to render
          if (table.searchButtonId) {
            setTimeout(function () {
              elem = document.getElementById(table.searchButtonId);
              elem.innerText = 'Search';
              elem.removeAttribute('disabled');
              document.getElementById(table.exportButtonId).removeAttribute('disabled');
            }, table.visibleRows / 3);
          }
          if (table.filterButtonId) {
            setTimeout(function () {
              var filterButtonElem = document.getElementById(table.filterButtonId);
              filterButtonElem.removeAttribute('disabled');
              filterButtonElem.innerText = 'Apply Filters';
            }, table.visibleRows / 3);
          }
          if (table.exportButtonId) {
            document.getElementById(table.exportButtonId).removeAttribute('disabled');
          }
        }
      }, 0);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
      tableIsRendering = false;
      captionElem.className('table-caption');
    }
  }

  function buildCol (table, colText) {
    try {
      if (utility.isString(table)) { // adding to pre-made table
        table = madeTables[table];
      }
      if (!table) {
        throw new Error('table ' + table + ' not found when adding ' + colText + ' column');
      }
      theadTrElem = document.getElementById(table.title + '-table-header-tr');
      if (!theadTrElem) {
        throw new Error('header row not found when adding ' + colText + ' column');
      }
      var colNum = table.headers.length;
      table.headers.push(colText);
      elem = document.createElement('th');
      elem.id = table.title + '-headers-' + colNum;
      elem.className = 'nowrap';
      if (!table.notRemovable) {
        elem.setAttribute('removable', true);
        elem.setAttribute('search-removable', true);
      }
      if (!table.notSortable) {
        addSortListener(elem, colNum, table);
      }
      elem1 = document.createElement('div');
      var headerText = '';
      if (table.headerConversions && table.headerConversions[table.headers[colNum]]) {
        headerText = table.headerConversions[table.headers[colNum]];
        elem1.textContent = headerText;
      } else {
        headerText = table.headers[colNum];
        elem1.textContent = headerText;
      }
      elem.setAttribute('header-text', headerText);
      if (table.columnWidths && table.columnWidths[table.headers[colNum]]) {
        elem1.style.width = table.columnWidths[table.headers[colNum]];
      }
      elem.appendChild(elem1);
      theadTrElem.appendChild(elem);
      var row;
      for (var rowNum = 0; rowNum < table.rows.length; rowNum++) {
        row = document.getElementById(table.title + '-row-' + rowNum);
        // build cell for each existing row
        elem = document.createElement('td');
        elem.id = table.title + '-' + rowNum + '-' + colNum;
        if (table.keysToIds) {
          elem.id = 'row-'+rowNum+'-'+colText;
        }
        row.appendChild(elem);
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  function buildRow (table, rowNum, rowData, tbodyElem, hostname) {
    try {
      var retry;
      if (!table) {
        throw new Error('Table data or table name is required.');
      }
      if (utility.isString(table)) { // adding to pre-made table
        var tableObj = madeTables[table];
        if (!tableObj) {
          retry = true;
        } else {
          table = tableObj;
          table.rows.push(rowData);
          setRow(table, table.rows.length - 1);
          rowData = table.rows[table.rows.length - 1];
          rowNum = table.rows.length - 1;
        }
      }
      if (!retry && !tbodyElem) {
        tbodyElem = document.getElementById(table.title + '-table-tbody');
        if (!tbodyElem) {
          retry = true;
        }
      }
      if (retry) {
        setTimeout(function () {
          buildRow (table, rowNum, rowData, tbodyElem);
        }, 500);
        return;
      }
      var row;
      var title = table.title;
      var based_i = rowNum;
      rowData.filteredOut = false;
      if (rowData.filteredCells) {
        for (var j = 0; j < rowData.filteredCells.length; j++) {
          if (rowData.filteredCells[j]) {
            rowData.filteredOut = true;
            table.filteredCount++;
            break;
          }
        }
        if (rowData.filteredOut) return;
      }
      table.visibleRows++;
      row = document.createElement('tr');
      row.setAttribute('id', title + '-row-' + based_i);
      row.setAttribute('row-num', based_i);
      if (!table.notSortable) row.setAttribute('sortable', true);
      if (!table.notRemovable) {
        row.setAttribute('removable', true);
        row.setAttribute('search-removable', true);
      }
      if (table.htmlProperties) {
        for (var i = 0; i < table.htmlProperties.length; i++) {
          var key = table.htmlProperties;
          var val;
          if (!table.rows[based_i].tableRow[key]) {
            val = table.htmlValues[key];
          } else {
            val = table.rows[based_i].tableRow[key];
          }
          row.setAttribute(key, val);
        }
      }
  // CHECKBOX
      if (table.checkable) {
        // create the checkbox cell
        elem = document.createElement('td');
        elem.className = 'checkColumn';
        elem1 = document.createElement('input');
        elem1.setAttribute('type', 'checkbox');
        elem1.setAttribute('id', title + '-checkbox-' + based_i);
        elem1.setAttribute('row', based_i);
        elem1.setAttribute('data-row-checkbox', 'true');
        addCheckEventListener(elem1, table, based_i);
        elem.appendChild(elem1);
        row.appendChild(elem);
      }
  // Edit Column
      if (table.editColumn) {
        // create the checkbox cell
        elem = document.createElement('td');
        elem1 = document.createElement('div');
        elem.appendChild(elem1);
        elem2 = document.createElement('div');
        elem2.className = 'm-r-20';
        elem2.setAttribute('data-animation', 'false');
        elem2.setAttribute('data-placement', 'top');
        elem2.setAttribute('data-delay', '0');
        elem2.setAttribute('data-toggle', 'tooltip');
        elem2.setAttribute('title', 'Edit');
        elem1.appendChild(elem2);
        elem3 = document.createElement('a');
        elem3.className = 'nav-item nav-link pull-xs-left m-r-10';
        elem3.href = '#/';
        addShowModalClickEvent(elem3, table, based_i, 'cron-edit-modal', 'update');
        // append the link to the edit div
        elem2.appendChild(elem3);
        elem4 = document.createElement('i');
        elem4.className = 'fa fa-lg fa-pencil-square-o';
        // append the i to the a
        elem3.appendChild(elem4);
        elem2 = document.createElement('div');
        elem2.setAttribute('data-animation', 'false');
        elem2.setAttribute('data-placement', 'top');
        elem2.setAttribute('data-delay', '0');
        elem2.setAttribute('data-toggle', 'tooltip');
        elem2.setAttribute('title', 'Delete');
        elem1.appendChild(elem2);
        elem3 = document.createElement('a');
        elem3.className = 'nav-item nav-link pull-xs-left';
        elem3.href = '#/';
        addDeleteClickEvent(elem3, based_i);
        // append the link to the edit div
        elem2.appendChild(elem3);
        elem4 = document.createElement('i');
        elem4.className = 'fa fa-lg fa-trash';
        // append the i to the a
        elem3.appendChild(elem4);
        row.appendChild(elem);
      }
  // DATA ROWS
      // append the cells
      for (j = 0; j < table.headers.length; j++) {
        var header = table.headers[j];
        // create the cell for the column
        elem = document.createElement('td');
        elem.id = table.title + '-' + based_i + '-' + j;
  // START/STOP
        // set up the cell based on column name or as default setup
        if (table.headers[j] === startStopHeader) {
          if (table.rows[based_i].tableRow[startStopHeader]) {
            elem1 = document.createElement('button');
            elem1.id = 'row-'+based_i+'-start-stop-button';
            elem1.className = 'btn btn-primary';
            addStartStopClickEvent(elem1, table, based_i);
            elem1.textContent = table.rows[i].tableRow[startStopHeader];
            elem.appendChild(elem1);
          }
  // BP TAGS
        } else if (table.headers[j] === bpTagsHeader) {
          elem1 = document.createElement('div');
          if (table.nowrapColumns && table.nowrapColumns.indexOf(table.headers[j]) !== -1) {
            elem1.className = 'nowrap';
          }
          if (table.userRole === 'Admin' || table.userRole === 'Manager') {
            elem2 = document.createElement('a');
            elem2.href = '#/';
            addShowModalClickEvent(elem2, table, based_i, 'tags-modal');
            elem2.text = 'Manage BP Tags';
            elem1.appendChild(elem2);
          }
          elem3 = document.createElement('div');
          elem3.id = 'row-'+based_i+'-bptags';
          elem3.textContent = table.rows[based_i].tableRow[bpTagsHeader].join('<br />');
          elem1.appendChild(elem3);
          elem.appendChild(elem1);
  // BP NOTES
        } else if (table.headers[j] === bpNotesHeader) {
          // note add link
          if (table.userRole === 'Admin' || table.userRole === 'Manager') {
            // create the add note elems
            elem1 = document.createElement('div');
            elem1.className = 'w-20px inline';
            elem1.setAttribute('data-animation', 'false');
            elem1.setAttribute('data-placement', 'top');
            elem1.setAttribute('data-delay', '0');
            elem1.setAttribute('data-toggle', 'tooltip');
            elem1.setAttribute('title', 'Add Note');
            elem2 = document.createElement('a');
            elem2.className = 'nav-item nav-link pull-xs-left w-20px m-r-10';
            elem2.href = '#/';
            addShowModalClickEvent(elem2, table, based_i, 'note-add-modal');
            // append the link to the add note div
            elem1.appendChild(elem2);
            elem3 = document.createElement('i');
            elem3.className = 'fa fa-lg fa-pencil-square-o';
            // append the i to the a
            elem2.appendChild(elem3);
            // add the create notes elem
            elem.appendChild(elem1);
          }
          // create the view notes elems if notes exist
          if (table.rows[based_i].text[bpNotesHeader]) {
            attachBPNotesViewElements (elem, table, based_i);
          }
  // TAGS
        } else if (table.headers[j] === 'Tags') {
          elem1 = document.createElement('div');
          innerHTML = '';
          for (var k = 0; k < table.rows[based_i].tableRow[header].length; k++) {
            innerHTML += '<span class="nowrap">' + table.rows[based_i].tableRow[header][k] + '</span><br />';
          }
          elem1.innerHTML = innerHTML;
          elem.appendChild(elem1);
  // INSTANCE ID
        } else if (table.headers[j] === 'InstanceId' && (title === 'EC2s' || title === 'NATs')) {
          // outer div for instanceId
          elem1 = document.createElement('div');
          elem1.className = 'nowrap';
          elem2 = document.createElement('div');
          elem2.className = 'circleWrapper';
          elem2.setAttribute('data-animation', 'false');
          elem2.setAttribute('data-placement', 'top');
          elem2.setAttribute('data-delay', '0');
          elem2.setAttribute('data-toggle', 'tooltip');
          elem2.setAttribute('title', table.rows[based_i].pristineRow.State.Name);
          // inner div to hold circle
          elem3 = document.createElement('div');
          elem3.id = 'row-'+based_i+'-running-circle';
          if (table.rows[based_i].pristineRow.State.Name === 'running' || table.rows[based_i].pristineRow.State === 'available') {
            elem3.className = 'runningCircle';
          } else {
            elem3.className = 'stoppedCircle';
          }
          elem2.appendChild(elem3);
          elem1.appendChild(elem2);
          // text by the circle
          for (k = 0; k < table.rows[based_i].tableRow.InstanceId.length; k++) {
            elem2 = document.createElement('div');
            if (k === 0) {
              // first elem goes inline by the circle
              elem2.className = 'nowrap circleWrapper';
            } else {
              elem2.className = 'nowrap';
            }
            elem1.appendChild(elem2);
            elem2 = document.createElement('span');
            elem2.className = 'm-l-5';
            elem2.textContent = table.rows[based_i].tableRow.InstanceId[k];
            elem1.appendChild(elem2);
          }
          elem.appendChild(elem1);
  // CRONS NAME
        } else if (table.title === 'Crons' && table.headers[j] === 'name') {
          // outer div for name column
          elem1 = document.createElement('div');
          elem1.className = 'nowrap';
          elem2 = document.createElement('div');
          elem2.className = 'circleWrapper';
          elem2.setAttribute('data-animation', 'false');
          elem2.setAttribute('data-placement', 'top');
          elem2.setAttribute('data-delay', '0');
          elem2.setAttribute('data-toggle', 'tooltip');
          elem2.setAttribute('title', table.rows[based_i].pristineRow.turnedOn);
          // inner div to hold circle
          elem3 = document.createElement('div');
          elem3.id = 'row-'+based_i+'-running-circle';
          if (table.rows[based_i].pristineRow.turnedOn) {
            elem3.className = 'runningCircle';
          } else {
            elem3.className = 'stoppedCircle';
          }
          elem2.appendChild(elem3);
          elem1.appendChild(elem2);
          // text by the circle
          elem2 = document.createElement('div');
          // first elem goes inline by the circle
          elem2.className = 'nowrap circleWrapper';
          elem1.appendChild(elem2);
          elem2 = document.createElement('span');
          elem2.id = 'row-'+based_i+'-cron-name-div';
          elem2.className = 'm-l-5';
          elem2.textContent = table.rows[based_i].tableRow.name;
          elem1.appendChild(elem2);
          elem.appendChild(elem1);
  // DEFAULT
        } else {
          // elem1 = document.createElement('span');
          // className = 'textarea-cell';
          // default row setup
          // if (table.nowrapColumns && table.nowrapColumns.indexOf(table.headers[j]) !== -1) {
          //   className += ' nowrap';
          // }
          // elem1.className = className;
          elem.textContent = table.rows[based_i].tableRow[table.headers[j]];
          if (table.keysToIds) {
            elem.id = 'row-'+based_i+'-'+table.headers[j];
          }
          // elem.appendChild(elem1);
        }
        row.appendChild(elem);
      }
      tbodyElem.appendChild(row);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
















  // attach the view notes icon to the BP Notes cell
  function attachBPNotesViewElements (attachTo, data, i) {
    try {
      // skip if top element already exists, happens when prior notes existed
      var topElement = $('#row-'+i+'-bpnotes-view');
      if (topElement.length) {
        return;
      }
      // create top level
      var elem1, elem2, elem3;
      elem1 = document.createElement('div');
      elem1.id = 'row-'+i+'-bpnotes-view';
      elem1.setAttribute('view-notes', 'true');
      elem1.className = 'w-20px inline';
      elem1.setAttribute('data-animation', 'false');
      elem1.setAttribute('data-placement', 'top');
      elem1.setAttribute('data-delay', '0');
      elem1.setAttribute('data-toggle', 'tooltip');
      elem1.setAttribute('title', 'View Notes');
      // create view notes icon/link
      elem2 = document.createElement('a');
      elem2.className = 'nav-item nav-link pull-xs-left w-20px m-r-10';
      elem2.href = '#/';
      addShowModalClickEvent(elem2, data, i, 'note-view-modal');
      elem1.appendChild(elem2);
      elem3 = document.createElement('i');
      elem3.className = 'fa fa-lg fa-eye';
      elem2.appendChild(elem3);
      attachTo.appendChild(elem1);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  // determine if table is allowed to start stop instances
  function enableStartStopTable (table) {
    try {
      var allowFinal = false;
      var reqs = table.startStopRequirements;
      if (!reqs) {
        return false;
      }
      if (reqs.userRole) {
        if(table.userRole !== reqs.userRole) {
          return false;
        }
      }
      return true;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  // determine if stopping and starting instances is allowed on a row
  function enableStartStopRow (table, index) {
    try {
      var row = table.rows[index];
      var reqs = table.startStopRequirements;

      // allowFinal variable: set to true is used to bypass further checks
      var allowFinal = false;
      reqs.forEach(function (requirement) {
        if (!allowFinal) {
          var allow = true;
          if (requirement.userRole) {
            if(table.userRole !== requirement.userRole) {
              allow = false;
            }
          }
          if (allow && requirement.env) {
            if (row.pristineRow.Env !== requirement.env) {
              allow = false;
            }
          }
          if (allow && requirement.tags) {
            allow = false;
            requirement.tags.forEach(function (tag) {
              if (!allow) {
                if (row.tags.indexOf(tag) !== -1) {
                  allow = true;
                }
              }
            });
          }
          allowFinal = allow;
        }
      });
      // track whether any rows in table are allowed to control if column is shown
      if (allowFinal) {
        table.allowStartStop = true;
      }
      return allowFinal;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  function addShowModalClickEvent (elem, table, i, modalName, crudType) {
    elem.addEventListener('click', function (event) {
      if (event) {
        event.preventDefault();
      }
      pages.showModal(event, modalName, table, i, crudType);
    }, false);
  }
  function addCheckEventListener (elem, table, i) {
    elem.addEventListener('click', function () {
      updateCheckedList(event, table, i);
    });
  }
  function addSortListener (elem, columnNumber, table) {
    elem.addEventListener('click', function () {
      sortBy(table, columnNumber);
    });
  }
  function addDeleteClickEvent (elem, i) {
    elem.addEventListener('click', function (event) {
      if (event) {
        event.preventDefault();
      }
      pages.deleteSelection(event, i);
    }, false);
  }
  function filterBy (table, columnNumber) {
    try {
      if (tableIsRendering) {
        return;
      }
      tableIsRendering = true;
      var i;
      // get the value to filter by
      var filterText = $("[id='"+table.title+'-filter-'+columnNumber).val();
      // set each filter value for the column
      if (filterText !== '') {
        // text in the filter
        var filterValue = filterText.toLowerCase();
        // for each row
        for (i = 0; i < table.rows.length; i++) {
          var row = table.rows[i];
          var compareText = row.text[table.headers[columnNumber]].toLowerCase();
          // if text is found
          if (compareText.indexOf(filterValue) !== -1) {
            // don't filter
            row.filteredCells[columnNumber] = false;
          } else {
            // filter
            row.filteredCells[columnNumber] = true;
          }
        }
      } else {
        // unfilter this column if no filter text
        for (i = 0; i < table.rows.length; i++) {
          table.rows[i].filteredCells[columnNumber] = false;
        }
      }
      updateDomFiltered(table);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function filterColumns (preFilters) {
    try {
      if (tableIsRendering) {
        return;
      }
      var table = lastTable;
      var filterButtonElem = document.getElementById(table.filterButtonId);
      filterButtonElem.innerText = 'Filtering...';
      filterButtonElem.setAttribute('disabled', 'disabled');
      
      var i, j, filterText;
      var filteredRows = 0;
      table.filteredColumns = {};

      if (preFilters) {
        for (var key in preFilters) {
          var headerIndex = table.headers.indexOf(key);
          if (!headerIndex && headerIndex !== 0) {
            continue;
          }
          table.filteredColumns[headerIndex] = preFilters[key];
          var filterValue = preFilters[key].toLowerCase();
          // for each row
          for (j = 0; j < table.rows.length; j++) {
            var row = table.rows[j];
            var compareText = row.text[key].toLowerCase();
            // if text is found
            if (compareText.indexOf(filterValue) !== -1) {
              // don't filter
              row.filteredCells[headerIndex] = false;
            } else {
              // filter
              row.filteredCells[headerIndex] = true;
              filteredRows++;
            }
          }
        }
      } else {
        // get the value to filter by
        for (i = 0; i < table.headers.length; i++) {
          filterText = $("[id='"+table.title+'-filter-'+i).val();
          // set each filter value for the column
          if (filterText !== '') {
            table.filteredColumns[i] = filterText;
            // text in the filter
            var filterValue = filterText.toLowerCase();
            // for each row
            for (j = 0; j < table.rows.length; j++) {
              var row = table.rows[j];
              var compareText = row.text[table.headers[i]].toLowerCase();
              // if text is found
              if (compareText.indexOf(filterValue) !== -1) {
                // don't filter
                row.filteredCells[i] = false;
              } else {
                // filter
                row.filteredCells[i] = true;
                filteredRows++;
              }
            }
          } else {
            // unfilter this column if no filter text
            for (j = 0; j < table.rows.length; j++) {
              table.rows[j].filteredCells[i] = false;
            }
          }
        }
      }
      // updateDomFiltered(table, true);
      filterButtonElem.innerText = 'Rendering...';
      buildTable(table);
      tableIsRendering = false;
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
      tableIsRendering = false;
      elem.innerText = 'Filter';
      elem.removeAttribute('disabled');
    }
  }

  function updateDomFiltered (table, rebuild) {
    try {
      // filter based on original row number
      var originalRowNumber;
      table.filteredCount = 0;

      var captionElem = $('#'+table.captionId);
      var filterButtonElem = $('#'+table.filterButtonId);

      if (table.filterButtonId) {
        filterButtonElem.prop('disabled', true);
        filterButtonElem.text('Filtering...');
      }

      // chunk updates
      if (table.limitRowsAmount) {
        rowCount = table.limitRowsAmount;
      } else {
        rowCount = table.rows.length;
      }
      var divideInto = Math.ceil(rowCount / 50);
      var chunkSize = Math.ceil(rowCount/divideInto);
      var iteration = 0;

      setTimeout(function filterRows () {
        var base = (chunkSize) * iteration;
        for (var i = 0; i < chunkSize; i++) {
          var based_i = base + i;
          var row = table.rows[based_i];
          if (!row) {
            break;
          }
          row.filterChanged = false;
          row.originalFilteredOut = row.filteredOut;
          row.filteredOut = false;
          if (row.filteredCells) {
            for (var j = 0; j < row.filteredCells.length; j++) {
              if (row.filteredCells[j]) {
                row.filteredOut = true;
                table.filteredCount++;
                break;
              }
            }
          }
          // only update rows that changed filter values
          if (row.filteredOut !== row.originalFilteredOut) {
            var id = table.title+'-row-'+row.originalOrder;
            // var elem = $("[id='"+table.title+'-row-'+originalRowNumber);
            if (row.filteredOut) {
              var elem = document.getElementById(id).style.display = "none";
              // elem.hide();
            } else {
              var elem = document.getElementById(id).style.display = "";
              // elem.show();
            }
          }
        }
        iteration++;
        if (iteration < divideInto) {
          // update caption with new count
          // captionElem.text('Showing ' + (table.rows.length - table.filteredCount) + ' of ' + table.rows.length + ' ' + table.caption);
          // filterButtonElem.text('Filtering ' + Math.round(chunkSize * iteration / table.rows.length * 100) + '% Complete...');
          setTimeout(filterRows, 0);
        } else {
          // update caption with new count
          captionElem.text('Showing ' + (table.rows.length - table.filteredCount) + ' of ' + table.rows.length + ' ' + table.caption);
          // update total if applicable
          if (table.totalColumns) {
            setTotalColumns(table);
          }
          if (table.filterButtonId) {
            filterButtonElem.prop('disabled', false);
            filterButtonElem.text('Apply Filters');
          }
          tableIsRendering = false;
        }
      }, 0);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
      tableIsRendering = false;
    }
  }

  function setChecked (table, i, checked) {
    try {
      if (!table.checkedpages) {
        table.checkedpages = [];
      }
      if (table.checkedpages.indexOf(i) === -1) {
        if (checked) {
          table.checkedpages.push(i);
        }
      } else {
        if (!checked) {
          table.checkedpages.splice(table.checkedpages.indexOf(i), 1);
        }
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function setTotalColumns (table) {
    try {
      var elem;
      var rowsTbody = $('#'+table.rowsId);
      $("[id='"+table.title+'-row-total').remove();
      var row = document.createElement('tr');
      row.setAttribute('id', table.title + '-row-total');
      if (!table.notRemovable) {
        row.setAttribute('removable', true);
        row.setAttribute('search-removable', true);
      }
  // CHECKBOX SLOT
      if (table.checkable) {
        // create the empty cell
        elem = document.createElement('td');
        elem.className = 'checkColumn';
        if (!table.notRemovable) {
          elem.setAttribute('removable', true);
          elem.setAttribute('search-removable', true);
        }
        row.appendChild(elem);
      }
  // EDIT COLUMN SLOT
      if (table.editColumn) {
        // create the empty cell
        elem = document.createElement('td');
        if (!table.notRemovable) {
          elem.setAttribute('removable', true);
          elem.setAttribute('search-removable', true);
        }
        row.appendChild(elem);
      }
      var totalHeader, sum;
      for (i = 0; i < table.headers.length; i++) {
        totalHeader = table.headers[i];
        elem = document.createElement('td');
        if (table.totalColumns.indexOf(totalHeader) > -1) {
          // add up the column values
          sum = 0;
          for (j = 0; j < table.rows.length; j++) {
            if (!table.rows[j].filteredOut) {
              sum += Number(table.rows[j].pristineRow[totalHeader]);
            }
          }
          elem.textContent = utility.prettyNumber(sum);
        } else {
          if (i === 0) {
            elem.textContent = 'Total';
          }
        }
        row.appendChild(elem);
      }
      rowsTbody.append(row);
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }

  function updateCheckedList (event, table, i) {
    try {
      if (!table) {
        table = getLastTable();
      }
      if (!table.checkedpages) {
        table.checkedpages = [];
      }
      if (table.checkedpages.indexOf(i) === -1) {
        table.checkedpages.push(i);
      } else {
        table.checkedpages.splice(table.checkedpages.indexOf(i), 1);
      }
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  // sets tables bp tags and updates table
  function setBPTags (tags, title) {
    try {
      var i, j, k, row, tag, usedBy;
      var table = getLastTable();
      var originalRowNumber;
      for (i = 0; i < table.rows.length; i++) {
        row = table.rows[i];
        // clear the tags
        row.tableRow[bpTagsHeader] = [];
        // set new tags
        for (j = 0; j < tags.length; j++) {
          tag = tags[j];
          for (k = 0; k < tag.usedBy.length; k++) {
            usedBy = tag.usedBy[k];
            if (usedBy.kind === title && usedBy.identifier === row.pristineRow[table.identifier]) {
              row.tableRow[bpTagsHeader].push(tag.text);
            }
          };
        };
        // replace row text
        row.text[bpTagsHeader] = row.tableRow[bpTagsHeader].join(', ');
        // replace current tags
        $('#row-'+row.originalOrder+'-bptags').empty();
        $('#row-'+row.originalOrder+'-bptags').html(row.tableRow[bpTagsHeader].join('<br />'));
      };
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  // sets tables notes and updates table
  function setBPNotes (notes, title) {
    try {
      var i, j, row, note;
      // remove any view notes icons
      $('[view-notes').remove();
      // stop if no notes to add
      if (!notes || !notes.length) {
        return;
      }
      var attachToThisElement;
      var table = getLastTable();
      table.notes = notes;
      var headerIndex = table.headers.indexOf(bpNotesHeader);
      var associationColumn;
      associationColumn = table.identifier;
      // check each row
      for (i = 0; i < table.rows.length; i++) {
        row = table.rows[i];
        // get element to attach note view icon to
        attachToThisElement = document.getElementById(title + '-' + row.originalOrder + '-' + headerIndex);
        // set new notes
        for (j = 0; j < notes.length; j++) {
          note = notes[j];
          if (note.kind === table.title && note.identifier === row.pristineRow[associationColumn]) {
            attachBPNotesViewElements (attachToThisElement, table, row.originalOrder);
          }
        };
      };
    } catch (error) {
      console.log(error);
      errors.handleError(error, table.errorMsgId);
    }
  }
  // make data and functions available
  return {
    create: create,
    buildCol: buildCol,
    buildRow: buildRow,
    buildTable: buildTable,
    exportToCSV: exportToCSV,
    filterColumns: filterColumns,
    getLastTable: getLastTable,
    replaceChars: replaceChars,
    setBPTags: setBPTags,
    setBPNotes: setBPNotes,
  };
}());
