var dir = require('node-dir');
var jsdom = require("jsdom");
var request = require("request-sync");
var fs = require("fs");
var pathService = require('path');

var excludeDirs = ['node_modules'];
var htmlContentObjects = [];
var styleContentObjects = [];
var loadedStylesheets = [];
var loadedStylesheetsScript = [];
var loadedImages64 = [];
var cssRules = [];
var cssPsuedo = ["active","after", "before", "checked", "disabled", "empty", "enabled", "first-child", "first-of-type", "focus", "hover", "in-range", "invalid", "lang", "last-child", "last-of-type", "link", "not", "nth-child", "nth-last-child", "nth-last-of-type", "nth-of-type", "only-of-type", "only-child", "optional", "out-of-range", "read-only", "read-write", "required", "target", "valid", "visited"];

var log = [];
var styleLog = [];
var errorLog = [];

String.prototype.replaceAll = function(target, replacement) {
  return this.split(target).join(replacement);
};

// get all style documents
dir.readFiles(__dirname, {
        match: /.html$/,
        excludeDir: excludeDirs
    }, function (err, content, filename, next) {
        if (err) throw err;
        styleContentObjects.push([filename, content]);
        next();
    },
    function (err, files) {
        if (err) throw err;
        getStyles();
    });


// get all html documents
dir.readFiles(__dirname, {
        match: /.html$/,
        excludeDir: excludeDirs
    }, function (err, content, filename, next) {
        if (err) throw err;
        htmlContentObjects.push([filename, content]);
        next();
    },
    function (err, files) {
        if (err) throw err;
        getClassTags();
    });

function writeErrorLog(){
    var errorLogFile = fs.createWriteStream('03_errorLog.txt');
    errorLogFile.on('error', function (err) { /* error handling */ });
    errorLog.forEach(function (v) {
        errorLogFile.write(v + '\n');
    });
    errorLogFile.end();
}


// iterate through each html doc in styleContentObjects
function getStyles() {
    for (var index = 0; index < styleContentObjects.length; index++) {
        styleLog.push('loading dom for: ' + styleContentObjects[index][0]);
        var html = styleContentObjects[index];
        loadHTML(html, false);
        writeErrorLog();
    }
}

// iterate through each html doc in htmlContentObjects
function getClassTags() {
    for (var index = 0; index < htmlContentObjects.length; index++) {
        log.push('loading dom for: ' + htmlContentObjects[index][0]);
        var html = htmlContentObjects[index];
        loadHTML(html, true);
        writeErrorLog();
    }
}

// load in jsdom 
function loadHTML(html, loadStyles) {
    jsdom.env({
        html: html[1],
        scripts: ["http://code.jquery.com/jquery.js"],
        done: function (err, window) {
            var path = html[0];
            var $ = window.jQuery;
            var obj = {};
            //stylesheets
            if (loadStyles) {
                styleLog.push("extracting stylesheets...");
                obj = {};
                $('link[rel="stylesheet"]').each(function () {
                    $.each((this.href || '').split(/\s+/), function (i, v) {
                        obj[v] = true;
                    });
                });
                var styles = $.map(obj, function (val, key) {
                    return key === '' ? undefined : key.toLowerCase();
                });
                extractCSSStyleSheets(html[0], styles);

                styleLog.push("base64ing all images...");



                var styleLogFile = fs.createWriteStream('02_styleLog.txt');
                styleLogFile.on('error', function (err) { /* error handling */ });
                styleLog.forEach(function (v) {
                    styleLogFile.write(v + '\n');
                });
                styleLogFile.end();
            } else {
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
                // remove html docs that have no identifying attributes for css from dev cycle
                if (classes.length || IDs.length || nodeNames.length) {
                    log.push('**** ' + path + ' ****');
                    log.push('classes: ' + classes.length);
                    log.push('ids: ' + IDs.length);
                    log.push('tags: ' + nodeNames.length);
                    //extract all quasi-matching rules
                    log.push("extracting rules...");
                    extractCSSRules(classes, IDs, nodeNames, loadedStylesheetsScript);
                    //de-duplicate rules list
                    uniqueArray = cssRules.filter(function (elem, pos) {
                        return cssRules.indexOf(elem) == pos;
                    });
                    var filterUniqueArray = uniqueArray;
                    //remove remaining non matching css rules
                    log.push("query remaining css rules in stylesheets and remove non matching rules");
                    for (var i = uniqueArray.length - 1; i >= 0; i--) {
                        var element = uniqueArray[i];
                        //pull only the query by removing properties
                        if (element.indexOf("@") > -1) {
                            var openParam = element.indexOf("{");
                            element = element.substring(openParam);
                            element = element.replace('{','');
                            element = element.replace('}','');
                        } 
                        //properties open
                        try {
                            //jquery cannot query psuedo classes, remove psuedo selector
                            for (var index = 0; index < cssPsuedo.length; index++) {
                                var ps = ":"+cssPsuedo[index];
                                element = element.replace(/\s{2,10}/g, ' ',"D");
                                element = element.replace(" : ",':',"D");
                                element = element.replace(": ",':',"D");
                                element = element.replace(" :",':',"D");
                                element = element.replace(":: ",'::',"D");
                                element = element.replace(/\(.*?\)/, "");
                                //for whatever reason, these two sometimes fail to be removed during the cssPsuedo loop
                                element = element.replace(":after", "");
                                element = element.replace(":before", "");
                                //console.log(element);
                                if (element.indexOf(ps) > -1) {
                                    element = element.replaceAll(ps,'');
                                }
                            }
                            var open = element.indexOf("{");
                            if ($(element.substring(0, open)).length === 0) {
                                log.push('removing rule: ' + element);
                                filterUniqueArray.splice([i],1);
                            }
                        } catch (e) {
                            //keep failed rules in
                            //console.log(element);
                            console.log(e);
                        }
                    }
                    //base64 images
                    log.push("base64ing all images...");


                    log.push("generating new css document...");
                    var onlyPath = pathService.dirname(path);
                    log.push("updating " + onlyPath + " with new css style...");
                    var file = fs.createWriteStream(onlyPath + "/" + pathService.basename(path).replace(/\.[^/.]+$/, "") + '_unhttp.css');
                    file.on('error', function (err) { /* error handling */ });
                    filterUniqueArray.forEach(function (v) {
                        v = v.replace(/ , /g, ',', "D");
                        v = v.replace(/ { /g, '{', "D");
                        v = v.replace(/ } /g, '}', "D");
                        v = v.replace(/ : /g, ':', "D");
                        v = v.replace(" .", '.', "D");
                        v = v.replace(" #", '#', "D");
                        v = v.replace(/\s{2,10}/g, ' ');
                        file.write(v + '\n');
                    });
                    file.end();
                    // update log
                    log.push("complete: " + path + "!!!");
                    var logFile = fs.createWriteStream('01_log.txt');
                    logFile.on('error', function (err) { /* error handling */ });
                    log.forEach(function (v) {
                        logFile.write(v + '\n');
                    });
                    logFile.end();
                }
            }

        }
    });
}

function matchCSS() {

}

// get all stylesheets on html doc
function extractCSSStyleSheets(filePath, styles) {
    // load all css docs in order of document
    for (var index = 0; index < styles.length; index++) {
        var element = styles[index];
        if (loadedStylesheets.indexOf(element) == -1) {
            //is external sheet?
            if (element.indexOf('http') > -1) {
                var response = request(element);
                response.body = response.body.replace(/,/g, ' , ', "D");
                response.body = response.body.replace(/{/g, ' { ', "D");
                response.body = response.body.replace(/}/g, ' } ', "D");
                response.body = response.body.replace(/:/g, ' : ', "D");
                response.body = response.body.replace(".", ' .', "D");
                response.body = response.body.replace("#", ' #', "D");
                response.body = response.body.replace(/\s{2,10}/g, ' ');
                response.body = response.body.replace(/[\n\r]+/g, '');
                //remove comments
                response.body = response.body.replace(/\/\*[\s\S]*?\*\/|([^:]|^)\/\/.*$/gm, '');
                var css = "~~~~~~~~~~~~" + response.body;
                loadedStylesheetsScript.push(css);
            } else {

            }
            //flag stylesheet as being extracted
            styleLog.push("adding " + element + " to extracted css array");
            loadedStylesheets.push(element);
        }
    }
}

function extractCSSRules(classes, IDs, nodeNames, css) {
    cssRules = [];
    // extract matching rules
    for (var index = 0; index < css.length; index++) {
        var cssDoc = css[index];
        for (var y = 0; y < nodeNames.length; y++) {
            var tag = nodeNames[y];
            findMatchingRules(" " + tag + " ", cssDoc);
        }
        for (var i = 0; i < classes.length; i++) {
            var cl = classes[i];
            findMatchingRules("." + cl + " ", cssDoc); // adding a space is more specific but can miss chained rules ex. .w3-col
        }
        for (var x = 0; x < IDs.length; x++) {
            var id = IDs[x];
            findMatchingRules(" " + "#" + id + " ", cssDoc);
        }
    }
}

function findMatchingRules(element, css) {
    var positions = getIndicesOf(element, css);
    if (positions.length) {
        log.push("*******found location instances (" + positions.length + ") of " + element + " in css: " + positions);
    }

    for (var index = 0; index < positions.length; index++) {
        var position = positions[index];
        getCssRule(position, css);
    }
}

function getIndicesOf(searchStr, str, caseSensitive) {
    var searchStrLen = searchStr.length;
    if (searchStrLen === 0) {
        return [];
    }
    var startIndex = 0,
        index, indices = [];
    if (!caseSensitive) {
        str = str.toLowerCase();
        searchStr = searchStr.toLowerCase();
    }
    while ((index = str.indexOf(searchStr, startIndex)) > -1) {
        indices.push(index);
        startIndex = index + searchStrLen;
    }
    return indices;
}

function getCssRule(position, css) {
    var start;
    var readCounter = 1;
    var firstTermination = true;
    var finish;
    while (css.charAt(position) !== '}' && css.charAt(position) !== '~') {
        position--;
    }
    start = ++position;
    while (readCounter !== 0) {
        if (css.charAt(position) === '{') {
            readCounter++;
        }
        if (css.charAt(position) === '}') {
            if (firstTermination) {
                firstTermination = false;
                readCounter--;
            }
            readCounter--;
        }
        position = position + 1;
    }
    readCounter = 0;

    finish = position + 2;
    cssRules.push(css.substring(start, --finish));
}


// base64 images
// create new css document to filePath
// create separate css document to filePath minified

//TODO: possibly check ajaxed urls for additional stylesheets?