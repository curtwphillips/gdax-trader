let utility = (function () {
  function bytesToGB(bytes) {
    if (bytes) {
      return bytes / 1000000000;
    }
  }
  // formats a date for use as html input element value
  function formatDateInput(dateObject) {
    let day = ("0" + dateObject.getDate()).slice(-2);
    let month = ("0" + (dateObject.getMonth() + 1)).slice(-2);
    let dateString = dateObject.getFullYear() + "-" + month + "-" + day;
    return dateString;
  }

  /**
   * format current time or date object, ex. "09-07-15, 5:45:16.321 pm"
   * if null is passed in, it returns the current date time
   */
  function getTime(dateObject, shortTime) {
    if (shortTime) {
      return moment(dateObject).format("MM-DD-YY HH:mm"); // h:mm:ss.SSS HH = military
    }
    return moment(dateObject).format("MM-DD-YY HH:mm:ss"); // h:mm:ss.SSS HH = military
  }

  function isString(s) {
    return typeof s === "string" || s instanceof String;
  }

  function prettyNumber(num) {
    if (num % 1 != 0) {
      num = Number(num).toFixed(2);
    }

    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, "$1,");
  }
  /**
   * round a number up with a specified number of decimals left over
   */
  function roundUp(value, decimals) {
    decimals = decimals || 0;
    return Number(Math.ceil(value + "e" + decimals) + "e-" + decimals);
  }

  /**
   * round a number down with a specified number of decimals left over
   */
  function roundDown(value, decimals) {
    decimals = decimals || 0;
    return Number(Math.floor(value + "e" + decimals) + "e-" + decimals);
  }

  // subtract using integers to avoid things like 0.000131 - 0.000022 equaling 0.00010900000000000002 instead of 0.000109
  function doMath(type, val1, val2) {
    let types = ["add", "subtract"];
    if (types.indexOf(type) === -1) {
      throw new Error(
        "utility.doMath requires one of these types: " +
          types +
          ", but received type: " +
          type
      );
    }
    if (isNaN(val1) || isNaN(val2)) {
      throw new Error(
        "utility.doMath only accepts numbers, but received val1 " +
          val1 +
          " of type " +
          typeof val1 +
          " and val2 " +
          val2 +
          " of type " +
          typeof val2
      );
    }

    let val1Decimals = countDecimals(val1);
    let val2Decimals = countDecimals(val2);
    let biggerDecimals = Math.max(val1Decimals, val2Decimals);
    let tempVal1 = Number(val1 + "e" + biggerDecimals);
    let tempVal2 = Number(val2 + "e" + biggerDecimals);
    let tempAnswer;
    if (type === "subtract") {
      tempAnswer = tempVal1 - tempVal2;
    } else if (type === "add") {
      tempAnswer = tempVal1 + tempVal2;
    }
    return Number(tempAnswer + "e-" + biggerDecimals);
  }

  function countDecimals(value) {
    if (value % 1 !== 0) {
      return value.toString().split(".")[1].length;
    }
    return 0;
  }

  function existy(x) {
    //true unless undefined or null
    return x !== null && x !== undefined;
  }

  function debounce(func, threshold, execAsap) {
    try {
      let timeout;
      return function debounced() {
        let obj = this,
          args = arguments;
        function delayed() {
          if (!execAsap) func.apply(obj, args);
          timeout = null;
        }

        if (timeout) clearTimeout(timeout);
        else if (execAsap) func.apply(obj, args);

        timeout = setTimeout(delayed, threshold || 100);
      };
    } catch (error) {
      console.log(error);
      errors.handleError(error);
    }
  }

  return {
    bytesToGB: bytesToGB,
    debounce: debounce,
    doMath: doMath,
    existy: existy,
    formatDateInput: formatDateInput,
    getTime: getTime,
    isString: isString,
    prettyNumber: prettyNumber,
    roundDown: roundDown,
    roundUp: roundUp,
  };
})();
