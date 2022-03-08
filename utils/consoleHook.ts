// Copyright 2022 Janos Veres. All rights reserved.
// Use of this source code is governed by an MIT-style
// license that can be found in the LICENSE file.

const { "log": _log, "info": _info, "warn": _warn, "error": _error } = console;

export default function consoleHook(
  { logPrefix, infoPrefix, warnPrefix, errorPrefix }: {
    logPrefix?: string;
    infoPrefix?: string;
    warnPrefix?: string;
    errorPrefix?: string;
  },
) {
  if (logPrefix) {
    console.log = function () {
      _log.apply(console, [
        logPrefix,
        ...arguments,
      ]);
    };
  }

  if (infoPrefix) {
    console.info = function () {
      _info.apply(console, [
        infoPrefix,
        ...arguments,
      ]);
    };
  }

  if (warnPrefix) {
    console.warn = function () {
      _warn.apply(console, [
        warnPrefix,
        ...arguments,
      ]);
    };
  }

  if (errorPrefix) {
    console.error = function () {
      _error.apply(console, [
        errorPrefix,
        ...arguments,
      ]);
    };
  }
}
