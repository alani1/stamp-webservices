var _ = require('../../lib/underscore/underscore');
require("./string-utilities");
var Logger = require('../util/logger');

var logger = Logger.getLogger('odata');

function ODataParser() {
    "use strict";

    var REGEX = {

        parenthesis: /([(](.*)[)])$/,
        andor: /^(.*) (or|and) (.*)$/,
        op: /(\w*) (eq|gt|lt|ge|le|ne) (datetimeoffset'(.*)'|'(.*)'|[0-9]*)/,
        startsWith: /^startswith[(](.*),'(.*)'[)]/,
        endsWith: /^endswith[(](.*),'(.*)'[)]/,
        contains: /^contains[(](.*),'(.*)'[)]/
    } ;


    function buildLike(match,key) {
        var right = (key === 'startsWith') ? match[2] + '*' : (key === 'endsWith') ? '*' + match[2] : '*' + match[2] + '*';
        if( match[0].charAt(match[0].lastIndexOf(')')-1) === "\'") {
            right = "\'" + right + "\'";
        }
        return {
            left: match[1],
            type: 'like',
            right: right
        };
    }
    return {

        parse: function(filter) {
            var that = this;
            var obj = {};
            if( filter ) {
                filter = filter.trim();
            }
            var found = false;
            _.each(REGEX, function (regex, key) {
                if (found) {
                    return;
                }

                var match = filter.match(regex);
                if (match) {
                    found = true;
                    switch (regex) {
                        case REGEX.parenthesis:
                            var s = match.length > 2 ? match[2] : match[1];
                            var fnMatch;
                            if( (fnMatch = filter.match(REGEX.startsWith)) !== null) {
                                obj = buildLike(fnMatch,"startsWith");
                                break;
                            } else if( (fnMatch = filter.match(REGEX.endsWith)) !== null) {
                                obj = buildLike(fnMatch,"endsWith");
                                break;
                            } else if ( (fnMatch = filter.match(REGEX.contains)) !== null) {
                                obj = buildLike(fnMatch,"contains");
                                break;
                            }
                            obj = that.parse(s);
                            // If the "(" is not the first character, we need to process the left side and then substitute the right side
                            if( filter.indexOf(s) !== 1) {
                                var d_s = filter.substring(0,filter.indexOf(s) -1);
                                var d_obj = that.parse(d_s + " $TEMP$");
                                d_obj.right = obj;
                                obj = d_obj;
                            }
                            break;
                        case REGEX.andor:
                            obj = {
                                left: that.parse(match[1]),
                                type: match[2],
                                right: that.parse(match[3])
                            };
                            break;
                        case REGEX.op:
                            obj = {
                                left: match[1],
                                type: match[2],
                                right: ( match[3].indexOf('\'') === -1) ? +match[3] : match[3]
                            };
                            break;
                    }
                }
            });
            logger.debug(obj);
            return obj;
        }
    };
}

module.exports = new ODataParser();
