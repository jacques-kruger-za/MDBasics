(function () {
  function createParkedScrollSync() {
    return {
      enabled: false,
      syncFrom() {
        return false;
      }
    };
  }

  window.MDBasicsScrollSync = { createParkedScrollSync };
})();
