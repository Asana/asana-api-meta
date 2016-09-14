module.exports = {
  resource: {
    template: 'resource.ejs',
    filename: function(resource, helpers) {
      return helpers.plural(helpers.classify(resource.name)) + 'Base.java';
    }
  }
};
