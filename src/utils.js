'use strict';

export const withSuccess = function(cb, silent = true) {
  return function(obj) {
    if (obj.returnCode === 0) {
      cb(obj.data);
    } else if (!silent) {
      console.warn(JSON.stringify(obj));
    }
  };
};