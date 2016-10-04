var dir = require('node-dir');
var jsdom = require("jsdom");


var htmlContentObjects = [];
var linkTags = [];
var elementTags = [];
var classTags = [];
var IDTags = [];
var imageResouces = [];

var excludeDirs = ['node_modules'];

// get all html documents
dir.readFiles(__dirname, {
    match: /.html$/,
    excludeDir: excludeDirs
    }, function(err, content, filename, next) {
        if (err) throw err;
        console.log('referencing: ' + filename);
        htmlContentObjects.push([filename, content]);
        next();
    },
    function(err, files){
        if (err) throw err;
        getClassTags();
    });

// iterate through each html doc in htmlContentObjects
function getClassTags() {
    for (var index = 0; index < htmlContentObjects.length; index++) {
        console.log('loading dom for: ' + htmlContentObjects[index][0]);
        var html = htmlContentObjects[index];
        loadHTML(html);
    }
}

// load in jsdom 
function loadHTML(html){
    jsdom.env({
        html: html[1],
        scripts: ["http://code.jquery.com/jquery.js"],
        done: function (err, window) {
            var path = html[0];
            var $ = window.jQuery;
            var obj = {};
            //classes
            $('*').children().each(function () {
                $.each((this.className || '').split(/\s+/), function (i, v) {
                    obj[v] = true;
                });
            });
            var classes = $.map(obj, function (val, key) {
                return key === '' ? undefined : key;
            });
            //ids
            obj = {};
            $('*').children().each(function () {
                $.each((this.id || '').split(/\s+/), function (i, v) {
                    obj[v] = true;
                });
            });
            var IDs = $.map(obj, function (val, key) {
                return key === '' ? undefined : key;
            });
            //elements
            obj = {};
            $('*').children().each(function () {
                $.each((this.nodeName || '').split(/\s+/), function (i, v) {
                    obj[v] = true;
                });
            });
            var nodeNames = $.map(obj, function (val, key) {
                return key === '' ? undefined : key.toLowerCase();
            });
            //stylesheets
            obj = {};
            $('link[rel="stylesheet"]').each(function () {
                $.each((this.href || '').split(/\s+/), function (i, v) {
                    obj[v] = true;
                });
            });
            var styles = $.map(obj, function (val, key) {
                return key === '' ? undefined : key.toLowerCase();
            });
            //print current documents extracted data
            console.log('**** ' + path + ' ****');
            console.log('* classes *');
            console.log(classes);
            console.log('* ids *');
            console.log(IDs);
            console.log('* tags *');
            console.log(nodeNames);
            console.log('* stylesheets *');
            console.log(styles);
            console.log("extracting rules...");
            extractCSSRules(html[0], styles);
        }
    });
}

function extractCSSRules(filePath, styles) {
    // load all css docs in order of document
    // extract matching rules
    // create new css document to filePath
    // create separate css document to filePath minified
}

//TODO: base64 images