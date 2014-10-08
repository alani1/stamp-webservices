var restInterfaces = require('./rest-interfaces')();
var catalogues = require("../services/catalogues");
var catalogue = require('../model/catalogue');
var extend = require('node.extend');

var RESOURCE_PATH = "/catalogues";

exports.configure = function (app, basePath) {
    var albumsRest = extend(true, {}, restInterfaces);
    albumsRest.initialize(app, basePath + RESOURCE_PATH, catalogues, catalogue);
}
