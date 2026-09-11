(() => {
  'use strict';

  const worker = new Worker('tax-worker.js');
  const pending = new Map();
  let sequence = 0;

  worker.onmessage = (event) => {
    const { id, ok, result, error } = event.data || {};
    const request = pending.get(id);
    if (!request) return;
    pending.delete(id);
    if (ok) request.resolve(result);
    else request.reject(new Error(error || 'Python calculation failed'));
  };

  worker.onerror = (event) => {
    const error = new Error(event.message || 'Python worker failed');
    for (const request of pending.values()) request.reject(error);
    pending.clear();
  };

  function calculate(payload) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      worker.postMessage({ id, payload });
    });
  }

  window.FurusatoTaxPython = Object.freeze({ calculate });
})();
