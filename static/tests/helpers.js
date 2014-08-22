var views = [];

Ember.Test.registerHelper('module', function (app, name, opts) {
	opts = opts ||  {
		setup: function () {
			location.hash = '';
			app.reset();
		},
		teardown: function () {
			while (views.length) {
				Ember.run(views.pop(), 'destroy');
			}
		}
	};
	QUnit.module(name, opts);
});

/*
	Invoke an Handlebars helper.

	invokeHelper('my-helper', value)
*/

Ember.Test.registerHelper('invokeHelper', function (app, helperName, parameter) {
	var helper = Ember.Handlebars.helpers[helperName];

	Ember.assert("The " + helperName + " helper was not found", helper);

	return helper._rawFunction(parameter);
});

/*
	Create a component and append it to the dom.
	If there is a template for this component, make sure it is used.

	createComponent('my-component')
*/

Ember.Test.registerHelper('createComponent', function (app, name) {
	var component = App.__container__.lookup('component:' + name),
		templateName = 'components/' + name;

	if (Ember.TEMPLATES[templateName]) {
		component.set('layoutName', templateName);
	}

	Ember.run(function () {
		component.appendTo('#qunit-fixture');
	});

	views.push(component);

	return component;
});
