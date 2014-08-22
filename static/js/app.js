var App = window.App = Ember.Application.create({
	LOG_TRANSITIONS: true
});


require('js/mixins/*');
require('js/models/*');
require('js/components/*');
require('js/helpers/*');
require('js/packages/*/*');
require('js/router');
