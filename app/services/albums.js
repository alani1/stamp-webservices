var extend = require('node.extend');
var persistentCollection = require('./persistent-collection');
var dataTranslator = require('./mysql-translator');
var album = require('../model/album');
var countries = require('./countries');
var _ = require('../../lib/underscore/underscore');
var q = require('q');

var albums = extend(true, {}, persistentCollection, function () {

    function mergeCountries(connection, obj) {
        var defer = q.defer();
        if (!obj.COUNTRIES || obj.COUNTRIES.length === 0) {
            var clear_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
            connection.query(clear_link, [obj.ID], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    defer.resolve(obj);
                }
            });
        } else {
            var existing_links = "SELECT COUNTRY_ID FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=?";
            connection.query(existing_links, [obj.ID], function (err, results) {
                if (err) {
                    console.log(err);
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    var remove_ids = [];
                    var current = _.clone(obj.COUNTRIES);
                    for (var i = 0; i < results.length; i++) {
                        var result = results[i];
                        var indx = _.indexOf(current, result);
                        if (indx < 0) {
                            remove_ids.push(result);
                        } else {
                            current.splice(indx, 1);
                        }  
                    }
                    if (remove_ids.length > 0) {
                        var qs = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID=? AND COUNTRY_ID IN (";
                        for (var i = 0; i < remove_ids.length; i++) {
                            qs += remove_ids[i];
                            if (i < remove_ids.length - 1) {
                                qs += ",";
                            }
                        }
                        qs += ")";
                        connection.query(qs, [obj.ID], function (err, results) {
                            console.log(results);
                        });
                    }
//                    console.log("ids to add: ");
//                    console.log(current);
//                    console.log("ids to remove:");
 //                   console.log(remove_ids);
                    defer.resolve(obj);
                }
            });
        }
        return defer.promise;

    };
    return {
        collectionName: 'albums',
        fieldDefinition: album,
        preDelete: function (connection, id) {
            var defer = q.defer();
            var delete_link = "DELETE FROM ALBUMS_COUNTRIES WHERE ALBUM_ID= ?";
            connection.query(delete_link, [id], function (err, results) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                }
                // delete all stamp ownership records
                defer.resolve();
            });
            return defer.promise;
        },

        postCreate: function (connection, obj) {
            var defer = q.defer();
            defer.resolve(obj);
            return defer.promise;
        },
        postUpdate: function (connection, obj) {
            var defer = q.defer();
            mergeCountries(connection, obj).then(function (result) {
                defer.resolve(result);
            }, function (err) {
                defer.reject(dataTranslator.getErrorMessage(err));
            });
            return defer.promise;
        },
        postFind: function (connection, rows) {
            var that = this;
            var defer = q.defer();

            var qs = "SELECT ALBUM_ID, COUNTRY_ID FROM ALBUMS_COUNTRIES WHERE ALBUM_ID IN (";
            for (var i = 0; i < rows.length; i++) {
                rows[i].COUNTRIES = [];
                qs += rows[i].ID;
                if (i < rows.length - 1) {
                    qs += ",";
                }
            }
            qs += ")";
            connection.query(qs, function (err, r) {
                if (err) {
                    defer.reject(dataTranslator.getErrorMessage(err));
                } else {
                    for (var j = 0; j < r.length; j++) {
                        var a = _.findWhere(rows, { ID: r[j].ALBUM_ID });
                        a.COUNTRIES.push(r[j].COUNTRY_ID);
                    }
                    defer.resolve(rows);
                }
            });
            return defer.promise;
        },
    };
}());

module.exports = albums;
