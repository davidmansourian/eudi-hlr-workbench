  // ============================================================
  // Init
  // ============================================================
  buildTypeFilters();
  buildCategoryFilters();
  buildTopicFilters();
  buildPersonalFilters();
  renderFeatureList();
  renderPathList();
  renderActivePath();
  applyAllStatusClasses();
  setTimeout(() => {
    runForceLayout();
    cy.fit(undefined, 30);
  }, 50);
