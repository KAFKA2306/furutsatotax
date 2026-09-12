'use strict';

const PYODIDE_VERSION = '0.29.0';
const PYODIDE_BASE = `https://cdn.jsdelivr.net/pyodide/v${PYODIDE_VERSION}/full/`;
let runtimePromise;

async function loadRuntime() {
  if (!runtimePromise) {
    runtimePromise = (async () => {
      importScripts(`${PYODIDE_BASE}pyodide.js`);
      const pyodide = await loadPyodide({ indexURL: PYODIDE_BASE });
      await pyodide.loadPackage('pyyaml');

      const [coreResponse, apiResponse] = await Promise.all([
        fetch('python/calc_furusato.py', { cache: 'no-store' }),
        fetch('python/pyodide_api.py', { cache: 'no-store' }),
      ]);
      if (!coreResponse.ok || !apiResponse.ok) {
        throw new Error(`Python core load failed: calc=${coreResponse.status}, api=${apiResponse.status}`);
      }

      pyodide.FS.writeFile('/calc_furusato.py', await coreResponse.text());
      pyodide.FS.writeFile('/pyodide_api.py', await apiResponse.text());
      pyodide.runPython("import sys; sys.path.insert(0, '/'); import pyodide_api");
      return pyodide;
    })();
  }
  return runtimePromise;
}

self.onmessage = async (event) => {
  const { id, payload } = event.data || {};
  try {
    const pyodide = await loadRuntime();
    pyodide.globals.set('browser_payload_json', JSON.stringify(payload));
    const output = pyodide.runPython('pyodide_api.calculate_json(browser_payload_json)');
    pyodide.globals.delete('browser_payload_json');
    self.postMessage({ id, ok: true, result: JSON.parse(output) });
  } catch (error) {
    try {
      const pyodide = await runtimePromise;
      pyodide?.globals?.delete('browser_payload_json');
    } catch (_) {
      // Keep the original calculation/runtime error as the completion authority.
    }
    self.postMessage({
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};
